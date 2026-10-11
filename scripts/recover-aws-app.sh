#!/usr/bin/env bash
set -euo pipefail
docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml up -d --wait app
curl -fsS https://aws.multicloud.polarisenterprisesv.com/api/health/ready
