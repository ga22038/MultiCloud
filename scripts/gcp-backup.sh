#!/usr/bin/env bash
set -euo pipefail
umask 077
work=$(mktemp -d /var/tmp/polaris-ues-backup.XXXXXX)
trap 'rm -f "$work/database.sql.gz"; rmdir "$work"' EXIT
docker compose --env-file /opt/polaris-ues/database.env -f /opt/polaris-ues/compose.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --single-transaction --master-data=2 --gtid --routines --triggers --hex-blob --databases polaris_ues' | gzip > "$work/database.sql.gz"
gzip -t "$work/database.sql.gz"
python3 - "$work/database.sql.gz" <<'PY'
import datetime, json, pathlib, sys, urllib.parse, urllib.request, uuid
metadata = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', headers={'Metadata-Flavor':'Google'})
with urllib.request.urlopen(metadata, timeout=20) as response:
    token = json.load(response)['access_token']
bucket = 'project-dba46330-c40e-432b-9ad-polaris-ues-backups'
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
name = f'mariadb/{stamp}-{uuid.uuid4().hex[:8]}.sql.gz'
url = f'https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&ifGenerationMatch=0&name={urllib.parse.quote(name, safe="")}'
request = urllib.request.Request(url, data=pathlib.Path(sys.argv[1]).read_bytes(), method='POST', headers={'Authorization':f'Bearer {token}','Content-Type':'application/gzip'})
with urllib.request.urlopen(request, timeout=120) as response:
    result = json.load(response)
print(json.dumps({'backup':f'gs://{bucket}/{name}','bytes':result['size'],'crc32c':result['crc32c']}))
PY
