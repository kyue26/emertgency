#!/bin/bash
# deploy.sh — SSH into EC2 instance(s), pull latest code, and restart
# Usage: ./deploy.sh <ssh_key_path> <host1> [host2] [host3] ...

set -euo pipefail

SSH_KEY="$1"
shift
HOSTS="$@"

if [ -z "$SSH_KEY" ] || [ -z "$HOSTS" ]; then
  echo "Usage: $0 <ssh_key_path> <host1> [host2] ..."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -i $SSH_KEY"

for HOST in $HOSTS; do
  echo "=== Deploying to $HOST ==="

  ssh $SSH_OPTS ec2-user@"$HOST" << 'REMOTE'
    set -euo pipefail
    cd /var/app/emertgency

    echo "Pulling latest code..."
    git pull origin main

    echo "Installing dependencies..."
    cd backend
    npm install --production

    echo "Restarting application..."
    pm2 restart emertgency

    echo "Deploy complete on $(hostname)"
REMOTE

  echo "=== Done: $HOST ==="
done

echo "All deployments complete."
