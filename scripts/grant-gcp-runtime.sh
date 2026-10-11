#!/usr/bin/env bash
set -euo pipefail
sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot' < "$HOME/polaris-ues-upload/db/runtime-grants.sql"
printf "DROP USER IF EXISTS 'polaris_migrate'@'%%';\n" | sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot'
echo 'Permisos mínimos aplicados; usuario temporal de migración eliminado.'
