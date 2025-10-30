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
  jmap_subdomain = "jmap"
  jmap_fqdn      = "${local.jmap_subdomain}.${var.root_domain_name}"
}

# Route 53 hosted zone for the root domain
resource "aws_route53_zone" "root" {
  name = var.root_domain_name
}

########################
# ACM certificates
########################

# API Gateway custom domain cert in stack region (eu-west-2)
resource "aws_acm_certificate" "api" {
  domain_name       = local.jmap_fqdn
  validation_method = "DNS"
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id = aws_route53_zone.root.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.api_cert_validation : r.fqdn]
}

# CloudFront cert in us-east-1
resource "aws_acm_certificate" "root_cf" {
  provider          = aws.us_east_1
  domain_name       = var.root_domain_name
  validation_method = "DNS"
}

resource "aws_route53_record" "root_cf_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.root_cf.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id = aws_route53_zone.root.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "root_cf" {
  provider                 = aws.us_east_1
  certificate_arn         = aws_acm_certificate.root_cf.arn
  validation_record_fqdns = [for r in aws_route53_record.root_cf_cert_validation : r.fqdn]
}

########################
# API Gateway custom domain and base path mapping
########################

resource "aws_api_gateway_domain_name" "jmap" {
  domain_name              = local.jmap_fqdn
  regional_certificate_arn = aws_acm_certificate_validation.api.certificate_arn
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_base_path_mapping" "root" {
  domain_name = aws_api_gateway_domain_name.jmap.domain_name
  api_id     = var.sam_rest_api_id
  stage_name  = var.sam_rest_api_stage
}

resource "aws_route53_record" "jmap_api_alias" {
  zone_id = aws_route53_zone.root.zone_id
  name    = local.jmap_fqdn
  type    = "A"
  alias {
    name                   = aws_api_gateway_domain_name.jmap.regional_domain_name
    zone_id                = aws_api_gateway_domain_name.jmap.regional_zone_id
    evaluate_target_health = false
  }
}

########################
# CloudFront redirect for /.well-known/jmap
########################

resource "aws_cloudfront_function" "redirect" {
  name    = "${var.project}-root-redirect"
  runtime = "cloudfront-js-1.0"
  comment = "Redirect /.well-known/jmap to jmap subdomain"
  publish = true
  code    = file("${path.module}/redirect.js")
}

resource "aws_cloudfront_distribution" "root" {
  enabled             = true
  aliases             = [var.root_domain_name]
  price_class         = "PriceClass_100"
  is_ipv6_enabled     = true

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.root_cf.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  origin {
    domain_name = aws_s3_bucket_website_configuration.site.website_endpoint
    origin_id   = "s3-website-origin"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-website-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.redirect.arn
    }
  }
}

resource "aws_route53_record" "root_a" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.root_domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.root.domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "root_aaaa" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.root_domain_name
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.root.domain_name
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}

# SRV record for autodiscovery
resource "aws_route53_record" "srv_jmap" {
  zone_id = aws_route53_zone.root.zone_id
  name    = "_jmap._tcp.${var.root_domain_name}"
  type    = "SRV"
  ttl     = 3600
  records = ["0 1 443 ${local.jmap_fqdn}."]
}


