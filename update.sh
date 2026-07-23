#!/bin/bash
# Quick update script - pull latest from GitHub and restart
# Usage: sudo bash update.sh

set -e

APP_NAME="cork-marketplace"
APP_DIR="/opt/${APP_NAME}"
APP_USER="marketplace"
BRANCH="master"

echo "Pulling latest changes..."
cd "${APP_DIR}"
sudo -u "${APP_USER}" git pull origin "${BRANCH}"

echo "Updating dependencies..."
source "${APP_DIR}/venv/bin/activate"
pip install -r requirements.txt
deactivate

echo "Restarting services..."
systemctl restart "${APP_NAME}"

echo "Done! App updated and restarted."
systemctl status "${APP_NAME}" --no-pager
