output "ec2_public_ips" {
  description = "Public IP addresses of the EC2 instances"
  value       = aws_instance.app[*].public_ip
}

output "ec2_instance_ids" {
  description = "Instance IDs of the EC2 instances"
  value       = aws_instance.app[*].id
}

output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = try(aws_lb.app[0].dns_name, "")
}

output "alb_security_group_id" {
  description = "ID of the ALB security group (empty string if ALB disabled)"
  value       = try(aws_security_group.alb[0].id, "")
}

output "ssh_private_key" {
  description = "Private SSH key for EC2 access"
  value       = tls_private_key.ssh.private_key_pem
  sensitive   = true
}

output "key_pair_name" {
  description = "Name of the AWS key pair"
  value       = aws_key_pair.app.key_name
}
