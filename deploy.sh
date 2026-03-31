#!/usr/bin/env bash
set -euo pipefail

# ─── KB-Pilot Frontend Deploy Script ───────────────────────────
# Target: Amazon Linux 2023 (t2.micro)
# Run as: ec2-user (uses sudo where needed)
# Usage:  bash deploy.sh
# ────────────────────────────────────────────────────────────────

APP_NAME="kb-frontend"
APP_DIR="/home/ec2-user/kb-manager"
REPO_URL="https://github.com/yash11K/kb-pilot-UI.git"
BACKEND_API="http://54.160.238.80:80/api/v1"
NODE_MAJOR=20
PORT=80

echo "══════════════════════════════════════════"
echo "  KB-Pilot Frontend — EC2 Deploy"
echo "══════════════════════════════════════════"

# ─── 1. Fix DNS (required on fresh AL2023) ──────────────────────
echo "[1/7] Fixing DNS..."
sudo rm -f /etc/resolv.conf
sudo tee /etc/resolv.conf > /dev/null <<EOF
nameserver 169.254.169.253
nameserver 8.8.8.8
nameserver 1.1.1.1
options timeout:2 attempts:3 rotate
EOF
ping -c 2 google.com > /dev/null 2>&1 && echo "  ✓ DNS working" || { echo "  ✗ DNS still broken"; exit 1; }

# ─── 2. Install system deps ─────────────────────────────────────
echo "[2/7] Installing system packages..."
sudo dnf install -y git

# ─── 3. Install Node.js via NodeSource ──────────────────────────
echo "[3/7] Installing Node.js ${NODE_MAJOR}..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_${NODE_MAJOR}.x | sudo bash -
  sudo dnf install -y nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ─── 4. Clone or pull repo ──────────────────────────────────────
echo "[4/7] Syncing repo..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch --all
  git reset --hard origin/main
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ─── 5. Create .env and install + build ──────────────────────────
echo "[5/7] Installing deps & building..."
cat > .env.local <<ENVFILE
NEXT_PUBLIC_API_URL=${BACKEND_API}
NEXT_PUBLIC_REVIEWER_EMAIL=reviewer@example.com
ENVFILE

npm ci --production=false
npm run build

# ─── 6. Create systemd service ──────────────────────────────────
echo "[6/7] Setting up systemd service..."
sudo tee /etc/systemd/system/${APP_NAME}.service > /dev/null <<SERVICE
[Unit]
Description=KB-Pilot Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOSTNAME=0.0.0.0
ExecStart=$(which node) node_modules/.bin/next start -p ${PORT} -H 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}
sudo systemctl restart ${APP_NAME}

# ─── 7. Allow Node to bind to port 80 (privileged) ──────────────
echo "[7/8] Granting Node.js permission to bind port 80..."
sudo setcap 'cap_net_bind_service=+ep' "$(which node)"

# ─── 8. Open port if iptables is active ──────────────────────────
echo "[8/8] Ensuring port ${PORT} is open..."
if command -v iptables &> /dev/null; then
  sudo iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT 2>/dev/null || true
fi

echo ""
echo "══════════════════════════════════════════"
echo "  ✓ Deploy complete!"
echo "  App running on http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):${PORT}"
echo "  Logs: sudo journalctl -u ${APP_NAME} -f"
echo "══════════════════════════════════════════"
