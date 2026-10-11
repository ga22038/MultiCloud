#!/usr/bin/env bash
set -euo pipefail
docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml stop app
date -u +'%Y-%m-%dT%H:%M:%SZ'
echo 'Solo la aplicación AWS está detenida; RDS y la VPN siguen activos.'
