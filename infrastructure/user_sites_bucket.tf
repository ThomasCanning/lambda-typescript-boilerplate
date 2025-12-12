########################
# User Sites S3 Bucket
########################

resource "aws_s3_bucket" "user_sites" {
  bucket = "${replace(var.root_domain_name, ".", "-")}-user-sites"
}

resource "aws_s3_bucket_versioning" "user_sites" {
  bucket = aws_s3_bucket.user_sites.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "user_sites" {
  bucket = aws_s3_bucket.user_sites.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "user_sites" {
  bucket = aws_s3_bucket.user_sites.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "user_sites" {
  bucket = aws_s3_bucket.user_sites.id

  index_document {
    suffix = "index.html"
  }
}

