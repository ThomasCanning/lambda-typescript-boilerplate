variable "project" {
  type        = string
  description = "Project name prefix"
  default     = "jmap-serverless"
}

variable "region" {
  type        = string
  description = "AWS region for regional resources (API Gateway, Route53 operations)"
}

variable "root_domain_name" {
  type        = string
  description = "Root domain name (e.g., example.com)"
}

variable "sam_rest_api_id" {
  type        = string
  description = "SAM API Gateway Rest API ID (from SAM Outputs.RestApiId)"
}

variable "sam_rest_api_stage" {
  type        = string
  description = "SAM API Gateway stage name (from SAM Outputs.RestApiStageName)"
  default     = "Prod"
}


