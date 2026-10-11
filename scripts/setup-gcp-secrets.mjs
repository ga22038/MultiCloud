import fs from "node:fs";
import { randomBytes } from "node:crypto";
const root = ".secrets/gcp";
if (fs.existsSync(`${root}/app/site.env`)) {
  const current = fs.readFileSync(`${root}/app/site.env`, "utf8");
  if (!/^MARIADB_HOST=10\.20\.1\.3\r?$/m.test(current))
    throw new Error(
      "La aplicación GCP ya utiliza otro escritor. Conservar su configuración actual; no regenerar el despliegue inicial.",
    );
}
fs.mkdirSync(`${root}/db/tls`, { recursive: true });
fs.mkdirSync(`${root}/app/database-ca`, { recursive: true });
const path = `${root}/runtime.env`;
let values;
if (fs.existsSync(path)) {
  values = Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((x) => /^[A-Z_]+=/.test(x))
      .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
  );
} else {
  values = Object.fromEntries(
    [
      "MARIADB_ROOT_PASSWORD",
      "MARIADB_APP_PASSWORD",
      "MARIADB_MIGRATION_PASSWORD",
      "AUTH_SECRET",
      "BOOTSTRAP_ADMIN_PASSWORD",
    ].map((k) => [k, randomBytes(32).toString("hex")]),
  );
  fs.writeFileSync(
    path,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
}
const imageBase =
  "us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues";
const env = {
  POLARIS_IMAGE: `${imageBase}/app@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08`,
  MIGRATION_IMAGE: `${imageBase}/migrate@sha256:e4700c21e3631848b9cd841bf554f3b14296290d5c4e5653ea64d43f074196a5`,
  SITE_NAME: "gcp",
  APP_WRITES_ENABLED: "true",
  PUBLIC_DOMAIN:
    "gcp.multicloud.polarisenterprisesv.com app.multicloud.polarisenterprisesv.com",
  APP_ALLOWED_ORIGINS:
    "https://gcp.multicloud.polarisenterprisesv.com,https://app.multicloud.polarisenterprisesv.com",
  MARIADB_HOST: "10.20.1.3",
  MARIADB_SSL_SERVER_NAME: "polaris-ues-gcp-mariadb",
  MARIADB_PORT: "3306",
  MARIADB_DATABASE: "polaris_ues",
  MARIADB_APP_USER: "polaris_app",
  MARIADB_APP_PASSWORD: values.MARIADB_APP_PASSWORD,
  AUTH_SECRET: values.AUTH_SECRET,
  DATABASE_CA_DIR: "/opt/polaris-ues/database-ca",
  TLS_CERT_DIR: "/opt/polaris-ues/tls",
  ACME_WEBROOT_DIR: "/opt/polaris-ues/acme",
};
const writeEnv = (path, obj) =>
  fs.writeFileSync(
    path,
    Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
writeEnv(`${root}/app/site.env`, env);
writeEnv(`${root}/app/migration.env`, {
  MARIADB_HOST: "10.20.1.3",
  MARIADB_SSL_SERVER_NAME: "polaris-ues-gcp-mariadb",
  MARIADB_PORT: "3306",
  MARIADB_DATABASE: "polaris_ues",
  MARIADB_APP_USER: "polaris_migrate",
  MARIADB_APP_PASSWORD: values.MARIADB_MIGRATION_PASSWORD,
  MARIADB_SSL_CA_FILE: "/run/database-ca/ca.pem",
  BOOTSTRAP_ADMIN_PASSWORD: values.BOOTSTRAP_ADMIN_PASSWORD,
  SEED_DEMO_USERS: "false",
});
writeEnv(`${root}/db/database.env`, {
  MARIADB_ROOT_PASSWORD: values.MARIADB_ROOT_PASSWORD,
});
fs.writeFileSync(
  `${root}/db/initialize.sql`,
  `CREATE DATABASE IF NOT EXISTS polaris_ues CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'polaris_app'@'%' IDENTIFIED BY '${values.MARIADB_APP_PASSWORD}' REQUIRE SSL;
CREATE USER IF NOT EXISTS 'polaris_migrate'@'%' IDENTIFIED BY '${values.MARIADB_MIGRATION_PASSWORD}' REQUIRE SSL;
GRANT ALL PRIVILEGES ON polaris_ues.* TO 'polaris_migrate'@'%';
`,
  { mode: 0o600 },
);
fs.copyFileSync(
  "infra/mariadb/runtime-grants.sql",
  `${root}/db/runtime-grants.sql`,
);
console.log(
  "Credenciales independientes de GCP generadas y conservadas en .secrets/gcp. Valores ocultos.",
);
