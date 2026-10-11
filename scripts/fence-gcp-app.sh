#!/usr/bin/env bash
set -euo pipefail
sudo docker compose --env-file /opt/polaris-ues/site.env -f /opt/polaris-ues/compose/site.yaml stop app
echo 'Aplicación GCP detenida durante la transferencia controlada de datos.'
