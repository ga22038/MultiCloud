#!/usr/bin/env bash
# The caller supplies a public immutable image reference in POLARIS_RELEASE_IMAGE.
set -euo pipefail
if [ "$EUID" -ne 0 ]; then exec sudo -E bash "$0"; fi
base=/opt/polaris-ues
image=${POLARIS_RELEASE_IMAGE:?Define the immutable release image}
[[ "$image" =~ ^(us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues/app|117425831688.dkr.ecr.us-east-2.amazonaws.com/polaris-ues)@sha256:[a-f0-9]{64}$ ]] || { echo 'Referencia de imagen no permitida.'; exit 1; }
site=$(sed -n 's/^SITE_NAME=//p' "$base/site.env")
previous=$(sed -n 's/^POLARIS_IMAGE=//p' "$base/site.env")
test -n "$previous"
config=$(mktemp -d /root/polaris-release-auth.XXXXXX)
trap 'rm -f "$config/config.json"; rmdir "$config"' EXIT
if [ "$site" = aws ]; then
  aws ecr get-login-password --region us-east-2 | docker --config "$config" login -u AWS --password-stdin 117425831688.dkr.ecr.us-east-2.amazonaws.com >/dev/null
elif [ "$site" = gcp ]; then
  curl -fsS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' | docker --config "$config" login -u oauth2accesstoken --password-stdin us-central1-docker.pkg.dev >/dev/null
else
  echo 'Sitio no permitido.'; exit 1
fi
docker --config "$config" pull "$image" >/dev/null
printf '%s\n' "$previous" > "$base/previous-release.txt"
sed -i "s|^POLARIS_IMAGE=.*|POLARIS_IMAGE=$image|" "$base/site.env"
compose() { docker compose --env-file "$base/site.env" -f "$base/compose/site.yaml" "$@"; }
if ! compose up -d --no-deps --wait app; then
  sed -i "s|^POLARIS_IMAGE=.*|POLARIS_IMAGE=$previous|" "$base/site.env"
  compose up -d --no-deps --wait app
  compose exec -T nginx nginx -s reload
  echo 'La versión nueva falló. Se recuperó la anterior.'; exit 1
fi
# NGINX must resolve the replacement container after its IP changes.
compose exec -T nginx nginx -t
compose exec -T nginx nginx -s reload
curl --retry 5 --retry-delay 2 --retry-all-errors -fsS "https://$site.multicloud.polarisenterprisesv.com/api/health/ready"
echo "RELEASE_OK: $site"
