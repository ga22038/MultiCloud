#!/usr/bin/env bash
set -euo pipefail
sudo chmod 0755 /opt/polaris-ues/database-ca /opt/polaris-ues/acme
image=us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues/migrate@sha256:e4700c21e3631848b9cd841bf554f3b14296290d5c4e5653ea64d43f074196a5
config=$(sudo mktemp -d /root/polaris-docker-auth.XXXXXX)
cleanup() { sudo find "$config" -type f -delete; sudo rmdir "$config"; }
trap cleanup EXIT
curl -fsS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' | sudo docker --config "$config" login -u oauth2accesstoken --password-stdin us-central1-docker.pkg.dev >/dev/null
sudo docker --config "$config" pull "$image" >/dev/null
sudo docker run --rm --env-file /opt/polaris-ues/migration.env -v /opt/polaris-ues/database-ca:/run/database-ca:ro "$image"
