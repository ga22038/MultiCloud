#!/usr/bin/env bash
set -euo pipefail
umask 077
cloud-init status --wait >/dev/null || { test -S /var/run/docker.sock || exit 1; }
cd /opt/lab-__NAME__
chmod 0644 ca.pem
chmod 0600 *.env *.cnf *.sql
# This is exclusively a first initialization of the student's empty RDS.
test ! -e database-initialization-started
touch database-initialization-started
docker load -i images.tar >/dev/null
rds() { docker run --rm -i --network host -v "$PWD:/work:ro" mariadb:11.4 mariadb --defaults-extra-file=/work/rds-client.cnf "$@"; }
test "$(rds -NBe "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='polaris_ues'")" = 0 || { echo 'RDS no está vacío. No se inicializa.'; exit 1; }
rds < bootstrap.sql
docker run --rm --network host --env-file migration.env -v "$PWD/ca.pem:/work/ca.pem:ro" lab-__NAME__:migrate
rds < runtime-grants.sql
# Applications are not deployed yet. Detect any concurrent transaction during export.
before=$(rds -NBe 'SELECT @@global.gtid_binlog_pos')
[[ "$before" =~ ^[0-9]+-[0-9]+-[0-9]+(,[0-9]+-[0-9]+-[0-9]+)*$ ]]
docker run --rm --network host -v "$PWD:/work:ro" mariadb:11.4 mariadb-dump --defaults-extra-file=/work/rds-client.cnf --single-transaction --skip-lock-tables --databases polaris_ues >initial.sql
after=$(rds -NBe 'SELECT @@global.gtid_binlog_pos')
test "$before" = "$after" || { echo 'Hubo escrituras durante el respaldo inicial. Revisar antes de replicar.'; exit 1; }
test ! -d mysql/mysql
docker compose --env-file database.env -f replica.yaml up -d --wait
replica() { docker compose --env-file database.env -f replica.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot "$@"' sh "$@"; }
{ printf 'SET SESSION sql_log_bin=0;\n'; cat initial.sql; } | replica
printf "SET GLOBAL gtid_slave_pos='%s';\n" "$before" | replica
replica < replication.sql
touch database-initialized
rm -f initial.sql bootstrap.sql replication.sql migration.env
echo 'RDS inicializado; réplica iniciada. Ejecuta cloud replica antes de desplegar aplicaciones.'
