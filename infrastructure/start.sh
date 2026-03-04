#!/bin/bash
set -euo pipefail

# --- Resolve to infrastructure/ directory regardless of where script is called from ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}$1${NC}"; }
ok()    { echo -e "${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}$1${NC}"; }
err()   { echo -e "${RED}$1${NC}" >&2; }

# ============================================================================
# 1. Check prerequisites
# ============================================================================

info "Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
  err "Terraform is not installed."
  echo ""
  echo "Install it from: https://developer.hashicorp.com/terraform/install"
  echo ""
  echo "  macOS:   brew install terraform"
  echo "  Linux:   sudo apt-get install terraform"
  echo "  Windows: choco install terraform"
  exit 1
fi

TERRAFORM_VERSION=$(terraform version -json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['terraform_version'])" 2>/dev/null || terraform version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
ok "  Terraform $TERRAFORM_VERSION"

if ! command -v aws &> /dev/null; then
  err "AWS CLI is not installed."
  echo ""
  echo "Install it from: https://aws.amazon.com/cli/"
  echo ""
  echo "  macOS:   brew install awscli"
  echo "  Linux:   sudo apt-get install awscli"
  exit 1
fi

AWS_VERSION=$(aws --version 2>&1 | awk '{print $1}' | cut -d/ -f2)
ok "  AWS CLI $AWS_VERSION"

# ============================================================================
# 2. Check AWS credentials
# ============================================================================

info "Checking AWS credentials..."

if ! AWS_IDENTITY=$(aws sts get-caller-identity 2>&1); then
  err "AWS credentials are invalid or expired."
  echo ""
  echo "Common fixes:"
  echo "  1. Run: aws configure"
  echo "  2. If using SSO: aws sso login"
  echo "  3. If using temporary credentials: check they haven't expired"
  echo "  4. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
  exit 1
fi

AWS_ACCOUNT=$(echo "$AWS_IDENTITY" | python3 -c "import sys,json; print(json.load(sys.stdin)['Account'])" 2>/dev/null || echo "unknown")
ok "  Authenticated to account $AWS_ACCOUNT"

# ============================================================================
# 3. Check secrets.tfvars
# ============================================================================

if [ ! -f secrets.tfvars ]; then
  warn "secrets.tfvars not found."
  echo ""
  echo "This file stores your database password and JWT secret."
  echo "Create it now at: $SCRIPT_DIR/secrets.tfvars"
  echo ""
  echo -e "${BOLD}Paste this into the file and fill in your values:${NC}"
  echo ""
  echo '  db_password = "your-strong-database-password"'
  echo '  jwt_secret  = "your-jwt-secret-at-least-32-characters-long"'
  echo ""

  read -p "Would you like me to create it interactively? (y/N) " CREATE_SECRETS
  if [[ "$CREATE_SECRETS" =~ ^[Yy] ]]; then
    read -sp "Enter database password: " DB_PASS
    echo ""
    read -sp "Enter JWT secret (min 32 chars): " JWT_SEC
    echo ""

    if [ ${#JWT_SEC} -lt 32 ]; then
      err "JWT secret must be at least 32 characters."
      exit 1
    fi

    cat > secrets.tfvars << EOF
db_password = "$DB_PASS"
jwt_secret  = "$JWT_SEC"
EOF
    chmod 600 secrets.tfvars
    ok "  Created secrets.tfvars"
  else
    echo "Create the file and run this script again."
    exit 1
  fi
else
  ok "  secrets.tfvars found"
fi

# ============================================================================
# 4. Choose environment
# ============================================================================

echo ""
echo -e "${BOLD}Which environment do you want to deploy?${NC}"
echo ""
echo "  1) dev  - 1 small server, ~\$0.03/hr (~\$22/month)"
echo "  2) prod - 2 servers + load balancer, ~\$0.15/hr (~\$106/month)"
echo ""
read -p "Enter 1 or 2 [default: 1]: " ENV_CHOICE

case "${ENV_CHOICE:-1}" in
  1|dev)   ENVIRONMENT="dev" ;;
  2|prod)  ENVIRONMENT="prod" ;;
  *)
    err "Invalid choice. Enter 1 (dev) or 2 (prod)."
    exit 1
    ;;
esac

ok "  Deploying: $ENVIRONMENT"

# ============================================================================
# 5. Terraform init
# ============================================================================

if [ ! -d .terraform ]; then
  info "Running terraform init (first time setup)..."
  terraform init
  echo ""
fi

# ============================================================================
# 6. Create/select workspace
# ============================================================================

info "Selecting workspace: $ENVIRONMENT"

if ! terraform workspace list 2>/dev/null | grep -qw "$ENVIRONMENT"; then
  terraform workspace new "$ENVIRONMENT" > /dev/null 2>&1
  ok "  Created workspace: $ENVIRONMENT"
else
  terraform workspace select "$ENVIRONMENT" > /dev/null 2>&1
  ok "  Selected workspace: $ENVIRONMENT"
fi

# ============================================================================
# 7. Terraform apply
# ============================================================================

echo ""
info "Planning infrastructure changes..."
echo ""

terraform plan -var-file="${ENVIRONMENT}.tfvars" -var-file=secrets.tfvars -out=tfplan

echo ""
read -p "$(echo -e "${BOLD}Apply these changes? (y/N)${NC} ")" APPLY_CONFIRM

if [[ ! "$APPLY_CONFIRM" =~ ^[Yy] ]]; then
  warn "Cancelled. No changes applied."
  rm -f tfplan
  exit 0
fi

echo ""
terraform apply tfplan
rm -f tfplan

# ============================================================================
# 8. Print summary
# ============================================================================

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

APP_URL=$(terraform output -raw app_url 2>/dev/null || echo "pending")
EC2_IPS=$(terraform output -json ec2_public_ips 2>/dev/null | python3 -c "import sys,json; print(', '.join(json.load(sys.stdin)))" 2>/dev/null || echo "pending")

echo -e "  ${BOLD}App URL:${NC}     $APP_URL"
echo -e "  ${BOLD}EC2 IPs:${NC}     $EC2_IPS"
echo -e "  ${BOLD}Environment:${NC} $ENVIRONMENT"
echo ""

echo -e "  ${BOLD}SSH access:${NC}"
echo "    terraform output -raw ssh_private_key > emertgency-key.pem"
echo "    chmod 600 emertgency-key.pem"
FIRST_IP=$(terraform output -json ec2_public_ips 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[0])" 2>/dev/null || echo "<EC2_IP>")
echo "    ssh -i emertgency-key.pem ec2-user@$FIRST_IP"
echo ""

if [ "$ENVIRONMENT" = "dev" ]; then
  echo -e "  ${BOLD}Estimated cost:${NC} ~\$0.03/hr (\$22/month)"
else
  echo -e "  ${BOLD}Estimated cost:${NC} ~\$0.15/hr (\$106/month)"
fi
echo ""

echo -e "  ${YELLOW}Remember: run ${BOLD}./stop.sh${NC}${YELLOW} when done to avoid charges.${NC}"
echo ""
echo -e "  The app takes 3-5 minutes to fully boot (RDS startup + migrations)."
echo "  Check progress: ssh in and run  cat /var/log/user_data.log"
echo ""
