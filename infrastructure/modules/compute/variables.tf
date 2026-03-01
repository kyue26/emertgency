variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "instance_count" {
  type    = number
  default = 1
}

variable "ec2_security_group_id" {
  type        = string
  description = "Security group ID for EC2 instances (created in root module)"
}

variable "user_data" {
  type = string
}

variable "ssh_allowed_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "enable_alb" {
  type    = bool
  default = false
}
