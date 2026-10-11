#!/usr/bin/env bash
set -euo pipefail
backup="$HOME/polaris-ues-upload/restore.sql.gz"
test -s "$backup"
gzip -t "$backup"
container=polaris-ues-restore-check
cleanup() { sudo docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sudo docker run -d --name "$container" --network none --memory 512m --env-file /opt/polaris-ues/database.env --tmpfs /var/lib/mysql:uid=999,gid=999 mariadb:11.4 --innodb-buffer-pool-size=128M >/dev/null
ready=false
for i in $(seq 1 60); do
  if sudo docker exec "$container" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
test "$ready" = true
gzip -dc "$backup" | sudo docker exec -i "$container" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot'
query="SELECT CONCAT(revision, ':', SHA2(document,256), ':', (SELECT COUNT(*) FROM polaris_ues.operations), ':', (SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1;"
restored=$(printf '%s\n' "$query" | sudo docker exec -i "$container" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot -N')
current=$(printf '%s\n' "$query" | sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot -N')
test -n "$restored"
test "$restored" = "$current"
echo 'RESTORE_OK: revision, state SHA256, operations and users match the live database.'
