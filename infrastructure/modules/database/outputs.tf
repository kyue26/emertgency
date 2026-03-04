output "db_endpoint" {
  description = "The full endpoint of the RDS instance (host:port)"
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "The hostname of the RDS instance (no port)"
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "The port the RDS instance is listening on"
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "The name of the database"
  value       = aws_db_instance.this.db_name
}

output "db_security_group_id" {
  description = "The ID of the RDS security group"
  value       = aws_security_group.rds.id
}
