################################################################################
# SSH Key Pair
################################################################################

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "app" {
  key_name   = "emertgency-${var.environment}"
  public_key = tls_private_key.ssh.public_key_openssh
}

################################################################################
# AMI Data Source — Amazon Linux 2023
################################################################################

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

################################################################################
# Security Group — ALB
################################################################################

resource "aws_security_group" "alb" {
  count = var.enable_alb ? 1 : 0

  name        = "emertgency-${var.environment}-alb-sg"
  description = "Security group for the application load balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "emertgency-${var.environment}-alb-sg"
  }
}

################################################################################
# EC2 Instances
################################################################################

resource "aws_instance" "app" {
  count = var.instance_count

  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app.key_name
  vpc_security_group_ids = [var.ec2_security_group_id]
  subnet_id              = element(var.public_subnet_ids, count.index)
  user_data_base64       = base64encode(var.user_data)

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "emertgency-${var.environment}-${count.index + 1}"
  }
}

################################################################################
# Application Load Balancer
################################################################################

resource "aws_lb" "app" {
  count = var.enable_alb ? 1 : 0

  name               = "emertgency-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = "emertgency-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  count = var.enable_alb ? 1 : 0

  name     = "emertgency-${var.environment}-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/"
    matcher = "200-404"
  }

  tags = {
    Name = "emertgency-${var.environment}-tg"
  }
}

resource "aws_lb_listener" "http" {
  count = var.enable_alb ? 1 : 0

  load_balancer_arn = aws_lb.app[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app[0].arn
  }
}

resource "aws_lb_target_group_attachment" "app" {
  count = var.enable_alb ? var.instance_count : 0

  target_group_arn = aws_lb_target_group.app[0].arn
  target_id        = aws_instance.app[count.index].id
  port             = 3000
}
