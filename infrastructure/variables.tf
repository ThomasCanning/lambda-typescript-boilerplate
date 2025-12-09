variable "region" {
  type        = string
  description = "AWS region for regional resources"
}

variable "root_domain_name" {
  type        = string
  description = "Root domain (e.g., example.com)"
}

variable "sam_http_api_id" {
  type        = string
  description = "HTTP API ID from SAM outputs"
  default     = ""  # Optional during bootstrap, set via Makefile during deployment
}

variable "wait_for_certificate_validation" {
  type        = bool
  description = "Whether to wait for certificate validation (set false on first deploy)"
  default     = false
}

variable "allowed_origins" {
  type        = string
  description = "Comma-separated list of allowed CORS origins (e.g., https://example.com,https://app.example.com)"
  default     = ""
}
