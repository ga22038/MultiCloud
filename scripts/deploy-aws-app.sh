#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/polaris-ues
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/aws-bundle.tar.gz "$base/aws-bundle.tar.gz" --only-show-errors
install -d -m 0700 "$base/upload"
tar -xzf "$base/aws-bundle.tar.gz" -C "$base/upload"
install -m 0600 "$base/upload/site.env" "$base/site.env"
install -m 0600 "$base/upload/rds-client.cnf" "$base/rds-client.cnf"
install -m 0644 "$base/upload/database-ca/ca.pem" "$base/database-ca/ca.pem"
install -m 0644 "$base/upload/site.yaml" "$base/compose/site.yaml"
install -m 0644 "$base/upload/site.conf.template" "$base/nginx/site.conf.template"
mariadb --defaults-extra-file="$base/rds-client.cnf" < "$base/upload/bootstrap.sql" 2> "$base/bootstrap-error.log" || { echo 'Falló la configuración SQL. Revisar el registro privado.'; exit 1; }
config=$(mktemp -d /root/polaris-docker-auth.XXXXXX)
trap 'rm -f "$config/config.json"; rmdir "$config"' EXIT
aws ecr get-login-password --region us-east-2 | docker --config "$config" login --username AWS --password-stdin 117425831688.dkr.ecr.us-east-2.amazonaws.com >/dev/null
docker --config "$config" pull 117425831688.dkr.ecr.us-east-2.amazonaws.com/polaris-ues@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08 >/dev/null
rm -f "$base/aws-bundle.tar.gz" "$base/upload/bootstrap.sql" "$base/upload/rds-client.cnf" "$base/upload/site.env"
echo 'Configuración privada y aplicación preparadas; escrituras todavía deshabilitadas.'
