resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "env" {
  bucket = "emertgency-env-${var.environment}-${random_id.suffix.hex}"

  tags = {
    Name        = "emertgency-env-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "env" {
  bucket = aws_s3_bucket.env.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "env" {
  bucket = aws_s3_bucket.env.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_object" "env" {
  bucket  = aws_s3_bucket.env.id
  key     = "${var.environment}/.env"
  content = join("\n", [
    "DATABASE_URL=postgresql://${var.db_user}:${var.db_password}@${var.db_host}:5432/${var.db_name}",
    "JWT_SECRET=${var.jwt_secret}",
    "NODE_ENV=${var.node_env}",
    "PORT=3000",
    "BCRYPT_ROUNDS=12",
    ""
  ])

  tags = {
    Name        = "emertgency-${var.environment}-env"
    Environment = var.environment
  }
}

data "external" "presigned_url" {
  program = ["bash", "-c", "printf '{\"url\":\"%s\"}' \"$(aws s3 presign \"s3://${aws_s3_bucket.env.id}/${aws_s3_object.env.key}\" --expires-in 604800 --region us-east-1)\""]

  depends_on = [aws_s3_object.env]
}
