#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 ca-certificates
systemctl enable --now docker
install -d -m 0750 /opt/polaris-ues
# Release image, environment, certificates and MariaDB replication are configured
# separately. Never put application credentials in Terraform user_data.
