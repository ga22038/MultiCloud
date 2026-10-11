#!/usr/bin/env bash
set -euo pipefail
base=/opt/polaris-ues
work=$(mktemp -d "$base/team-users.XXXXXX")
chmod 0700 "$work"
trap 'rm -rf "$work"' EXIT
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/team-users.tar.gz "$work/users.tar.gz" --only-show-errors
tar -xzf "$work/users.tar.gz" -C "$work"
chmod 0600 "$work/rds-client.cnf" "$work/users.sql"
mariadb --defaults-extra-file="$work/rds-client.cnf" < "$work/users.sql" 2> "$work/error.log" || { echo 'No se pudo crear el equipo. Revisar la ejecución privada.'; exit 1; }
echo 'TEAM_USERS_CREATED: existing accounts were preserved.'
