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
# CloudFront Distribution (domain.com - optional web client)
########################

# CloudFront function for handling requests when S3 web client is disabled
resource "aws_cloudfront_function" "web_client_fallback" {
  name    = "${replace(var.root_domain_name, ".", "-")}-web-client-fallback"
  runtime = "cloudfront-js-1.0"
  publish = true
  comment = "Returns 404 when web client S3 endpoint is not configured"
  code    = <<-EOT
    function handler(event) {
      return {
        statusCode: 404,
        statusDescription: 'Not Found',
        body: 'Not Found'
      };
    }
  EOT
}

# CloudFront distribution for root domain (serves web client from S3 when configured)
resource "aws_cloudfront_distribution" "web_client" {
  count           = var.wait_for_certificate_validation ? 1 : 0
  enabled         = true
  aliases         = [var.root_domain_name]
  comment         = var.web_client_s3_endpoint != "" ? "Web client distribution" : "Web client distribution (S3 not configured)"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  # S3 origin for web client (only if web_client_s3_endpoint is set)
  dynamic "origin" {
    for_each = var.web_client_s3_endpoint != "" ? [1] : []
    content {
      domain_name = var.web_client_s3_endpoint
      origin_id   = "s3-web-client"
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Dummy origin (only used when S3 is disabled - CloudFront function handles everything)
  dynamic "origin" {
    for_each = var.web_client_s3_endpoint == "" ? [1] : []
    content {
      domain_name = "unused.example.com"
      origin_id   = "unused"
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Default cache behavior
  # Routes to S3 when enabled, otherwise uses CloudFront function to return 404
  default_cache_behavior {
    target_origin_id       = var.web_client_s3_endpoint != "" ? "s3-web-client" : "unused"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # CloudFront function only used when S3 is disabled
    dynamic "function_association" {
      for_each = var.web_client_s3_endpoint == "" ? [1] : []
      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.web_client_fallback.arn
      }
    }

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
    compress    = var.web_client_s3_endpoint != "" ? true : false
  }

  # Custom error responses for SPA routing (only when S3 is enabled)
  dynamic "custom_error_response" {
    for_each = var.web_client_s3_endpoint != "" ? [403, 404] : []
    content {
      error_caching_min_ttl = 300
      error_code            = custom_error_response.value
      response_code         = 200
      response_page_path    = "/index.html"
    }
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


