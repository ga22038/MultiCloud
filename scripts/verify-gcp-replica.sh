#!/usr/bin/env bash
set -euo pipefail
db() { sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot "$@"' sh "$@"; }
status=$(db -e 'SHOW SLAVE STATUS\G')
printf '%s\n' "$status" | awk '/Slave_IO_Running:|Slave_SQL_Running:|Seconds_Behind_Master:|Using_Gtid:|Gtid_IO_Pos:|Last_IO_Errno:|Last_SQL_Errno:|Master_SSL_Allowed:|Master_SSL_Verify_Server_Cert:/ {print}'
printf '%s\n' "$status" | grep -Eq 'Slave_IO_Running: Yes$'
printf '%s\n' "$status" | grep -Eq 'Slave_SQL_Running: Yes$'
printf '%s\n' "$status" | grep -Eq 'Last_IO_Errno: 0$'
printf '%s\n' "$status" | grep -Eq 'Last_SQL_Errno: 0$'
printf '%s\n' "$status" | grep -Eq 'Using_Gtid: Slave_Pos$'
printf '%s\n' "$status" | grep -Eq 'Master_SSL_Allowed: Yes$'
printf '%s\n' "$status" | grep -Eq 'Master_SSL_Verify_Server_Cert: Yes$'
test "$(db -NBe 'SELECT @@global.read_only;')" = 1
db -NBe "SELECT CONCAT(revision, ':', SHA2(document,256), ':', (SELECT COUNT(*) FROM polaris_ues.operations), ':', (SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1;"
echo 'REPLICA_OK: read-only, GTID and verified TLS.'
