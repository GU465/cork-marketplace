#!/bin/bash
# ============================================================
# Cork Marketplace - GCE VM Startup Script
# This runs automatically when the VM boots for the first time.
# It installs Node.js, Nginx, and configures the system.
# ============================================================

set -e
exec > /var/log/cork-startup.log 2>&1

echo "=== Cork Marketplace VM Startup ==="
echo "Started at: $(date)"

# ===== 1. System updates =====
echo "[1/6] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# ===== 2. Install Node.js 20 LTS =====
echo "[2/6] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "  Node.js version: $(node --version)"
echo "  npm version: $(npm --version)"

# ===== 3. Install Nginx (reverse proxy) =====
echo "[3/6] Installing Nginx..."
apt-get install -y nginx

# ===== 4. Create application user =====
echo "[4/6] Creating application user..."
if ! id "marketplace" &>/dev/null; then
    useradd --system --shell /bin/false --home-dir /opt/cork-marketplace marketplace
fi

mkdir -p /opt/cork-marketplace/public/uploads
chown -R marketplace:marketplace /opt/cork-marketplace

# ===== 5. Configure Nginx as reverse proxy =====
echo "[5/6] Configuring Nginx..."
cat > /etc/nginx/sites-available/cork-marketplace << 'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 10M;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Serve uploaded images directly via Nginx (faster)
    location /uploads/ {
        alias /opt/cork-marketplace/public/uploads/;
        expires 7d;
        access_log off;
    }

    # Serve static images directly
    location /images/ {
        alias /opt/cork-marketplace/public/images/;
        expires 30d;
        access_log off;
    }

    # Proxy everything else to Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONF

# Enable the site and remove default
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/cork-marketplace /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
systemctl enable nginx

# ===== 6. Create systemd service for Node.js app =====
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/cork-marketplace.service << 'SERVICE'
[Unit]
Description=Cork Marketplace Node.js App
After=network.target

[Service]
Type=simple
User=marketplace
Group=marketplace
WorkingDirectory=/opt/cork-marketplace
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/cork-marketplace

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cork-marketplace

echo ""
echo "=== Startup script complete at $(date) ==="
echo "=== Waiting for app files to be uploaded ==="
