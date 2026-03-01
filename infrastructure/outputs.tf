output "ec2_public_ips" {
  description = "Public IP addresses of EC2 instances"
  value       = module.compute.ec2_public_ips
}

output "alb_dns_name" {
  description = "ALB DNS name (prod only)"
  value       = module.compute.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS connection endpoint"
  value       = module.database.db_endpoint
}

output "ssh_private_key" {
  description = "SSH private key for EC2 access"
  value       = module.compute.ssh_private_key
  sensitive   = true
}

output "app_url" {
  description = "Application URL"
  value       = var.enable_alb ? "http://${module.compute.alb_dns_name}" : "http://${module.compute.ec2_public_ips[0]}:3000"
}

output "s3_bucket" {
  description = "S3 bucket for environment files"
  value       = module.deployment.s3_bucket_id
}

output "github_actions_setup" {
  description = "Instructions for configuring GitHub Actions secrets"
  value       = <<-EOT

    === GitHub Actions Setup ===

    1. Save the SSH key:
       terraform output -raw ssh_private_key > emertgency-key.pem
       chmod 600 emertgency-key.pem

    2. Add these secrets to your GitHub repo
       (Settings > Secrets and variables > Actions):

       SSH_PRIVATE_KEY = contents of emertgency-key.pem
       EC2_HOSTS       = ${join(", ", module.compute.ec2_public_ips)}

    3. For the destroy workflow, also add:

       AWS_ACCESS_KEY_ID     = your AWS access key
       AWS_SECRET_ACCESS_KEY = your AWS secret key
       DB_PASSWORD           = your database password
       JWT_SECRET            = your JWT secret

    4. Create GitHub environments "dev" and "prod"
       (Settings > Environments) with per-environment EC2_HOSTS.

  EOT
}
