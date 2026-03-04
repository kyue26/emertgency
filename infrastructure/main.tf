terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket = "emertgency-terraform-state-637867483998"
    key    = "emertgency/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "emertgency"
      Environment = local.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  environment = terraform.workspace
}

# --- Networking ---

module "networking" {
  source      = "./modules/networking"
  environment = local.environment
}

# --- EC2 Security Group (created here to break circular dependency) ---

resource "aws_security_group" "ec2" {
  name        = "emertgency-${local.environment}-ec2-sg"
  description = "Security group for EC2 application instances"
  vpc_id      = module.networking.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "emertgency-${local.environment}-ec2-sg"
  }
}

# Port 3000: from ALB in prod, from anywhere in dev
resource "aws_security_group_rule" "ec2_app_from_alb" {
  count                    = var.enable_alb ? 1 : 0
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = module.compute.alb_security_group_id
  security_group_id        = aws_security_group.ec2.id
}

resource "aws_security_group_rule" "ec2_app_public" {
  count             = var.enable_alb ? 0 : 1
  type              = "ingress"
  from_port         = 3000
  to_port           = 3000
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ec2.id
}

# --- Database ---

module "database" {
  source                = "./modules/database"
  environment           = local.environment
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  ec2_security_group_id = aws_security_group.ec2.id
  db_instance_class     = var.db_instance_class
  db_name               = "emertgency"
  db_username           = "emert"
  db_password           = var.db_password
  multi_az              = var.db_multi_az
  skip_final_snapshot   = var.skip_final_snapshot
}

# --- Deployment (S3 + .env) ---

module "deployment" {
  source      = "./modules/deployment"
  environment = local.environment
  db_host     = module.database.db_address
  db_name     = "emertgency"
  db_user     = "emert"
  db_password = var.db_password
  jwt_secret  = var.jwt_secret
  node_env    = local.environment == "prod" ? "production" : "development"
}

# --- Compute ---

module "compute" {
  source              = "./modules/compute"
  environment         = local.environment
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  ec2_security_group_id = aws_security_group.ec2.id
  instance_type       = var.instance_type
  instance_count      = var.instance_count
  ssh_allowed_cidr    = var.ssh_allowed_cidr
  enable_alb          = var.enable_alb

  user_data = templatefile("${path.module}/scripts/user_data.sh.tpl", {
    env_presigned_url = module.deployment.env_presigned_url
    db_host           = module.database.db_address
    db_name           = "emertgency"
    db_user           = "emert"
    db_password       = var.db_password
    github_repo       = var.github_repo
    node_env          = local.environment == "prod" ? "production" : "development"
  })
}
