variable "environment" {
  type = string
}

variable "db_host" {
  type = string
}

variable "db_name" {
  type    = string
  default = "emertgency"
}

variable "db_user" {
  type    = string
  default = "emert"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "node_env" {
  type    = string
  default = "production"
}
