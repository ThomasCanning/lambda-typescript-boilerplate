# Terraform backend configuration for remote state
# Use: eval $(aws configure export-credentials --profile default --format env)
# Before running terraform commands

terraform {
  backend "s3" {
    bucket         = "oneclickwebsite-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
