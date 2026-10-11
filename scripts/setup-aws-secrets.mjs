import fs from "node:fs";
import { randomBytes } from "node:crypto";
const readEnv = (path) =>
  Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((x) => /^[A-Z_]+=/.test(x))
      .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
  );
const root = ".secrets/aws";
const gcp = readEnv(".secrets/gcp/runtime.env");
const connection = JSON.parse(
  fs.readFileSync(`${root}/connection.json`, "utf8"),
);
const credentials = JSON.parse(
  fs.readFileSync(`${root}/rds-master.json`, "utf8"),
);
fs.mkdirSync(`${root}/bundle/database-ca`, { recursive: true });
const runtimePath = `${root}/runtime.env`;
const runtime = fs.existsSync(runtimePath)
  ? readEnv(runtimePath)
  : { MARIADB_REPLICATION_PASSWORD: randomBytes(32).toString("hex") };
const writeEnv = (path, values) =>
  fs.writeFileSync(
    path,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
writeEnv(runtimePath, runtime);
writeEnv(`${root}/bundle/site.env`, {
  POLARIS_IMAGE:
    "117425831688.dkr.ecr.us-east-2.amazonaws.com/polaris-ues@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08",
  SITE_NAME: "aws",
  APP_WRITES_ENABLED: "false",
  ACME_PEER_IP: "34.122.222.237",
  PUBLIC_DOMAIN:
    "aws.multicloud.polarisenterprisesv.com app.multicloud.polarisenterprisesv.com",
  APP_ALLOWED_ORIGINS:
    "https://aws.multicloud.polarisenterprisesv.com,https://app.multicloud.polarisenterprisesv.com,https://gcp.multicloud.polarisenterprisesv.com",
  MARIADB_HOST: connection.host,
  MARIADB_SSL_SERVER_NAME: connection.host,
  MARIADB_PORT: "3306",
  MARIADB_DATABASE: "polaris_ues",
  MARIADB_APP_USER: "polaris_app",
  MARIADB_APP_PASSWORD: gcp.MARIADB_APP_PASSWORD,
  AUTH_SECRET: gcp.AUTH_SECRET,
  DATABASE_CA_DIR: "/opt/polaris-ues/database-ca",
  TLS_CERT_DIR: "/opt/polaris-ues/tls",
  ACME_WEBROOT_DIR: "/opt/polaris-ues/acme",
});
// Option files keep database passwords out of process arguments and SSM logs.
const optionValue = (value) => JSON.stringify(value).replace(/\\u0000/g, "");
fs.writeFileSync(
  `${root}/bundle/rds-client.cnf`,
  `[client]\nhost=${connection.host}\nuser=${credentials.username}\npassword=${optionValue(credentials.password)}\nssl-ca=/opt/polaris-ues/database-ca/ca.pem\nssl-verify-server-cert\n`,
  { mode: 0o600 },
);
fs.writeFileSync(
  `${root}/bundle/bootstrap.sql`,
  `CREATE USER IF NOT EXISTS 'polaris_app'@'%' IDENTIFIED BY '${gcp.MARIADB_APP_PASSWORD}' REQUIRE SSL;\nCREATE USER IF NOT EXISTS 'polaris_replica'@'10.20.1.%' IDENTIFIED BY '${runtime.MARIADB_REPLICATION_PASSWORD}' REQUIRE SSL;\nGRANT REPLICATION SLAVE ON *.* TO 'polaris_replica'@'10.20.1.%';\nCALL mysql.rds_set_configuration('binlog retention hours',24);\n`,
  { mode: 0o600 },
);
fs.copyFileSync("infra/compose/site.yaml", `${root}/bundle/site.yaml`);
fs.copyFileSync(
  "infra/nginx/site.conf.template",
  `${root}/bundle/site.conf.template`,
);
fs.copyFileSync(
  "infra/mariadb/runtime-grants.sql",
  `${root}/bundle/runtime-grants.sql`,
);
const gcpSite = readEnv(".secrets/gcp/app/site.env");
writeEnv(`${root}/gcp-site.env`, {
  ...gcpSite,
  ACME_PEER_IP: "18.227.139.179",
  MARIADB_HOST: connection.host,
  MARIADB_SSL_SERVER_NAME: connection.host,
  APP_ALLOWED_ORIGINS:
    "https://aws.multicloud.polarisenterprisesv.com,https://app.multicloud.polarisenterprisesv.com,https://gcp.multicloud.polarisenterprisesv.com",
});
console.log(
  "Configuración privada de AWS preparada. Credenciales ocultas; escrituras deshabilitadas hasta el cambio controlado.",
);
