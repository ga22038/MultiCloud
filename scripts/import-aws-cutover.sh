#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/polaris-ues
if docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" ps --status running --services | grep -qx app; then
  echo 'La aplicación AWS está activa. No sobrescribir la base en ejecución.'
  exit 1
fi
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/source.sql.gz "$base/source.sql.gz" --only-show-errors
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/source-integrity.txt "$base/source-integrity.txt" --only-show-errors
gzip -dc "$base/source.sql.gz" | mariadb --defaults-extra-file="$base/rds-client.cnf" 2> "$base/import-error.log" || { echo 'Falló la importación SQL; revisar el registro privado.'; exit 1; }
mariadb --defaults-extra-file="$base/rds-client.cnf" < "$base/upload/runtime-grants.sql" 2> "$base/grants-error.log" || { echo 'Falló la asignación de permisos; revisar el registro privado.'; exit 1; }
query="SELECT CONCAT(revision, ':', SHA2(document,256), ':', (SELECT COUNT(*) FROM polaris_ues.operations), ':', (SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1;"
actual=$(mariadb --defaults-extra-file="$base/rds-client.cnf" -NBe "$query")
test "$actual" = "$(cat "$base/source-integrity.txt")" || { echo 'Integridad diferente. Mantener ambos sitios detenidos.'; exit 1; }
mkdir -p "$base/export"
mariadb --defaults-extra-file="$base/rds-client.cnf" -NBe 'SELECT @@global.gtid_binlog_pos;' > "$base/export/rds-gtid.txt"
mariadb-dump --defaults-extra-file="$base/rds-client.cnf" --single-transaction --routines --triggers --hex-blob --databases polaris_ues | gzip > "$base/export/rds.sql.gz"
printf '%s\n' "$actual" > "$base/export/rds-integrity.txt"
gzip -t "$base/export/rds.sql.gz"
aws s3 cp "$base/export" s3://polaris-ues-117425831688-deployment/transfer/export/ --recursive --sse AES256 --only-show-errors
echo 'Datos, usuarios y operaciones conservados en RDS. Ambos sitios permanecen detenidos.'
printf '%s\n' "$actual"
