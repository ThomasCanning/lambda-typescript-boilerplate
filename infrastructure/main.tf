terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  api_subdomain = "api"
  fqdn      = "${local.api_subdomain}.${var.root_domain_name}"
  s3_bucket_name = "${replace(var.root_domain_name, ".", "-")}-web-client"
}

########################
# ACM Certificates
########################

# Certificate for api.domain.com (API Gateway)
resource "aws_acm_certificate" "api" {
  domain_name       = local.fqdn
  validation_method = "DNS"
}

resource "aws_acm_certificate_validation" "api" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  certificate_arn = aws_acm_certificate.api.arn
}

# Certificate for domain.com (web client CloudFront)
resource "aws_acm_certificate" "root_web_client" {
  provider          = aws.us_east_1
  domain_name       = var.root_domain_name
  validation_method = "DNS"
}

resource "aws_acm_certificate_validation" "root_web_client" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.root_web_client.arn
}

# Certificate for *.domain.com (User Sites Wildcard)
resource "aws_acm_certificate" "wildcard_user_sites" {
  provider          = aws.us_east_1
  domain_name       = "*.${var.root_domain_name}"
  validation_method = "DNS"
}

resource "aws_acm_certificate_validation" "wildcard_user_sites" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.wildcard_user_sites.arn
}

########################
# API Gateway Custom Domain (api.domain.com)
########################

resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.wait_for_certificate_validation ? 1 : 0
  domain_name = local.fqdn
  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
  depends_on = [aws_acm_certificate_validation.api]
}

resource "aws_apigatewayv2_api_mapping" "api" {
  count       = var.wait_for_certificate_validation ? 1 : 0
  api_id      = var.sam_http_api_id
  domain_name = aws_apigatewayv2_domain_name.api[0].domain_name
  stage       = "$default"
}

########################
# S3 Bucket for Web Client

resource "aws_s3_bucket" "web_client" {
  bucket = local.s3_bucket_name
}

resource "aws_s3_bucket_website_configuration" "web_client" {
  bucket = aws_s3_bucket.web_client.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "web_client" {
  bucket = aws_s3_bucket.web_client.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "web_client" {
  bucket = aws_s3_bucket.web_client.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.web_client.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.web_client]
}

########################
# CloudFront Distribution

# CloudFront distribution for root domain (serves web client from S3)
resource "aws_cloudfront_distribution" "web_client" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  enabled         = true
  aliases         = [var.root_domain_name]
  comment         = "Web client distribution for ${var.root_domain_name}"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true


  # S3 website endpoint origin
  origin {
    domain_name = aws_s3_bucket_website_configuration.web_client.website_endpoint
    origin_id   = "s3-web-client"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior
  default_cache_behavior {
    target_origin_id       = "s3-web-client"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # Forwarded values (required for CloudFront cache behaviors)
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
    compress    = true
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.root_web_client.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.root_web_client]
}

# Origin Access Control for secure S3 access from CloudFront
resource "aws_cloudfront_origin_access_control" "user_sites" {
  name                              = "user-sites-oac-${replace(var.root_domain_name, ".", "-")}"
  description                       = "OAC for user sites bucket access from CloudFront"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Update S3 bucket policy to allow CloudFront OAC access
resource "aws_s3_bucket_policy" "user_sites_oac" {
  count  = var.wait_for_certificate_validation ? 1 : 0
  bucket = aws_s3_bucket.user_sites.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.user_sites.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.user_sites[0].id}"
          }
        }
      },
      {
        Sid    = "PublicReadGetObject"
        Effect = "Allow"
        Principal = "*"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.user_sites.arn}/*"
      }
    ]
  })

  depends_on = [
    aws_cloudfront_distribution.user_sites,
    aws_cloudfront_origin_access_control.user_sites
  ]
}

data "aws_caller_identity" "current" {}

resource "aws_cloudfront_function" "user_site_router" {
  name    = "user-site-router-${replace(var.root_domain_name, ".", "-")}"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrites subdomain requests to S3 folder paths"
  publish = true
  code    = <<EOF
function handler(event) {
    var request = event.request;
    var host = request.headers.host.value;
    var rootDomain = "${var.root_domain_name}";
    
    // Check if host ends with root domain (e.g. site.example.com)
    // and is NOT the root domain itself or www
    // and is NOT the api subdomain (handled by API Gateway custom domain, but for safety)
    if (host.endsWith(rootDomain) && host !== rootDomain && host !== "www." + rootDomain && !host.startsWith("api.")) {
        // Extract subdomain: "testsit.example.com" -> "testsit"
        var subdomain = host.split('.')[0];
        
        // Rewrite URI from /path to /subdomain/path
        // If URI is /, it becomes /subdomain/index.html via the S3 origin index config usually,
        // but since we are mapping to folder, we should be explicit.
        
        if (request.uri === '/') {
            request.uri = '/' + subdomain + '/index.html';
        } else {
             // Ensure we don't double rewrite if logic is complex, 
             // but here we assume incoming request is clean.
             request.uri = '/' + subdomain + request.uri;
        }
    }
    return request;
}
EOF
}

resource "aws_cloudfront_distribution" "user_sites" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  enabled         = true
  aliases         = ["*.${var.root_domain_name}"]
  comment         = "User sites wildcard distribution for *.${var.root_domain_name}"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  origin {
    domain_name              = aws_s3_bucket.user_sites.bucket_regional_domain_name
    origin_id                = "s3-user-sites"
    origin_access_control_id = aws_cloudfront_origin_access_control.user_sites.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-user-sites"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
    compress    = true

    // Attach the routing function
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.user_site_router.arn
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.wildcard_user_sites.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  depends_on = [aws_acm_certificate_validation.wildcard_user_sites]
}


