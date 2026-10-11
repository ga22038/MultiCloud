#!/usr/bin/env bash
set -euo pipefail
aws s3 cp s3://polaris-ues-117425831688-deployment/transfer/gcp-renew-tls.sh /opt/polaris-ues/renew-tls.sh --only-show-errors
install -m 0700 /opt/polaris-ues/renew-tls.sh /usr/local/sbin/polaris-ues-renew-tls
cat > /etc/systemd/system/polaris-ues-renew-tls.service <<'UNIT'
[Unit]
Description=Polaris UES HTTPS certificate renewal
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/polaris-ues-renew-tls
UNIT
cat > /etc/systemd/system/polaris-ues-renew-tls.timer <<'UNIT'
[Unit]
Description=Polaris UES twice daily certificate renewal check
[Timer]
OnCalendar=*-*-* 00,12:00:00 UTC
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now polaris-ues-renew-tls.timer
/usr/local/sbin/polaris-ues-renew-tls --dry-run
