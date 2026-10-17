export function nginxConfig(c, site, a, g, tls = false) {
  if (!["aws", "gcp"].includes(site)) throw Error("Sitio NGINX inválido.");
  const peer = site === "aws" ? g.app_ip : a.aws_app_ip;
  const upstream = `upstream student_app {
  zone student_app 64k;
  resolver 127.0.0.11 valid=10s ipv6=off;
  server app:3000 resolve max_fails=2 fail_timeout=5s;
  ${site === "aws" ? `server ${g.app_private_ip}:3000 backup;` : ""}
}
`;
  const challenge = `location /.well-known/acme-challenge/ { root /var/www/acme; try_files $uri @peer; }
  location @peer {
    if ($http_x_lab_acme = 1) { return 404; }
    proxy_set_header X-Lab-Acme 1;
    proxy_pass http://${peer};
  }`;
  const application = `location / {
    proxy_pass http://student_app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 3s;
    proxy_read_timeout 15s;
    # Never replay sent non-idempotent requests.
    proxy_next_upstream error timeout http_502 http_503 http_504;
    proxy_next_upstream_tries 2;
  }`;
  const plain = `server { listen 80; server_name _; server_tokens off; ${challenge} ${tls ? "location / { return 301 https://$host$request_uri; }" : application} }\n`;
  if (!tls) return upstream + plain;
  return (
    upstream +
    plain +
    `server {
  listen 443 ssl;
  server_name ${site}.${c.domain} app.${c.domain};
  server_tokens off;
  ssl_certificate /etc/nginx/tls/fullchain.pem;
  ssl_certificate_key /etc/nginx/tls/privkey.pem;
  ${challenge}
  ${application}
}\n`
  );
}
