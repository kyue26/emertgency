# emertgency Infrastructure

Terraform IaC for deploying the emertgency backend to AWS.

## Quick Start

If you just want to deploy or tear down, use the wrapper scripts:

```bash
cd infrastructure

# Deploy (walks you through everything)
./start.sh

# Tear down (stops charges)
./stop.sh
```

These scripts check prerequisites, prompt for inputs, and handle all
Terraform commands. No Terraform knowledge needed.

## Architecture

| | Dev | Prod |
|---|---|---|
| EC2 | 1x t3.micro | 2x t3.small (separate AZs) |
| RDS | db.t3.micro, single-AZ | db.t3.small, Multi-AZ |
| ALB | None | Application Load Balancer |
| SSH | Open (0.0.0.0/0) | Restricted CIDR |

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- AWS account with EC2, RDS, VPC, S3, ALB permissions

## First-Time Setup

### 1. Create the Terraform State Bucket

```bash
aws s3 mb s3://emertgency-terraform-state-637867483998 --region us-east-1
aws s3api put-bucket-versioning \
  --bucket emertgency-terraform-state-637867483998 \
  --versioning-configuration Status=Enabled
```

### 2. Initialize Terraform

```bash
cd infrastructure
terraform init
```

### 3. Create Workspaces

```bash
terraform workspace new dev
terraform workspace new prod
```

### 4. Create a `secrets.tfvars` File (gitignored)

```hcl
db_password = "your-strong-db-password-here"
jwt_secret  = "your-jwt-secret-at-least-32-chars-long"
```

## Deploying

### Dev Environment

```bash
terraform workspace select dev
terraform plan  -var-file=dev.tfvars -var-file=secrets.tfvars
terraform apply -var-file=dev.tfvars -var-file=secrets.tfvars
```

### Prod Environment

```bash
terraform workspace select prod
terraform plan  -var-file=prod.tfvars -var-file=secrets.tfvars
terraform apply -var-file=prod.tfvars -var-file=secrets.tfvars
```

## After Apply

### Get SSH Key

```bash
terraform output -raw ssh_private_key > emertgency-key.pem
chmod 600 emertgency-key.pem
```

### SSH into EC2

```bash
ssh -i emertgency-key.pem ec2-user@$(terraform output -json ec2_public_ips | jq -r '.[0]')
```

### Check App Status

```bash
# On the EC2 instance:
pm2 status
pm2 logs emertgency
cat /var/log/user_data.log
```

### Test the API

```bash
curl http://$(terraform output -json ec2_public_ips | jq -r '.[0]'):3000/auth/login
```

## Wrapper Scripts (start.sh / stop.sh)

These are the recommended way to deploy if you're not familiar with Terraform.

### start.sh

Run from the `infrastructure/` directory or the repo root:

```bash
./infrastructure/start.sh
```

What it does:
1. Checks that Terraform and AWS CLI are installed
2. Verifies your AWS credentials are valid (tells you how to fix if not)
3. Checks for `secrets.tfvars` and offers to create it interactively
4. Asks which environment to deploy (dev or prod)
5. Initializes Terraform and creates/selects the workspace
6. Shows you a plan and asks for confirmation
7. Deploys and prints a summary with the app URL, SSH instructions, and cost

### stop.sh

```bash
./infrastructure/stop.sh
```

