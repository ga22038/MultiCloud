#!/usr/bin/env bash
set -euo pipefail
cloud-init status --wait >/dev/null || { test -S /var/run/docker.sock || exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mariadb-client jq >/dev/null
docker pull amazon/aws-cli:2.37.12 >/dev/null
cat > /usr/local/bin/aws <<'AWSCLI'
#!/usr/bin/env bash
exec docker run --rm --network host -e AWS_DEFAULT_REGION=us-east-2 -v /opt/polaris-ues:/opt/polaris-ues amazon/aws-cli:2.37.12 "$@"
AWSCLI
chmod 0755 /usr/local/bin/aws
install -d -m 0750 /opt/polaris-ues/database-ca /opt/polaris-ues/tls /opt/polaris-ues/acme /opt/polaris-ues/nginx /opt/polaris-ues/compose
chmod 0755 /opt/polaris-ues/database-ca /opt/polaris-ues/acme
cat > /opt/polaris-ues/nginx/bootstrap.conf <<'NGINX'
server {
  listen 80;
  server_name aws.multicloud.polarisenterprisesv.com;
  server_tokens off;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { return 503; }
}
NGINX
docker inspect polaris-ues-acme >/dev/null 2>&1 || docker run -d --name polaris-ues-acme --restart unless-stopped -p 80:80 -v /opt/polaris-ues/nginx/bootstrap.conf:/etc/nginx/conf.d/default.conf:ro -v /opt/polaris-ues/acme:/var/www/acme:ro nginx:1.28-alpine >/dev/null
docker pull certbot/certbot:latest >/dev/null
docker run --rm -v /opt/polaris-ues/letsencrypt:/etc/letsencrypt -v /opt/polaris-ues/acme:/var/www/acme certbot/certbot:latest certonly --webroot -w /var/www/acme --non-interactive --agree-tos --email developerengineer545@gmail.com --cert-name polaris-ues -d aws.multicloud.polarisenterprisesv.com
install -m 0644 /opt/polaris-ues/letsencrypt/live/polaris-ues/fullchain.pem /opt/polaris-ues/tls/fullchain.pem
install -m 0600 /opt/polaris-ues/letsencrypt/live/polaris-ues/privkey.pem /opt/polaris-ues/tls/privkey.pem
echo 'Docker, administración SSM y certificado HTTPS preparados.'
