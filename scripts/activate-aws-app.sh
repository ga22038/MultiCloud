#!/usr/bin/env bash
set -euo pipefail
base=/opt/polaris-ues
sed -i 's/^APP_WRITES_ENABLED=.*/APP_WRITES_ENABLED=true/' "$base/site.env"
if docker inspect polaris-ues-acme >/dev/null 2>&1; then
  docker stop polaris-ues-acme >/dev/null
  docker rm polaris-ues-acme >/dev/null
fi
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" up -d --wait
curl -fsS https://aws.multicloud.polarisenterprisesv.com/api/health/ready
