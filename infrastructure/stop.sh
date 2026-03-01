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
# 1. Check AWS credentials
# ============================================================================

info "Checking AWS credentials..."

if ! aws sts get-caller-identity > /dev/null 2>&1; then
  err "AWS credentials are invalid or expired."
  echo ""
  echo "Run: aws configure   (or aws sso login)"
  exit 1
fi

ok "  AWS credentials valid"

# ============================================================================
# 2. Check Terraform state
# ============================================================================

if [ ! -d .terraform ]; then
  err "Terraform is not initialized. Run ./start.sh first."
  exit 1
fi

if [ ! -f secrets.tfvars ]; then
  err "secrets.tfvars not found. It's needed for terraform destroy."
  echo "Create it or restore it — see README.md for the format."
  exit 1
fi

ENVIRONMENT=$(terraform workspace show 2>/dev/null)

if [ "$ENVIRONMENT" = "default" ]; then
  # Check which workspaces exist and let user pick
  WORKSPACES=$(terraform workspace list 2>/dev/null | grep -v default | sed 's/[* ]//g' | grep -v '^$' || true)

  if [ -z "$WORKSPACES" ]; then
    err "No environments deployed. Nothing to destroy."
    exit 0
  fi

  echo ""
  echo -e "${BOLD}Which environment do you want to tear down?${NC}"
  echo ""
  echo "$WORKSPACES" | while read -r ws; do
    echo "  - $ws"
  done
  echo ""
  read -p "Enter environment name: " ENVIRONMENT

  if ! echo "$WORKSPACES" | grep -qw "$ENVIRONMENT"; then
    err "'$ENVIRONMENT' is not a deployed environment."
    exit 1
  fi

  terraform workspace select "$ENVIRONMENT" > /dev/null 2>&1
fi

# ============================================================================
# 3. Show what will be destroyed
# ============================================================================

echo ""
echo -e "${BOLD}Environment: $ENVIRONMENT${NC}"
echo ""

EC2_IPS=$(terraform output -json ec2_public_ips 2>/dev/null | python3 -c "import sys,json; print(', '.join(json.load(sys.stdin)))" 2>/dev/null || echo "unknown")
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "unknown")
APP_URL=$(terraform output -raw app_url 2>/dev/null || echo "unknown")

echo "  Resources that will be destroyed:"
echo "    - EC2 instances: $EC2_IPS"
echo "    - RDS database:  $RDS_ENDPOINT"
echo "    - VPC, subnets, security groups"
echo "    - S3 environment bucket"
if [ "$ENVIRONMENT" = "prod" ]; then
  echo "    - Application Load Balancer"
fi
echo ""

if [ "$ENVIRONMENT" = "dev" ]; then
  echo -e "  ${BOLD}Cost saved:${NC} ~\$0.03/hr (\$22/month)"
  echo ""
  echo -e "  ${RED}${BOLD}WARNING: Dev uses skip_final_snapshot = true.${NC}"
  echo -e "  ${RED}All database data will be permanently deleted.${NC}"
else
  echo -e "  ${BOLD}Cost saved:${NC} ~\$0.15/hr (\$106/month)"
  echo ""
  echo -e "  ${YELLOW}A final RDS snapshot will be created automatically.${NC}"
fi

# ============================================================================
# 4. Confirm destruction
# ============================================================================

echo ""
echo -e "${RED}${BOLD}This action cannot be undone.${NC}"
echo ""
read -p "Type '$ENVIRONMENT' to confirm destruction: " CONFIRM

if [ "$CONFIRM" != "$ENVIRONMENT" ]; then
  warn "Confirmation failed. Nothing was destroyed."
  exit 0
fi

# ============================================================================
# 5. Terraform destroy
# ============================================================================

echo ""
info "Destroying $ENVIRONMENT infrastructure..."
echo ""

terraform destroy -auto-approve \
  -var-file="${ENVIRONMENT}.tfvars" \
  -var-file=secrets.tfvars

# ============================================================================
# 6. Success message
# ============================================================================

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  $ENVIRONMENT environment destroyed successfully${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  All AWS resources for '$ENVIRONMENT' have been torn down."
echo "  You are no longer being charged for this environment."
echo ""

if [ "$ENVIRONMENT" = "prod" ]; then
  echo "  A final RDS snapshot was saved. To restore it later,"
  echo "  find it in AWS Console > RDS > Snapshots."
  echo ""
fi

echo "  To redeploy later, run: ./start.sh"
echo ""
