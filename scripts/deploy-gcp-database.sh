#!/usr/bin/env bash
set -euo pipefail
upload="$HOME/polaris-ues-upload/db"
device=/dev/disk/by-id/google-mariadb-data
sudo test -b "$device"
if ! sudo blkid "$device" >/dev/null; then
  # Only the newly created, specifically attached data disk may be initialized.
  sudo mkfs.ext4 -L polaris-ues-data "$device" >/dev/null
fi
sudo install -d -m 0750 /var/lib/polaris-ues
uuid=$(sudo blkid -s UUID -o value "$device")
if ! grep -Fq "UUID=$uuid " /etc/fstab; then
  printf 'UUID=%s /var/lib/polaris-ues ext4 defaults,nofail 0 2\n' "$uuid" | sudo tee -a /etc/fstab >/dev/null
fi
mountpoint -q /var/lib/polaris-ues || sudo mount /var/lib/polaris-ues
sudo install -d -o 999 -g 999 -m 0750 /opt/polaris-ues/database-tls
sudo install -m 0600 "$upload/database.env" /opt/polaris-ues/database.env
sudo install -m 0644 "$upload/compose.yaml" /opt/polaris-ues/compose.yaml
sudo install -m 0644 "$upload/tls/ca.pem" "$upload/tls/server-cert.pem" /opt/polaris-ues/database-tls/
sudo install -o 999 -g 999 -m 0400 "$upload/tls/server-key.pem" /opt/polaris-ues/database-tls/server-key.pem
sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml up -d --wait
container=$(sudo docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml ps -q mariadb)
sudo docker exec -i "$container" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot' < "$upload/initialize.sql"
echo 'MariaDB preparado: transporte TLS obligatorio y disco persistente montado.'
