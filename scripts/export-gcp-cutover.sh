#!/usr/bin/env bash
set -euo pipefail
umask 077
work="$HOME/polaris-ues-upload/cutover"
install -d -m 0700 "$work"
db() { sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot "$@"' sh "$@"; }
db -e 'SET GLOBAL read_only=ON;'
test "$(db -NBe 'SELECT @@global.read_only;')" = 1
db -NBe "SELECT CONCAT(revision, ':', SHA2(document,256), ':', (SELECT COUNT(*) FROM polaris_ues.operations), ':', (SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1;" > "$work/source-integrity.txt"
db -NBe 'SELECT @@global.gtid_binlog_pos;' > "$work/source-gtid.txt"
sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --single-transaction --routines --triggers --hex-blob --databases polaris_ues' | gzip > "$work/source.sql.gz"
gzip -t "$work/source.sql.gz"
sudo systemctl start polaris-ues-backup.service
echo 'GCP read_only=1; respaldo final creado y copia GCS completada.'
cat "$work/source-integrity.txt"
