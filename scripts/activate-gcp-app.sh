#!/usr/bin/env bash
set -euo pipefail
registry=us-central1-docker.pkg.dev
app_image=us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues/app@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08
sudo sed -i 's|^POLARIS_IMAGE=.*|POLARIS_IMAGE=us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues/app@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08|' /opt/polaris-ues/site.env
config=$(sudo mktemp -d /root/polaris-docker-auth.XXXXXX)
cleanup() { sudo find "$config" -type f -delete; sudo rmdir "$config"; }
trap cleanup EXIT
curl -fsS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' | sudo docker --config "$config" login -u oauth2accesstoken --password-stdin "$registry" >/dev/null
sudo docker --config "$config" pull "$app_image" >/dev/null
sudo docker run --rm -v /opt/polaris-ues/letsencrypt:/etc/letsencrypt -v /opt/polaris-ues/acme:/var/www/acme certbot/certbot:latest certonly --webroot -w /var/www/acme --non-interactive --agree-tos --email developerengineer545@gmail.com --cert-name polaris-ues -d gcp.multicloud.polarisenterprisesv.com -d app.multicloud.polarisenterprisesv.com
sudo install -m 0644 /opt/polaris-ues/letsencrypt/live/polaris-ues/fullchain.pem /opt/polaris-ues/tls/fullchain.pem
sudo install -m 0600 /opt/polaris-ues/letsencrypt/live/polaris-ues/privkey.pem /opt/polaris-ues/tls/privkey.pem
sudo docker stop polaris-ues-acme >/dev/null
sudo docker rm polaris-ues-acme >/dev/null
sudo docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml up -d --wait
curl -fsS https://gcp.multicloud.polarisenterprisesv.com/api/health/ready
