#!/usr/bin/env bash
set -euo pipefail
upload="$HOME/polaris-ues-upload"
sudo install -m 0644 "$upload/site.yaml" /opt/polaris-ues/compose/site.yaml
sudo install -m 0644 "$upload/site.conf.template" /opt/polaris-ues/nginx/site.conf.template
sudo grep -q '^ACME_PEER_IP=' /opt/polaris-ues/site.env || printf '\nACME_PEER_IP=18.227.139.179\n' | sudo tee -a /opt/polaris-ues/site.env >/dev/null
sudo docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml up -d --wait nginx
sudo docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml exec -T nginx nginx -t
