#!/bin/bash
# ============================================================
# Cork Marketplace - CentOS Deployment Script
# Installs Python 3, Apache (httpd), and deploys the Flask app
# with Gunicorn behind Apache as a reverse proxy.
#
# Usage: sudo bash deploy-centos.sh
# ============================================================

set -e

# ===== Configuration =====
APP_NAME="cork-marketplace"
APP_DIR="/opt/${APP_NAME}"
APP_USER="marketplace"
REPO_URL="https://github.com/GU465/cork-marketplace.git"
BRANCH="master"
PORT=8000  # Gunicorn listens here; Apache proxies to it
SERVER_NAME="_default_"  # Change to your domain/IP if needed
MOD_PASSWORD="${MOD_PASSWORD:-CorkAdmin2026!}"

echo "=========================================="
echo " Cork Marketplace - CentOS Deployment"
echo "=========================================="

# ===== 1. Detect CentOS version and install packages =====
echo "[1/8] Installing system dependencies..."

if command -v dnf &> /dev/null; then
    # CentOS 8 / CentOS Stream / RHEL 8+
    PKG_MGR="dnf"
    dnf install -y epel-release
    dnf install -y python3 python3-pip python3-devel \
        httpd mod_ssl \
        git gcc sqlite \
        policycoreutils-python-utils
elif command -v yum &> /dev/null; then
    # CentOS 7
    PKG_MGR="yum"
    yum install -y epel-release
    yum install -y python3 python3-pip python3-devel \
        httpd mod_ssl \
        git gcc sqlite \
        policycoreutils-python
else
    echo "ERROR: Neither dnf nor yum found. Is this CentOS/RHEL?"
    exit 1
fi

echo "  -> Packages installed (using ${PKG_MGR})"

# ===== 2. Create application user =====
echo "[2/8] Creating application user..."

if ! id "${APP_USER}" &> /dev/null; then
    useradd --system --shell /sbin/nologin --home-dir "${APP_DIR}" "${APP_USER}"
    echo "  -> User '${APP_USER}' created"
else
    echo "  -> User '${APP_USER}' already exists"
fi

# ===== 3. Clone the repository =====
echo "[3/8] Cloning repository..."

if [ -d "${APP_DIR}/.git" ]; then
    echo "  -> Repository already exists, pulling latest..."
    cd "${APP_DIR}"
    git fetch origin
    git reset --hard "origin/${BRANCH}"
else
    git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    echo "  -> Cloned to ${APP_DIR}"
fi

cd "${APP_DIR}"

# ===== 4. Set up Python virtual environment =====
echo "[4/8] Setting up Python virtual environment..."

python3 -m venv "${APP_DIR}/venv"
source "${APP_DIR}/venv/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "  -> Virtual environment ready at ${APP_DIR}/venv"

# ===== 5. Create uploads directory and set permissions =====
echo "[5/8] Setting file permissions..."

mkdir -p "${APP_DIR}/public/uploads"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod 755 "${APP_DIR}"

echo "  -> Permissions set"

# ===== 6. Create systemd service for Gunicorn =====
echo "[6/8] Creating systemd service..."

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=Cork Marketplace (Gunicorn)
After=network.target

[Service]
Type=notify
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${APP_DIR}/venv/bin"
Environment="MOD_PASSWORD=${MOD_PASSWORD}"
ExecStart=${APP_DIR}/venv/bin/gunicorn \\
    --bind 127.0.0.1:${PORT} \\
    --workers 3 \\
    --timeout 600 \\
    --access-logfile /var/log/${APP_NAME}/access.log \\
    --error-logfile /var/log/${APP_NAME}/error.log \\
    server:app
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
mkdir -p /var/log/${APP_NAME}
chown -R "${APP_USER}:${APP_USER}" /var/log/${APP_NAME}

systemctl daemon-reload
systemctl enable ${APP_NAME}

echo "  -> Systemd service created and enabled"

# ===== 7. Configure Apache as reverse proxy =====
echo "[7/8] Configuring Apache..."

cat > /etc/httpd/conf.d/${APP_NAME}.conf << EOF
<VirtualHost *:80>
    ServerName ${SERVER_NAME}

    # Proxy to Gunicorn
    ProxyPreserveHost On
    ProxyRequests Off

    # Static files served directly by Apache (faster)
    Alias /uploads "${APP_DIR}/public/uploads"
    <Directory "${APP_DIR}/public/uploads">
        Require all granted
        Options -Indexes
    </Directory>

    Alias /images "${APP_DIR}/public/images"
    <Directory "${APP_DIR}/public/images">
        Require all granted
        Options -Indexes
    </Directory>

    # Everything else goes to Gunicorn
    ProxyPass /uploads !
    ProxyPass /images !
    ProxyPass / http://127.0.0.1:${PORT}/
    ProxyPassReverse / http://127.0.0.1:${PORT}/

    # Security headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Logging
    ErrorLog /var/log/httpd/${APP_NAME}-error.log
    CustomLog /var/log/httpd/${APP_NAME}-access.log combined
</VirtualHost>
EOF

# Enable required Apache modules
if ! httpd -M 2>/dev/null | grep -q proxy_module; then
    echo "LoadModule proxy_module modules/mod_proxy.so" >> /etc/httpd/conf.modules.d/00-proxy.conf 2>/dev/null || true
fi

# Configure SELinux to allow Apache to proxy
if command -v setsebool &> /dev/null; then
    setsebool -P httpd_can_network_connect 1
    echo "  -> SELinux: httpd_can_network_connect enabled"
fi

# Open firewall ports
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo "  -> Firewall: HTTP/HTTPS ports opened"
fi

systemctl enable httpd

echo "  -> Apache configured"

# ===== 8. Start services =====
echo "[8/8] Starting services..."

systemctl start ${APP_NAME}
systemctl start httpd

echo ""
echo "=========================================="
echo " DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo " App directory:  ${APP_DIR}"
echo " App service:    systemctl status ${APP_NAME}"
echo " Apache config:  /etc/httpd/conf.d/${APP_NAME}.conf"
echo " App logs:       /var/log/${APP_NAME}/"
echo " Apache logs:    /var/log/httpd/${APP_NAME}-*.log"
echo ""
echo " Your site is now running at:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo " Useful commands:"
echo "   systemctl restart ${APP_NAME}   # Restart the app"
echo "   systemctl restart httpd          # Restart Apache"
echo "   systemctl status ${APP_NAME}    # Check app status"
echo "   journalctl -u ${APP_NAME} -f   # Follow app logs"
echo ""
echo " To update the app from GitHub:"
echo "   cd ${APP_DIR}"
echo "   sudo -u ${APP_USER} git pull origin ${BRANCH}"
echo "   sudo systemctl restart ${APP_NAME}"
echo "=========================================="