What it does:
1. Verifies AWS credentials
2. Shows what's deployed and the cost you'll save
3. Warns about data loss (especially dev where there's no final RDS snapshot)
4. Asks you to type the environment name to confirm
5. Tears everything down and confirms

## Manual Deployment (without GitHub Actions)

```bash
./scripts/deploy.sh emertgency-key.pem <EC2_IP>
```

## GitHub Actions Setup

After `terraform apply`, run `terraform output github_actions_setup` to see
the exact values to configure. The full setup:

### Required Secrets

Go to your GitHub repo > Settings > Secrets and variables > Actions and add:

| Secret | Value | Used by |
|--------|-------|---------|
| `SSH_PRIVATE_KEY` | Contents of `emertgency-key.pem` (full PEM including header/footer) | deploy.yml |
| `AWS_ACCESS_KEY_ID` | Your AWS access key | destroy.yml |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | destroy.yml |
| `DB_PASSWORD` | Same value as in `secrets.tfvars` | destroy.yml |
| `JWT_SECRET` | Same value as in `secrets.tfvars` | destroy.yml |

### Per-Environment Secrets

Go to Settings > Environments, create `dev` and `prod` environments, then add
`EC2_HOSTS` as an environment-level secret in each:

| Environment | `EC2_HOSTS` value |
|-------------|-------------------|
| dev | Single IP, e.g. `3.88.1.2` |
| prod | Comma-separated IPs, e.g. `3.88.1.2, 3.88.1.3` |

Get the IPs from:
```bash
terraform output -json ec2_public_ips
```

### Workflows

**deploy.yml** — runs automatically on push to `main` (when `backend/` changes)
or manually via workflow_dispatch. Deploys by SSHing into each EC2 instance,
pulling the latest code, running `npm install`, and restarting PM2.

**destroy.yml** — manual trigger only. Tears down all infrastructure for a
selected environment. Requires typing "destroy" as confirmation before
proceeding. Uses Terraform with your AWS credentials to run `terraform destroy`.

## Cost Management

### Estimated Monthly Costs (us-east-1)

| Resource | Dev | Prod |
|----------|-----|------|
| EC2 | ~$8 (1x t3.micro) | ~$34 (2x t3.small) |
| RDS | ~$13 (db.t3.micro, single-AZ) | ~$50 (db.t3.small, Multi-AZ) |
| ALB | $0 (none) | ~$18 (fixed + LCU) |
| S3 | <$1 | <$1 |
| Data transfer | ~$1 | ~$3 |
| **Total** | **~$22/month** | **~$106/month** |

Costs are approximate. RDS is the largest fixed cost. EC2 t3.micro is
free-tier eligible for the first 12 months.

### Tearing Down When Not in Use

To avoid charges when not actively using the infrastructure:

```bash
# Destroy dev
terraform workspace select dev
terraform destroy -var-file=dev.tfvars -var-file=secrets.tfvars

# Destroy prod
terraform workspace select prod
terraform destroy -var-file=prod.tfvars -var-file=secrets.tfvars
```

Or use the GitHub Actions destroy workflow (Actions > Destroy Infrastructure >
Run workflow > select environment > type "destroy").

**Warning:** `terraform destroy` deletes all resources including the RDS
database. In dev (`skip_final_snapshot = true`), all data is permanently lost.
In prod (`skip_final_snapshot = false`), a final snapshot is created
automatically, but restoring from it requires manual steps. Always back up
any data you need before destroying.

### Stopping Without Destroying

To reduce costs without losing data, you can stop EC2 instances manually:

```bash
aws ec2 stop-instances --instance-ids $(terraform output -json ec2_instance_ids | jq -r '.[]')
```

RDS will continue to incur charges even when EC2 is stopped. To stop RDS:

```bash
aws rds stop-db-instance --db-instance-identifier emertgency-dev
```

RDS auto-restarts after 7 days. You will need to stop it again if still unused.

## Troubleshooting

**EC2 user data failed:** SSH in and check `/var/log/user_data.log`

**RDS not reachable:** Verify RDS is in private subnets and EC2 security group has
outbound access to port 5432. Check `psql -h <rds_endpoint> -U emert -d emertgency`

**Pre-signed URL expired:** Run `terraform apply` again to generate a new URL
(only needed if instance is relaunched after 7 days)

**PM2 not starting on reboot:** Run `pm2 startup systemd -u ec2-user --hp /home/ec2-user && pm2 save`

**GitHub Actions deploy failing:** Verify `SSH_PRIVATE_KEY` includes the full PEM
(including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
lines) and that `EC2_HOSTS` is set as an environment secret, not a repo secret.
