import fs from "node:fs";
const readEnv = (path) =>
  Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((x) => /^[A-Z_]+=/.test(x))
      .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
  );
const aws = readEnv(".secrets/aws/runtime.env");
const gcp = readEnv(".secrets/gcp/runtime.env");
const { host } = JSON.parse(
  fs.readFileSync(".secrets/aws/connection.json", "utf8"),
);
const gtid = fs.readFileSync(".secrets/aws/export/rds-gtid.txt", "utf8").trim();
if (!/^\d+-\d+-\d+(,\d+-\d+-\d+)*$/.test(gtid))
  throw new Error("Posición GTID inválida; no configurar réplica.");
const root = ".secrets/aws/gcp-replica";
fs.mkdirSync(root, { recursive: true });
fs.copyFileSync(".secrets/aws/export/rds.sql.gz", `${root}/rds.sql.gz`);
fs.copyFileSync(
  ".secrets/aws/export/rds-integrity.txt",
  `${root}/rds-integrity.txt`,
);
fs.copyFileSync(".secrets/aws/bundle/database-ca/ca.pem", `${root}/rds-ca.pem`);
fs.copyFileSync("infra/compose/gcp-replica.yaml", `${root}/compose.yaml`);
fs.writeFileSync(
  `${root}/replication.sql`,
  `SET SESSION sql_log_bin=0;
CREATE USER IF NOT EXISTS 'polaris_app'@'%' IDENTIFIED BY '${gcp.MARIADB_APP_PASSWORD}' REQUIRE SSL;
${fs.readFileSync("infra/mariadb/runtime-grants.sql", "utf8")}
SET GLOBAL gtid_slave_pos='${gtid}';
CHANGE MASTER TO MASTER_HOST='${host}', MASTER_PORT=3306, MASTER_USER='polaris_replica', MASTER_PASSWORD='${aws.MARIADB_REPLICATION_PASSWORD}', MASTER_USE_GTID=slave_pos, MASTER_SSL=1, MASTER_SSL_CA='/etc/mariadb/tls/rds-ca.pem', MASTER_SSL_VERIFY_SERVER_CERT=1, MASTER_CONNECT_RETRY=5, MASTER_HEARTBEAT_PERIOD=1;
START SLAVE;
`,
  { mode: 0o600 },
);
console.log("Paquete privado de réplica preparado con GTID y validación TLS.");
