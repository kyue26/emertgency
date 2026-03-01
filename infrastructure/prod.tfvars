instance_type       = "t3.small"
instance_count      = 2
db_instance_class   = "db.t3.small"
db_multi_az         = true
skip_final_snapshot = false
ssh_allowed_cidr    = "0.0.0.0/0"  # TODO: restrict to your IP in production
enable_alb          = true
