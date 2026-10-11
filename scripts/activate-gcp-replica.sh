#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/polaris-ues
upload="$HOME/polaris-ues-upload/gcp-replica"
sudo test ! -d /var/lib/polaris-ues/mysql-replica/mysql || { echo 'La réplica ya tiene datos. No sobrescribir automáticamente.'; exit 1; }
sudo install -m 0644 "$upload/rds-ca.pem" "$base/database-tls/rds-ca.pem"
sudo cp --no-clobber "$base/compose.yaml" "$base/compose.before-rds.yaml"
sudo docker compose --env-file "$base/database.env" -f "$base/compose.yaml" stop mariadb
sudo install -m 0644 "$upload/compose.yaml" "$base/compose.yaml"
sudo docker compose --env-file "$base/database.env" -f "$base/compose.yaml" up -d --wait
db() { sudo docker compose --env-file "$base/database.env" -f "$base/compose.yaml" exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot "$@"' sh "$@"; }
{ printf 'SET SESSION sql_log_bin=0;\n'; gzip -dc "$upload/rds.sql.gz"; } | db 2> "$upload/restore-error.log" || { echo 'Falló la restauración de réplica. Revisar registro privado.'; exit 1; }
query="SELECT CONCAT(revision, ':', SHA2(document,256), ':', (SELECT COUNT(*) FROM polaris_ues.operations), ':', (SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1;"
test "$(db -NBe "$query")" = "$(cat "$upload/rds-integrity.txt")" || { echo 'La integridad no coincide. Mantener aplicaciones detenidas.'; exit 1; }
db < "$upload/replication.sql" 2> "$upload/replication-error.log" || { echo 'Falló la configuración de replicación. Revisar registro privado.'; exit 1; }
sleep 5
db -e 'SHOW SLAVE STATUS\G' | awk '/Slave_IO_Running:|Slave_SQL_Running:|Seconds_Behind_Master:|Using_Gtid:|Gtid_IO_Pos:|Last_IO_Errno:|Last_SQL_Errno:|Master_SSL_Allowed:|Master_SSL_Verify_Server_Cert:/ {print}'
db -NBe 'SELECT @@global.read_only;'
echo 'Datos originales conservados en mysql; réplica nueva en mysql-replica.'
rm -f "$upload/replication.sql" "$upload/rds.sql.gz"
