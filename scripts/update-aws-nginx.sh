#!/usr/bin/env bash
set -euo pipefail
base=/opt/polaris-ues
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/site.yaml "$base/compose/site.yaml" --only-show-errors
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/site.conf.template "$base/nginx/site.conf.template" --only-show-errors
grep -q '^ACME_PEER_IP=' "$base/site.env" || printf '\nACME_PEER_IP=34.122.222.237\n' >> "$base/site.env"
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" up -d --wait nginx
docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" exec -T nginx nginx -t
