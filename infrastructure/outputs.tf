output "api_subdomain" {
  description = "API subdomain name"
  value       = local.api_subdomain
}

output "dns_setup_instructions" {
  value = join("\n", concat(
    length(aws_apigatewayv2_domain_name.api) > 0 ? [
      "",
      "DNS Records (Permanent):",
      "",
      "Name:  ${local.api_subdomain}.${var.root_domain_name}",
      "Type:  CNAME",
      "Value: ${aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name}",
      "TTL:   300",
      "",
      "Name:  ${var.root_domain_name}",
      "Type:  ALIAS (or ANAME/CNAME with flattening)",
      "Value: ${aws_cloudfront_distribution.web_client[0].domain_name}",
      "TTL:   300",
      "",
      "Name:  *.${var.root_domain_name} (or * as wildcard)",
      "Type:  CNAME",
      "Value: ${try(aws_cloudfront_distribution.user_sites[0].domain_name, "Pending")}",
      "TTL:   300",
      "Note: This enables user subdomains like testsite.${var.root_domain_name}",
      ""
    ] : [
      "",
      "DNS Records (Certificate Validation):",
      "",
      "Name:  ${try(tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_name, "Loading...")}",
      "Type:  CNAME",
      "Value: ${try(tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_value, "Loading...")}",
      "TTL:   300",
      "",
      "Name:  ${try(tolist(aws_acm_certificate.root_web_client.domain_validation_options)[0].resource_record_name, "Loading...")}",
      "Type:  CNAME",
      "Value: ${try(tolist(aws_acm_certificate.root_web_client.domain_validation_options)[0].resource_record_value, "Loading...")}",
      "TTL:   300",
      ""
    ]
  ))
}

output "base_url" {
  description = "API base URL"
  value       = "https://${local.api_subdomain}.${var.root_domain_name}"
}

output "api_gateway_target" {
  description = "Target domain for API subdomain CNAME"
  value       = try(aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name, "Pending - complete certificate validation first")
}

output "cloudfront_web_client_target" {
  description = "Target domain for root domain ALIAS/ANAME record"
  value       = try(aws_cloudfront_distribution.web_client[0].domain_name, "Pending - complete certificate validation first")
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (needed for web client integration)"
  value       = try(aws_cloudfront_distribution.web_client[0].id, "Pending - complete certificate validation first")
}

output "cert_validation_records" {
  description = "Certificate validation CNAME records"
  value = {
    api_cert = try({
      name  = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_name
      value = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_value
    }, {})
    root_cert = try({
      name  = tolist(aws_acm_certificate.root_web_client.domain_validation_options)[0].resource_record_name
      value = tolist(aws_acm_certificate.root_web_client.domain_validation_options)[0].resource_record_value
    }, {})
  }
}

output "s3_bucket_name" {
  description = "S3 bucket name for web client"
  value       = aws_s3_bucket.web_client.id
}

output "s3_website_endpoint" {
  description = "S3 website endpoint for web client"
  value       = aws_s3_bucket_website_configuration.web_client.website_endpoint
}

output "user_sites_distribution_domain_name" {
  description = "CloudFront distribution domain name for user sites (wildcard subdomains)"
  value       = try(aws_cloudfront_distribution.user_sites[0].domain_name, "Pending - complete certificate validation first")
}

output "user_sites_distribution_id" {
  description = "CloudFront distribution ID for user sites"
  value       = try(aws_cloudfront_distribution.user_sites[0].id, "Pending - complete certificate validation first")
}

output "user_sites_bucket_name" {
  description = "S3 bucket name for user sites (to pass to SAM)"
  value       = aws_s3_bucket.user_sites.id
}
