#!/usr/bin/env bash
set -euo pipefail
upload="$HOME/polaris-ues-upload"
sudo install -m 0600 "$upload/gcp-site.env" /opt/polaris-ues/site.env
sudo install -m 0644 "$upload/ca.pem" /opt/polaris-ues/database-ca/ca.pem
sudo docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml up -d --wait
rm -f "$upload/gcp-site.env"
curl -fsS https://gcp.multicloud.polarisenterprisesv.com/api/health/ready
