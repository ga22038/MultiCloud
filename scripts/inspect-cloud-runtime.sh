#!/usr/bin/env bash
set -euo pipefail
if [ "$EUID" -ne 0 ]; then exec sudo -E bash "$0"; fi
base=/opt/polaris-ues
site=$(sed -n 's/^SITE_NAME=//p' "$base/site.env")
test "$site" = aws || test "$site" = gcp
printf 'SITE: %s\n' "$site"
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" ps --format json |
  python3 -c 'import json,sys; [print(json.dumps({k:row.get(k) for k in ["Service","State","Health","Image"]})) for row in map(json.loads,sys.stdin)]'
# NGINX configuration contains public routing and certificate paths, not key contents.
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" exec -T nginx nginx -t
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" exec -T nginx nginx -T 2>/dev/null |
  awk '/^upstream polaris_app/,/^}/ {print}'
curl -fsS "https://$site.multicloud.polarisenterprisesv.com/api/health/ready"
printf '\n'
