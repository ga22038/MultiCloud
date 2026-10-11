#!/usr/bin/env bash
set -euo pipefail
docker run --rm -v /opt/polaris-ues/letsencrypt:/etc/letsencrypt -v /opt/polaris-ues/acme:/var/www/acme certbot/certbot:latest renew --non-interactive --no-random-sleep-on-renew "$@"
install -m 0644 /opt/polaris-ues/letsencrypt/live/polaris-ues/fullchain.pem /opt/polaris-ues/tls/fullchain.pem
install -m 0600 /opt/polaris-ues/letsencrypt/live/polaris-ues/privkey.pem /opt/polaris-ues/tls/privkey.pem
docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml exec -T nginx nginx -t
docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml exec -T nginx nginx -s reload
