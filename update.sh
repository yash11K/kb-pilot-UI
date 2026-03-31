#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/kb-manager"
APP_NAME="kb-frontend"

echo "── Pulling latest changes..."
cd "$APP_DIR"
git fetch --all
git reset --hard origin/main

echo "── Installing deps..."
npm ci --production=false

echo "── Building..."
npm run build

echo "── Ensuring Node can bind port 80..."
sudo setcap 'cap_net_bind_service=+ep' "$(which node)"

echo "── Restarting service..."
sudo systemctl restart $APP_NAME

echo "── Done! Checking status..."
sudo systemctl status $APP_NAME --no-pager
