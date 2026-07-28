#!/bin/bash
# ============================================================
# Cork Marketplace - Google Cloud Compute Engine Deployment
#
# This script runs from your LOCAL machine (Cloud Shell or
# any machine with gcloud CLI installed and authenticated).
#
# It will:
#   1. Create a firewall rule to allow HTTP traffic
#   2. Create a Compute Engine VM with a startup script
#   3. Upload your app files to the VM
#   4. Start the application via PM2
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Project set: gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   bash deploy-gce.sh
# ============================================================

set -e

# ===== Configuration =====
PROJECT_ID="gu465-2026-07-27-qr1ve-1"
ZONE="europe-west1-b"
INSTANCE_NAME="cork-marketplace"
MACHINE_TYPE="e2-micro"          # Free-tier eligible
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
TAG="http-server"

echo "=========================================="
echo " Cork Marketplace - GCE Deployment"
echo "=========================================="
echo " Project:  ${PROJECT_ID}"
echo " Zone:     ${ZONE}"
echo " Instance: ${INSTANCE_NAME}"
echo " Machine:  ${MACHINE_TYPE}"
echo "=========================================="
echo ""

# ===== 1. Set project =====
echo "[1/5] Setting project..."
gcloud config set project "${PROJECT_ID}"

# ===== 2. Create firewall rule for HTTP =====
echo "[2/5] Creating firewall rule for HTTP (port 80)..."
gcloud compute firewall-rules create allow-http \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80 \
    --source-ranges=0.0.0.0/0 \
    --target-tags="${TAG}" \
    --quiet 2>/dev/null || echo "  -> Firewall rule already exists, skipping."

# ===== 3. Create the VM instance =====
echo "[3/5] Creating Compute Engine instance..."
gcloud compute instances create "${INSTANCE_NAME}" \
    --zone="${ZONE}" \
    --machine-type="${MACHINE_TYPE}" \
    --image-family="${IMAGE_FAMILY}" \
    --image-project="${IMAGE_PROJECT}" \
    --tags="${TAG}" \
    --metadata-from-file=startup-script=gce-startup.sh \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard

echo "  -> VM created. Waiting 30 seconds for startup..."
sleep 30

# ===== 4. Upload application files =====
echo "[4/5] Uploading application files to VM..."

# Create a tar of the app (excluding unnecessary files)
tar czf /tmp/cork-marketplace.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='Test Listing Images' \
    --exclude='sharepoint' \
    --exclude='sharepoint-app' \
    --exclude='powerapps' \
    -C "$(dirname "$0")" .

# Copy to VM
gcloud compute scp /tmp/cork-marketplace.tar.gz \
    "${INSTANCE_NAME}":~/cork-marketplace.tar.gz \
    --zone="${ZONE}"

# Extract and install on the VM
gcloud compute ssh "${INSTANCE_NAME}" --zone="${ZONE}" --command="
    sudo mkdir -p /opt/cork-marketplace
    sudo tar xzf ~/cork-marketplace.tar.gz -C /opt/cork-marketplace
    sudo chown -R marketplace:marketplace /opt/cork-marketplace 2>/dev/null || true
    rm ~/cork-marketplace.tar.gz
"

# ===== 5. Install dependencies and start =====
echo "[5/5] Installing Node.js dependencies and starting app..."
gcloud compute ssh "${INSTANCE_NAME}" --zone="${ZONE}" --command="
    cd /opt/cork-marketplace
    sudo -u marketplace bash -c 'cd /opt/cork-marketplace && npm install --production'
    
    # Start with PM2
    sudo -u marketplace bash -c 'cd /opt/cork-marketplace && npx pm2 start server.js --name cork-marketplace'
    sudo -u marketplace bash -c 'npx pm2 save'
    sudo env PATH=\$PATH:/usr/bin npx pm2 startup systemd -u marketplace --hp /opt/cork-marketplace 2>/dev/null || true
"

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe "${INSTANCE_NAME}" \
    --zone="${ZONE}" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "=========================================="
echo " DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo " Your Cork Marketplace is live at:"
echo "   http://${EXTERNAL_IP}"
echo ""
echo " SSH into your VM:"
echo "   gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE}"
echo ""
echo "=========================================="
