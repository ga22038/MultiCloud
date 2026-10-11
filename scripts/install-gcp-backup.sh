#!/usr/bin/env bash
set -euo pipefail
sudo install -m 0700 "$HOME/polaris-ues-upload/gcp-backup.sh" /usr/local/sbin/polaris-ues-backup
sudo tee /etc/systemd/system/polaris-ues-backup.service >/dev/null <<'UNIT'
[Unit]
Description=Polaris UES consistent MariaDB backup to private Cloud Storage
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/polaris-ues-backup
UNIT
sudo tee /etc/systemd/system/polaris-ues-backup.timer >/dev/null <<'UNIT'
[Unit]
Description=Polaris UES daily database backup
[Timer]
OnCalendar=*-*-* 03:15:00 UTC
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now polaris-ues-backup.timer
sudo systemctl start polaris-ues-backup.service
sudo journalctl -u polaris-ues-backup.service -n 5 --no-pager
