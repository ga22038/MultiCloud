#!/usr/bin/env bash
set -euo pipefail
sudo install -m 0700 "$HOME/polaris-ues-upload/gcp-renew-tls.sh" /usr/local/sbin/polaris-ues-renew-tls
sudo tee /etc/systemd/system/polaris-ues-renew-tls.service >/dev/null <<'UNIT'
[Unit]
Description=Polaris UES HTTPS certificate renewal
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/polaris-ues-renew-tls
UNIT
sudo tee /etc/systemd/system/polaris-ues-renew-tls.timer >/dev/null <<'UNIT'
[Unit]
Description=Polaris UES twice daily certificate renewal check
[Timer]
OnCalendar=*-*-* 00,12:00:00 UTC
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now polaris-ues-renew-tls.timer
sudo /usr/local/sbin/polaris-ues-renew-tls --dry-run
