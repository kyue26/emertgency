output "s3_bucket_id" {
  description = "The ID of the S3 bucket storing environment files"
  value       = aws_s3_bucket.env.id
}

output "env_presigned_url" {
  description = "Presigned URL to download the .env file"
  value       = data.external.presigned_url.result.url
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.env.arn
}
