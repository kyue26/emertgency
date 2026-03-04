#!/bin/bash
set -euo pipefail
exec > /var/log/user_data.log 2>&1

echo "=== emertgency bootstrap starting ==="

# 1. Install system packages
dnf update -y
dnf install -y git

# Install PostgreSQL 15 client
dnf install -y postgresql15

# 2. Install Node.js 20 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# 3. Install PM2 globally
npm install -g pm2

# 4. Clone the repository
mkdir -p /var/app
if [ ! -d /var/app/emertgency ]; then
  git clone https://github.com/${github_repo}.git /var/app/emertgency
fi

cd /var/app/emertgency/backend

# 5. Download .env from S3 via pre-signed URL
curl -fsSL -o .env '${env_presigned_url}'

# 6. Install dependencies
npm install --production

# 7. Run database migrations on first boot only
if [ ! -f /var/app/migrations_complete ]; then
  echo "=== Running database migrations ==="

  export PGPASSWORD='${db_password}'
  DB_HOST='${db_host}'
  DB_USER='${db_user}'
  DB_NAME='${db_name}'

  # Wait for RDS to be available (can take a few minutes on first create)
  for i in $(seq 1 30); do
    if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
      echo "Database is ready"
      break
    fi
    echo "Waiting for database... attempt $i/30"
    sleep 10
  done

  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f create-schema.sql
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f migrations/001_offline_sync.sql
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f migrations/002_add_missing_tables.sql

  touch /var/app/migrations_complete
  echo "=== Migrations complete ==="
fi

# 8. Start the application with PM2
cd /var/app/emertgency/backend
pm2 start server.js --name emertgency --env ${node_env}
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

echo "=== emertgency bootstrap complete ==="
