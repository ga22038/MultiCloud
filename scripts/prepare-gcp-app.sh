#!/usr/bin/env bash
set -euo pipefail
upload="$HOME/polaris-ues-upload/app"
sudo install -d -m 0750 /opt/polaris-ues/database-ca /opt/polaris-ues/tls /opt/polaris-ues/acme /opt/polaris-ues/nginx /opt/polaris-ues/compose
sudo chmod 0755 /opt/polaris-ues/database-ca /opt/polaris-ues/acme
sudo install -m 0600 "$upload/site.env" /opt/polaris-ues/site.env
sudo install -m 0600 "$upload/migration.env" /opt/polaris-ues/migration.env
sudo install -m 0644 "$upload/database-ca/ca.pem" /opt/polaris-ues/database-ca/ca.pem
sudo install -m 0644 "$upload/site.yaml" /opt/polaris-ues/compose/site.yaml
sudo install -m 0644 "$upload/site.conf.template" /opt/polaris-ues/nginx/site.conf.template
sudo tee /opt/polaris-ues/nginx/bootstrap.conf >/dev/null <<'NGINX'
server {
  listen 80;
  server_name gcp.multicloud.polarisenterprisesv.com app.multicloud.polarisenterprisesv.com;
  server_tokens off;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { return 503; }
}
NGINX
sudo docker run -d --name polaris-ues-acme --restart unless-stopped -p 80:80 -v /opt/polaris-ues/nginx/bootstrap.conf:/etc/nginx/conf.d/default.conf:ro -v /opt/polaris-ues/acme:/var/www/acme:ro nginx:1.28-alpine >/dev/null
sudo docker pull certbot/certbot:latest >/dev/null
echo 'Entrada HTTP de ACME preparada; aplicación todavía privada.'
