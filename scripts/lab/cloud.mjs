import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { labDir, repo, writePrivate, checkBudget } from "./config.mjs";
import { aws, gcp, run, identity, freePlan } from "./process.mjs";
import { readOutputs } from "./terraform.mjs";
import { getHealth, waitSite } from "./local.mjs";
import { nginxConfig } from "./site-config.mjs";

export function origins(c, a, g) {
  return c.domainMode === "none"
    ? { aws: `http://${a.aws_app_ip}`, gcp: `http://${g.app_ip}` }
    : Object.fromEntries(
        ["aws", "gcp", "app"].map((s) => [s, `https://${s}.${c.domain}`]),
      );
}
export async function remote(
  c,
  target,
  script,
  { privateOutput = false } = {},
) {
  await identity(c);
  if (!["aws", "gcp", "database"].includes(target))
    throw Error("Destino desconocido.");
  const encoded = Buffer.from(script).toString("base64");
  const remotePath = `/tmp/lab-public-${randomUUID()}.sh`;
  // A file prevents docker/SSH children from consuming the remainder of a piped script.
  // Only public orchestration belongs in SSM parameters; private bundles use S3/SCP.
  const command = `umask 077; printf %s ${encoded} | base64 -d > ${remotePath}; sudo bash ${remotePath} </dev/null; result=$?; rm -f ${remotePath}; exit $result`;
  if (target !== "aws")
    return gcp(
      c,
      [
        "compute",
        "ssh",
        `lab-${c.name}-gcp-${target === "database" ? "mariadb" : "app"}`,
        "--zone=us-central1-a",
        "--tunnel-through-iap",
        `--command=${command}`,
      ],
      { capture: true, quiet: true },
    );
  const a = readOutputs(c, "aws-only");
  const parameters = path.join(labDir(c), "ssm-public.json");
  writePrivate(parameters, JSON.stringify({ commands: [command] }));
  const id = await aws(
    c,
    [
      "ssm",
      "send-command",
      "--instance-ids",
      a.aws_app_instance_id,
      "--document-name",
      "AWS-RunShellScript",
      "--parameters",
      `file://${parameters}`,
      "--query",
      "Command.CommandId",
      "--output",
      "text",
    ],
    { capture: true, quiet: true },
  );
  console.log(
    `SSM ${id}: ${target}. ${privateOutput ? "Salida privada." : "Consulta del laboratorio."}`,
  );
  for (let n = 0; n < 180; n++) {
    await new Promise((r) => setTimeout(r, 5000));
    let status;
    try {
      status = JSON.parse(
        await aws(
          c,
          [
            "ssm",
            "get-command-invocation",
            "--command-id",
            id,
            "--instance-id",
            a.aws_app_instance_id,
            "--output",
            "json",
          ],
          { capture: true, quiet: true },
        ),
      );
    } catch {
      continue;
    }
    if (["Pending", "InProgress", "Delayed"].includes(status.Status)) continue;
    if (status.Status !== "Success")
      throw Error(
        `SSM terminó ${status.Status}. Consulta el registro privado del servidor; no pegues secretos.`,
      );
    return status.StandardOutputContent.trim();
  }
  throw Error(
    `SSM ${id} sigue pendiente. Consulta su estado antes de repetir.`,
  );
}
export async function prepareAccess(c) {
  await identity(c);
  for (const suffix of ["app", "mariadb"]) {
    console.log(
      `Primer acceso a tu VM GCP ${suffix}. Revisa cualquier aviso de clave del servidor; la herramienta no lo acepta automáticamente.`,
    );
    await gcp(
      c,
      [
        "compute",
        "ssh",
        `lab-${c.name}-gcp-${suffix}`,
        "--zone=us-central1-a",
        "--tunnel-through-iap",
        "--command=true",
      ],
      { interactive: true },
    );
  }
}
export async function verifyCloud(c, record) {
  const who = await identity(c);
  await record(
    "identity",
    "pass",
    "Identidad AWS y proyecto GCP comprobados con las credenciales del alumno.",
    who,
  );
  const a = readOutputs(c, "aws-only"),
    g = readOutputs(c, "gcp-only");
  const urls = origins(c, a, g);
  for (const s of ["aws", "gcp"]) await getHealth(urls[s], s);
  await record(
    "cloud-http",
    "pass",
    "Endpoints propios responden ready con el sitio correcto.",
    urls,
  );
  for (const url of Object.values(urls)) {
    await getHealth(url);
    const r = await fetch(`${url}/api/v1/state`, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (r.status !== 401)
      throw Error("API de negocio sin sesión no devuelve 401.");
  }
  await record(
    "cloud-tls",
    c.domainMode === "none" ? "pending" : "pass",
    c.domainMode === "none"
      ? "HTTP por IP y 401 observados. HTTPS/DNS pendientes de configurar."
      : "TLS validado por el cliente y API 401 en los tres nombres propios.",
  );
  const dbs = JSON.parse(
    await aws(
      c,
      [
        "rds",
        "describe-db-instances",
        "--db-instance-identifier",
        `lab-${c.name}-primary`,
        "--query",
        "DBInstances[].{engine:Engine,status:DBInstanceStatus,public:PubliclyAccessible,multiaz:MultiAZ,groups:VpcSecurityGroups[].VpcSecurityGroupId}",
        "--output",
        "json",
      ],
      { capture: true },
    ),
  );
  const db = dbs[0];
  const groups = JSON.parse(
    await aws(
      c,
      [
        "ec2",
        "describe-security-groups",
        "--group-ids",
        ...db.groups,
        "--output",
        "json",
      ],
      { capture: true },
    ),
  );
  const appGroups = JSON.parse(
    await aws(
      c,
      [
        "ec2",
        "describe-instances",
        "--instance-ids",
        a.aws_app_instance_id,
        "--query",
        "Reservations[].Instances[].SecurityGroups[].GroupId",
        "--output",
        "json",
      ],
      { capture: true },
    ),
  );
  const rules = groups.SecurityGroups.flatMap((s) => s.IpPermissions);
  const allowed =
    rules.length > 0 &&
    rules.every(
      (r) =>
        r.IpProtocol === "tcp" &&
        r.FromPort === 3306 &&
        r.ToPort === 3306 &&
        !r.Ipv6Ranges?.length &&
        !r.PrefixListIds?.length &&
        (r.IpRanges || []).every((ip) => ip.CidrIp === "10.20.1.0/24") &&
        (r.UserIdGroupPairs || []).every(
          (p) => p.UserId === c.awsAccountId && appGroups.includes(p.GroupId),
        ),
    );
  await record(
    "rds-private",
    db.engine === "mariadb" &&
      db.status === "available" &&
      db.public === false &&
      allowed
      ? "pass"
      : "fail",
    "RDS y reglas 3306 contrastados con el SG de la aplicación y la red privada GCP.",
    db,
  );
  await record(
    "rds-multiaz",
    db.multiaz ? "pass" : "pending",
    db.multiaz
      ? "RDS reporta MultiAZ=true."
      : "RDS Single-AZ. No se cambia a pago para cumplir; resolver con el profesor.",
  );
  const tunnels = JSON.parse(
    await gcp(
      c,
      [
        "compute",
        "vpn-tunnels",
        "list",
        `--filter=name~^lab-${c.name}-aws-`,
        "--format=json(name,status)",
      ],
      { capture: true },
    ),
  );
  const router = JSON.parse(
    await gcp(
      c,
      [
        "compute",
        "routers",
        "get-status",
        `lab-${c.name}-vpn-router`,
        "--region=us-central1",
        "--format=json(result.bgpPeerStatus)",
      ],
      { capture: true },
    ),
  );
  const peers = router.result?.bgpPeerStatus || [];
  let sqlConnected = false;
  if (
    tunnels.length === 4 &&
    tunnels.every((t) => t.status === "ESTABLISHED") &&
    peers.length === 4 &&
    peers.every((p) => p.status === "UP")
  ) {
    try {
      const sql = await remote(
        c,
        "database",
        `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker run --rm --network host -v "$PWD:/work:ro" mariadb:11.4 mariadb --defaults-extra-file=/work/rds-client.cnf -NBe 'SELECT 1'\n`,
      );
      sqlConnected = sql.trim() === "1";
    } catch {
      /* A healthy control plane does not prove private SQL connectivity. */
    }
  }
  await record(
    "vpn",
    tunnels.length === 4 &&
      tunnels.every((t) => t.status === "ESTABLISHED") &&
      peers.length === 4 &&
      peers.every((p) => p.status === "UP") &&
      sqlConnected
      ? "pass"
      : "fail",
    "Cuatro túneles GCP, sesiones BGP y consulta SQL privada por TLS hacia RDS.",
    {
      tunnels,
      peers: peers.map((p) => ({ name: p.name, status: p.status })),
      sqlConnected,
    },
  );
}
export async function runtime(c, record) {
  const script = `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker compose --env-file site.env ps --format json\ndocker inspect "$(docker compose --env-file site.env ps -q app)" --format '{{.Image}}'\ndocker compose --env-file site.env exec -T nginx nginx -t 2>&1\n`;
  const a = await remote(c, "aws", script),
    g = await remote(c, "gcp", script);
  const digest = (text) => text.match(/sha256:[a-f0-9]{64}/)?.[0];
  const services = (text) =>
    text
      .split(/\r?\n/)
      .filter((s) => s.startsWith("{"))
      .map((s) => JSON.parse(s));
  const good = (text) =>
    services(text).some(
      (r) =>
        r.Service === "app" && r.State === "running" && r.Health === "healthy",
    ) &&
    services(text).some((r) => r.Service === "nginx" && r.State === "running");
  await record(
    "same-image",
    digest(a) && digest(a) === digest(g) && good(a) && good(g)
      ? "pass"
      : "fail",
    "ID de imagen transferida, contenedores y nginx -t consultados en ambas VM.",
    { aws: digest(a), gcp: digest(g) },
  );
}
export async function replica(c, record) {
  const query =
    "SELECT CONCAT(revision,':',SHA2(document,256),':',(SELECT COUNT(*) FROM polaris_ues.operations),':',(SELECT COUNT(*) FROM polaris_ues.app_users)) FROM polaris_ues.application_state WHERE id=1";
  const script = `set -euo pipefail\ncd /opt/lab-${c.name}\ndb() { docker compose --env-file database.env -f replica.yaml exec -T mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot "$@"' sh "$@"; }\nstatus=$(db -e 'SHOW SLAVE STATUS\\G')\nprintf '%s\\n' "$status" | awk '/Slave_IO_Running:|Slave_SQL_Running:|Seconds_Behind_Master:|Using_Gtid:|Last_IO_Errno:|Last_SQL_Errno:|Master_SSL_Allowed:|Master_SSL_Verify_Server_Cert:/ {print}'\ntest "$(db -NBe 'SELECT @@global.read_only')" = 1\ndb -NBe "${query}"\n`;
  const out = await remote(c, "database", script);
  const primary = await remote(
    c,
    "database",
    `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker run --rm --network host -v "$PWD:/work:ro" mariadb:11.4 mariadb --defaults-extra-file=/work/rds-client.cnf -NBe "${query}"\n`,
  );
  const signature = out.trim().split(/\r?\n/).at(-1);
  const good =
    [
      "Slave_IO_Running: Yes",
      "Slave_SQL_Running: Yes",
      "Last_IO_Errno: 0",
      "Last_SQL_Errno: 0",
      "Using_Gtid: Slave_Pos",
      "Master_SSL_Allowed: Yes",
      "Master_SSL_Verify_Server_Cert: Yes",
    ].every((s) => out.includes(s)) && signature === primary.trim();
  await record(
    "replica",
    good ? "pass" : "fail",
    "Réplica read-only y firma comparada directamente con RDS. Pausar escrituras para comparar; lag es una muestra.",
    { status: out, primarySignature: primary.trim() },
  );
}
export async function deploy(c, stage) {
  if (!["build", "database", "aws", "gcp", "tls"].includes(stage))
    throw Error("Uso: cloud deploy build|database|aws|gcp|tls");
  await identity(c);
  checkBudget(c);
  await freePlan(c);
  const dir = path.join(labDir(c), "release");
  fs.mkdirSync(dir, { recursive: true });
  if (stage === "build") {
    for (const target of ["web", "migrate"])
      await run("docker", [
        "build",
        "--target",
        target,
        "-t",
        `lab-${c.name}:${target}`,
        ".",
      ]);
    await run("docker", [
      "save",
      "-o",
      path.join(dir, "images.tar"),
      `lab-${c.name}:web`,
      `lab-${c.name}:migrate`,
    ]);
    console.log(
      "Imágenes propias construidas. Continúa con cloud deploy database.",
    );
    return;
  }
  const a = readOutputs(c, "aws-only"),
    g = readOutputs(c, "gcp-only");
  const bundle = path.join(dir, stage);
  fs.mkdirSync(bundle, { recursive: true });
  if (stage === "tls") {
    if (c.domainMode === "none")
      throw Error(
        "Configura un dominio propio o delegado antes de emitir certificados.",
      );
    for (const site of ["aws", "gcp"]) {
      console.log(
        `Emitir certificado del sitio ${site}; sus nombres DNS deben resolver a esta VM.`,
      );
      await remote(
        c,
        site,
        `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker run --rm -v "$PWD/letsencrypt:/etc/letsencrypt" -v "$PWD/acme:/var/www/acme" certbot/certbot certonly --webroot -w /var/www/acme --non-interactive --agree-tos --email '${c.gcpAccount}' --cert-name lab -d '${site}.${c.domain}' -d 'app.${c.domain}'\ninstall -m 0644 letsencrypt/live/lab/fullchain.pem tls/fullchain.pem\ninstall -m 0600 letsencrypt/live/lab/privkey.pem tls/privkey.pem\ncp nginx-https.conf nginx.conf\ndocker compose --env-file site.env up -d --force-recreate nginx\n`,
        { privateOutput: true },
      );
    }
    return;
  }
  if (!fs.existsSync(path.join(dir, "images.tar")))
    throw Error("Primero cloud deploy build.");
  // Generate new secrets once; never read the owner's runtime.env or credentials.env.
  const secretsPath = path.join(dir, "generated.json");
  if (!fs.existsSync(secretsPath))
    writePrivate(
      secretsPath,
      JSON.stringify(
        Object.fromEntries(
          ["app", "replication", "root", "auth", "admin"].map((k) => [
            k,
            randomBytes(32).toString("hex"),
          ]),
        ),
      ),
    );
  const secrets = JSON.parse(fs.readFileSync(secretsPath));
  const caResponse = await fetch(
    "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem",
    { signal: AbortSignal.timeout(20000) },
  );
  if (!caResponse.ok) throw Error("No se pudo descargar CA pública RDS.");
  writePrivate(path.join(bundle, "ca.pem"), await caResponse.text());
  const envText = (values) =>
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
  const base = `/opt/lab-${c.name}`;
  if (stage === "database") {
    const credential = JSON.parse(
      JSON.parse(
        await aws(
          c,
          [
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            a.aws_database_secret_arn,
            "--output",
            "json",
          ],
          { capture: true, quiet: true },
        ),
      ).SecretString,
    );
    writePrivate(
      path.join(bundle, "rds-client.cnf"),
      `[client]\nhost=${a.aws_database_endpoint}\nuser=${credential.username}\npassword=${JSON.stringify(credential.password)}\nssl-ca=/work/ca.pem\nssl-verify-server-cert\n`,
    );
    writePrivate(
      path.join(bundle, "bootstrap.sql"),
      `CREATE USER 'polaris_app'@'%' IDENTIFIED BY '${secrets.app}' REQUIRE SSL;\nCREATE USER 'polaris_replica'@'10.20.1.%' IDENTIFIED BY '${secrets.replication}' REQUIRE SSL;\nGRANT REPLICATION SLAVE ON *.* TO 'polaris_replica'@'10.20.1.%';\nCALL mysql.rds_set_configuration('binlog retention hours',24);\n`,
    );
    writePrivate(
      path.join(bundle, "replication.sql"),
      `CHANGE MASTER TO MASTER_HOST='${a.aws_database_endpoint}', MASTER_PORT=3306, MASTER_USER='polaris_replica', MASTER_PASSWORD='${secrets.replication}', MASTER_USE_GTID=slave_pos, MASTER_SSL=1, MASTER_SSL_CA='/work/ca.pem', MASTER_SSL_VERIFY_SERVER_CERT=1;\nSTART SLAVE;\n`,
    );
    writePrivate(
      path.join(bundle, "migration.env"),
      envText({
        MARIADB_HOST: a.aws_database_endpoint,
        MARIADB_PORT: 3306,
        MARIADB_DATABASE: "polaris_ues",
        MARIADB_APP_USER: credential.username,
        MARIADB_APP_PASSWORD: credential.password,
        MARIADB_SSL_CA_FILE: "/work/ca.pem",
        BOOTSTRAP_ADMIN_PASSWORD: secrets.admin,
        SEED_DEMO_USERS: "true",
      }),
    );
    writePrivate(
      path.join(bundle, "database.env"),
      envText({ MARIADB_ROOT_PASSWORD: secrets.root }),
    );
    writePrivate(
      path.join(bundle, "runtime-grants.sql"),
      fs.readFileSync(path.join(repo, "infra/mariadb/runtime-grants.sql")),
    );
    writePrivate(
      path.join(bundle, "replica.yaml"),
      `name: lab-${c.name}-replica\nservices:\n  mariadb:\n    image: mariadb:11.4\n    restart: unless-stopped\n    environment:\n      MARIADB_ROOT_PASSWORD: \${MARIADB_ROOT_PASSWORD}\n    command: ["--server-id=2", "--log-bin=replica-bin", "--binlog-format=ROW", "--gtid-strict-mode=ON", "--log-slave-updates=ON", "--read-only=ON"]\n    volumes: ["./mysql:/var/lib/mysql", "./ca.pem:/work/ca.pem:ro"]\n    healthcheck:\n      test: [CMD, healthcheck.sh, --connect, --innodb_initialized]\n      interval: 5s\n      timeout: 5s\n      retries: 30\n`,
    );
    writePrivate(
      path.join(bundle, "setup.sh"),
      fs
        .readFileSync(
          path.join(repo, "scripts/lab/templates/database.sh"),
          "utf8",
        )
        .replaceAll("__NAME__", c.name),
    );
  } else {
    const urls = origins(c, a, g);
    writePrivate(
      path.join(bundle, "site.env"),
      envText({
        SITE_NAME: stage,
        MARIADB_HOST: a.aws_database_endpoint,
        MARIADB_PORT: 3306,
        MARIADB_DATABASE: "polaris_ues",
        MARIADB_APP_USER: "polaris_app",
        MARIADB_APP_PASSWORD: secrets.app,
        MARIADB_SSL_CA_FILE: "/run/ca.pem",
        AUTH_SECRET: secrets.auth,
        APP_WRITES_ENABLED: "true",
        SESSION_COOKIE_SECURE: c.domainMode !== "none",
        APP_ALLOWED_ORIGINS: Object.values(urls).join(","),
      }),
    );
    writePrivate(
      path.join(bundle, "compose.yaml"),
      `name: lab-${c.name}-site\nservices:\n  app:\n    image: lab-${c.name}:web\n    restart: unless-stopped\n    env_file: [site.env]\n    volumes: ["./ca.pem:/run/ca.pem:ro"]\n${stage === "gcp" ? `    ports: ["${g.app_private_ip}:3000:3000"]\n` : ""}    healthcheck:\n      test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]\n      interval: 10s\n      timeout: 5s\n      retries: 12\n  nginx:\n    image: nginx:1.28-alpine\n    restart: unless-stopped\n    ports: ["80:80", "443:443"]\n    volumes: ["./nginx.conf:/etc/nginx/conf.d/default.conf:ro", "./tls:/etc/nginx/tls:ro", "./acme:/var/www/acme:ro"]\n    depends_on: [app]\n`,
    );
    writePrivate(path.join(bundle, "nginx.conf"), nginxConfig(c, stage, a, g));
    writePrivate(
      path.join(bundle, "nginx-https.conf"),
      nginxConfig(c, stage, a, g, true),
    );
    writePrivate(
      path.join(bundle, "setup.sh"),
      `set -euo pipefail\ncloud-init status --wait >/dev/null || { test -S /var/run/docker.sock || exit 1; }\ncd ${base}\nmkdir -p tls acme\nchmod 0644 ca.pem\ndocker load -i images.tar >/dev/null\ndocker compose --env-file site.env up -d --wait\necho 'Aplicación preparada; HTTPS pendiente si se eligió dominio.'\n`,
    );
  }
  await run(
    "tar",
    [
      "-cf",
      path.join(dir, `${stage}.tar`),
      "-C",
      bundle,
      ".",
      "-C",
      dir,
      "images.tar",
    ],
    { quiet: true },
  );
  if (stage === "aws") {
    const key = `transfer/${c.name}-runtime.tar`;
    await aws(
      c,
      [
        "s3",
        "cp",
        path.join(dir, "aws.tar"),
        `s3://${a.aws_deployment_bucket}/${key}`,
        "--sse",
        "AES256",
        "--only-show-errors",
      ],
      { quiet: true },
    );
    // EC2 role reads only its own transfer bucket. No user's AWS credentials leave the laptop.
    const script = `set -euo pipefail\ninstall -d -m 0700 ${base}\ndocker run --rm --network host -v ${base}:/work amazon/aws-cli:2.37.12 s3 cp s3://${a.aws_deployment_bucket}/${key} /work/runtime.tar --only-show-errors\ntar -xf ${base}/runtime.tar -C ${base}\nchmod 600 ${base}/site.env\nbash ${base}/setup.sh >${base}/setup-private.log 2>&1 || { echo 'Revisar setup-private.log en el servidor.'; exit 1; }\nrm -f ${base}/runtime.tar ${base}/images.tar\necho 'AWS preparado.'\n`;
    await remote(c, "aws", script, { privateOutput: true });
    await aws(
      c,
      [
        "s3",
        "rm",
        `s3://${a.aws_deployment_bucket}/${key}`,
        "--only-show-errors",
      ],
      { quiet: true },
    );
  } else {
    const vm = `lab-${c.name}-gcp-${stage === "database" ? "mariadb" : "app"}`;
    await gcp(
      c,
      [
        "compute",
        "scp",
        path.join(dir, `${stage}.tar`),
        `${vm}:lab-${c.name}-${stage}.tar`,
        "--zone=us-central1-a",
        "--tunnel-through-iap",
      ],
      { quiet: true },
    );
    const script =
      `set -euo pipefail\nbase=${base}\n` +
      (stage === "database"
        ? `test ! -e "$base/database-initialization-started" || { echo 'Base ya inicializada o intento pendiente. Revisar sin sobrescribir.'; exit 1; }\n`
        : "") +
      `install -d -m 0700 "$base"\narchive=$(find /home -maxdepth 2 -name 'lab-${c.name}-${stage}.tar' -type f -print -quit)\ntest -n "$archive"\ntar -xf "$archive" -C "$base"\nchmod 600 "$base"/*.env\nbash "$base/setup.sh" >"$base/setup-private.log" 2>&1 || { echo 'Revisar setup-private.log en el servidor.'; exit 1; }\nrm -f "$archive" "$base/images.tar"\necho 'GCP preparado.'\n`;
    await remote(c, stage === "database" ? "database" : "gcp", script, {
      privateOutput: true,
    });
  }
  console.log(
    `Etapa ${stage} terminada. Los secretos permanecen en .secrets/labs/${c.name}; no los compartas ni los captures.`,
  );
}
export async function failover(c, kind, record) {
  if (!["nginx", "dns"].includes(kind))
    throw Error("Usa cloud failover nginx|dns; solo para tus VM.");
  await identity(c);
  const urls = origins(
    c,
    readOutputs(c, "aws-only"),
    readOutputs(c, "gcp-only"),
  );
  if (kind === "dns" && !urls.app)
    throw Error("La prueba DNS requiere dominio y HTTPS configurados.");
  await getHealth(urls.aws, "aws");
  await getHealth(urls.gcp, "gcp");
  const service = kind === "nginx" ? "app" : "nginx";
  const destination = kind === "nginx" ? urls.aws : urls.app;
  const requestedAt = new Date().toISOString();
  let recovered = false,
    observedAt;
  console.log(
    `Se detendrá ${service} únicamente en tu VM AWS. RDS y VPN siguen activos. Recuperación en finally.`,
  );
  try {
    await remote(
      c,
      "aws",
      `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker compose --env-file site.env stop ${service}\n`,
    );
    await waitSite(destination, "gcp", kind === "dns" ? 240000 : 60000);
    observedAt = new Date().toISOString();
  } finally {
    await remote(
      c,
      "aws",
      `set -euo pipefail\ncd /opt/lab-${c.name}\ndocker compose --env-file site.env up -d --wait ${service}\n`,
    );
    await waitSite(destination, "aws", kind === "dns" ? 240000 : 90000);
    recovered = true;
  }
  await record(
    kind === "nginx" ? "nginx-remote" : "dns-failover",
    kind === "nginx" ? "pass" : "pending",
    kind === "nginx"
      ? "Backend GCP observado por la URL fija AWS y primario recuperado. Sin pérdida total de RDS."
      : "DNS conmutó y regresó. Falta operación de negocio, registro único y medición de RTO/RPO de datos para cerrar el criterio.",
    {
      requestedAt,
      observedAt,
      recoveredAt: new Date().toISOString(),
      recovered,
      destination,
      healthTransitionMs: Date.parse(observedAt) - Date.parse(requestedAt),
    },
  );
}
