#!/usr/bin/env bash
# =============================================================================
# OLPDF — One-shot server bootstrap (run locally, SSHs into server)
# =============================================================================
# Usage: bash server-bootstrap.sh
# Requires: ssh olpdf configured in ~/.ssh/config
# =============================================================================
set -euo pipefail

REMOTE="olpdf"
DEPLOY_DIR="/opt/olpdf"
LOCAL_CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Bootstrapping server via SSH ($REMOTE)"

# ── 1. Install Docker ─────────────────────────────────────────────────────────
ssh "$REMOTE" 'bash -s' <<'REMOTE_SETUP'
set -e
echo "--- Installing Docker ---"
apt-get update -qq
apt-get install -y --no-install-recommends curl ca-certificates gnupg ufw
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "--- Configuring UFW firewall ---"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "--- Creating deploy directory ---"
mkdir -p /opt/olpdf/deploy/nginx/conf.d
mkdir -p /opt/olpdf/deploy/certbot/conf
mkdir -p /opt/olpdf/deploy/certbot/www
echo "--- Server setup complete ---"
REMOTE_SETUP

# ── 2. Copy deploy files to server ────────────────────────────────────────────
echo "==> Copying deploy config to $REMOTE:$DEPLOY_DIR"
scp "$LOCAL_CONFIG_DIR/docker-compose.infra.yml"      "$REMOTE:$DEPLOY_DIR/docker-compose.infra.yml"
scp "$LOCAL_CONFIG_DIR/deploy.sh"                      "$REMOTE:$DEPLOY_DIR/deploy.sh"
scp "$LOCAL_CONFIG_DIR/nginx/nginx.conf"               "$REMOTE:$DEPLOY_DIR/deploy/nginx/nginx.conf"
scp "$LOCAL_CONFIG_DIR/nginx/conf.d/upstreams.conf"    "$REMOTE:$DEPLOY_DIR/deploy/nginx/conf.d/upstreams.conf"

# ── 3. Copy .env.prod ─────────────────────────────────────────────────────────
echo "==> Copying .env.prod"
scp "$(dirname "$LOCAL_CONFIG_DIR")/.env.prod"         "$REMOTE:$DEPLOY_DIR/.env.prod"

# ── 4. Set permissions ────────────────────────────────────────────────────────
ssh "$REMOTE" "chmod +x $DEPLOY_DIR/deploy.sh"

# ── 5. Clone repo on server ───────────────────────────────────────────────────
echo "==> Cloning repo on server"
ssh "$REMOTE" "
  if [ ! -d '$DEPLOY_DIR/repo/.git' ]; then
    git clone https://github.com/Chidi09/olpdf.git $DEPLOY_DIR/repo
    echo '--- Repo cloned ---'
  else
    echo '--- Repo already exists ---'
  fi
"

# ── 6. Start infra (nginx without SSL initially) — compose creates the network ─
echo "==> Starting infra stack (nginx — HTTP only until SSL is set up)"
ssh "$REMOTE" "
  cd $DEPLOY_DIR
  # Use a temporary HTTP-only nginx config until we have the SSL cert
  cat > /tmp/nginx-init.conf <<'NGINXEOF'
events { worker_connections 1024; }
http {
  server {
    listen 80 default_server;
    location /healthz { return 200 \"ok\n\"; add_header Content-Type text/plain; }
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 \"OLPDF API — SSL pending\n\"; add_header Content-Type text/plain; }
  }
}
NGINXEOF
  cp /tmp/nginx-init.conf $DEPLOY_DIR/deploy/nginx/nginx.conf
  docker compose -f $DEPLOY_DIR/docker-compose.infra.yml up -d nginx
"

echo ""
echo "============================================"
echo "  Bootstrap complete!"
echo ""
echo "  Next steps:"
echo "  1. Point api.olpdf.xyz DNS → 78.47.216.151"
echo "  2. Run SSL setup:  ssh olpdf 'bash /opt/olpdf/setup-ssl.sh'"
echo "  3. Deploy the API: ssh olpdf 'bash /opt/olpdf/deploy.sh'"
echo "============================================"
