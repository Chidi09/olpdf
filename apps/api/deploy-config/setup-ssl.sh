#!/usr/bin/env bash
# =============================================================================
# OLPDF — SSL setup (run on the server after DNS is pointed)
# =============================================================================
# ssh olpdf 'bash /opt/olpdf/setup-ssl.sh'
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/olpdf"
DOMAIN="api.olpdf.xyz"
EMAIL="preyealalibo23@gmail.com"

echo "==> Obtaining Let's Encrypt cert for $DOMAIN"

# Get cert using webroot (nginx must be running on port 80)
docker run --rm \
  -v "$DEPLOY_DIR/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$DEPLOY_DIR/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

echo "==> Cert obtained. Switching nginx to full HTTPS config."

# Restore the full nginx.conf (with SSL blocks)
cat > "$DEPLOY_DIR/deploy/nginx/nginx.conf" <<'NGINXEOF'
events {
    worker_connections 1024;
}

http {
    include      /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - [$time_local] "$request" $status $body_bytes_sent';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    sendfile           on;
    keepalive_timeout  65;
    client_max_body_size 50M;

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    include /etc/nginx/conf.d/upstreams.conf;

    server {
        listen 80 default_server;
        location /healthz {
            access_log off;
            return 200 "ok\n";
            add_header Content-Type text/plain;
        }
    }

    server {
        listen 80;
        server_name api.olpdf.xyz;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name api.olpdf.xyz;

        ssl_certificate     /etc/letsencrypt/live/api.olpdf.xyz/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.olpdf.xyz/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_session_cache   shared:SSL:10m;
        ssl_session_timeout 10m;

        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location / {
            limit_req zone=api burst=60 nodelay;
            proxy_pass         http://olpdf_api_upstream;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_read_timeout    300s;
            proxy_send_timeout    60s;
        }
    }
}
NGINXEOF

# Mount certbot conf into nginx (update compose)
docker exec olpdf-nginx nginx -t && docker exec olpdf-nginx nginx -s reload

# Start certbot renewal loop
docker compose -f "$DEPLOY_DIR/docker-compose.infra.yml" up -d certbot

echo ""
echo "============================================"
echo "  SSL active! https://$DOMAIN is live."
echo "  Now run: bash /opt/olpdf/deploy.sh"
echo "============================================"
