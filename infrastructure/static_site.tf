########################
# Static website hosting for jmapbox.com placeholder
########################

locals {
  site_dir = "${path.module}/../web"
}

resource "aws_s3_bucket" "site" {
  bucket = "${var.project}-site-${var.root_domain_name}"
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = ["s3:GetObject"],
        Resource  = ["${aws_s3_bucket.site.arn}/*"]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.site]
}

resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_object" "site_files" {
  for_each = fileset(local.site_dir, "**")
  bucket   = aws_s3_bucket.site.id
  key      = each.value
  source   = "${local.site_dir}/${each.value}"
  etag     = filemd5("${local.site_dir}/${each.value}")
  content_type = (endswith(each.value, ".html") ? "text/html" : (endswith(each.value, ".css") ? "text/css" : null))
}

output "site_bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "site_website_endpoint" {
  value = aws_s3_bucket_website_configuration.site.website_endpoint
}


