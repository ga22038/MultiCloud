import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { repo, labDir, writePrivate, cleanEnvironment } from "./config.mjs";
import { run } from "./process.mjs";

export function prepareLocal(c) {
  const dir = labDir(c),
    marker = path.join(dir, "local.json");
  const settings = JSON.stringify({
    name: c.name,
    port: c.localPort,
    databasePort: c.databasePort,
  });
  if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8") !== settings)
    throw Error(
      "No cambies puertos de un laboratorio ya preparado. Usa otro nombre o conserva los puertos originales.",
    );
  let compose = fs.readFileSync(path.join(repo, "compose.yaml"), "utf8");
  compose = compose
    .replace("name: polaris-ues", `name: lab-${c.name}`)
    .replaceAll("image: polaris-ues:local", `image: lab-${c.name}:local`)
    .replaceAll(
      "context: .",
      `context: ${JSON.stringify(repo.replaceAll("\\", "/"))}`,
    )
    .replace("127.0.0.1:8080:8080", `127.0.0.1:${c.localPort}:8080`)
    .replace("127.0.0.1:3307:3306", `127.0.0.1:${c.databasePort}:3306`)
    .replace(
      "./infra/nginx/local.conf",
      repo.replaceAll("\\", "/") + "/infra/nginx/local.conf",
    );
  writePrivate(path.join(dir, "compose.yaml"), compose);
  const envPath = path.join(dir, "runtime.env");
  if (!fs.existsSync(envPath)) {
    const secret = () => randomBytes(32).toString("hex");
    const values = {
      MARIADB_DATABASE: "polaris_ues",
      MARIADB_APP_USER: "polaris_app",
      MARIADB_APP_PASSWORD: secret(),
      MARIADB_ROOT_PASSWORD: secret(),
      AUTH_SECRET: secret(),
      BOOTSTRAP_ADMIN_PASSWORD: secret(),
      SEED_DEMO_USERS: "true",
      SESSION_COOKIE_SECURE: "false",
      APP_ALLOWED_ORIGINS: `http://localhost:${c.localPort},http://127.0.0.1:${c.localPort}`,
    };
    writePrivate(
      envPath,
      Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
    );
  }
  writePrivate(marker, settings);
  return dir;
}
export function compose(c, args, options = {}) {
  const dir = prepareLocal(c);
  const env = cleanEnvironment();
  // Shell variables override --env-file in Compose. Never inherit another lab's secrets.
  for (const key of Object.keys(env))
    if (/^(MARIADB_|AUTH_|APP_|BOOTSTRAP_|SEED_|SESSION_|COMPOSE_)/.test(key))
      delete env[key];
  return run(
    "docker",
    [
      "compose",
      "-p",
      `lab-${c.name}`,
      "--env-file",
      path.join(dir, "runtime.env"),
      "-f",
      path.join(dir, "compose.yaml"),
      ...args,
    ],
    { ...options, env },
  );
}
export async function getHealth(origin, expected) {
  const r = await fetch(`${origin}/api/health/ready`, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const b = await r.json();
  if (
    r.status !== 200 ||
    b.status !== "ready" ||
    (expected && b.site !== expected)
  )
    throw Error(
      `Salud: se esperaba ${expected || "ready"}; se recibió HTTP ${r.status}, site=${String(b.site).slice(0, 30)}.`,
    );
  return { http: r.status, site: b.site };
}
export async function waitSite(origin, site, timeout = 90000) {
  const start = Date.now();
  do {
    try {
      return {
        ...(await getHealth(origin, site)),
        observedAfterMs: Date.now() - start,
      };
    } catch {
      /* Retry during the measured transition. */
    }
    await new Promise((r) => setTimeout(r, 2000));
  } while (Date.now() - start < timeout);
  throw Error(`No se observó ${site} dentro de ${timeout / 1000}s.`);
}
export async function verifyLocal(c, record, failover = false) {
  const origin = `http://127.0.0.1:${c.localPort}`;
  const ps = await compose(c, ["ps", "-a", "--format", "json"], {
    capture: true,
  });
  const rows = ps.trim().startsWith("[")
    ? JSON.parse(ps)
    : ps
        .split(/\r?\n/)
        .filter(Boolean)
        .map((s) => JSON.parse(s));
  for (const s of ["mariadb", "nginx", "app-primary", "app-backup"])
    if (
      !rows.some(
        (r) =>
          r.Service === s && r.State === "running" && r.Health === "healthy",
      )
    )
      throw Error(`Servicio local ${s} no saludable.`);
  if (
    !rows.some(
      (r) =>
        r.Service === "migrate" &&
        r.State === "exited" &&
        Number(r.ExitCode) === 0,
    )
  )
    throw Error("La migración no terminó correctamente con código 0.");
  await record(
    "local-containers",
    "pass",
    "Cuatro servicios running/healthy y migración Exited(0) en el proyecto del alumno.",
  );
  await waitSite(origin, "aws-lab");
  const state = await fetch(`${origin}/api/v1/state`, {
    signal: AbortSignal.timeout(10000),
  });
  if (state.status !== 401) throw Error("La API sin sesión no devolvió 401.");
  await record(
    "local-api",
    "pass",
    "Ready aws-lab y API de negocio 401 sin sesión.",
  );
  if (!failover) return;
  const requestedAt = new Date().toISOString();
  let backup, restored, failure;
  try {
    await compose(c, ["stop", "app-primary"]);
    backup = await waitSite(origin, "gcp-lab");
  } catch (e) {
    failure = e;
  } finally {
    // Recovery is attempted even after a failed probe or partial stop.
    await compose(c, ["start", "app-primary"]);
    restored = await waitSite(origin, "aws-lab");
  }
  if (failure) throw failure;
  await record(
    "local-failover",
    "pass",
    "aws-lab → gcp-lab → aws-lab; solo aplicación local, sin réplica cloud ni RPO medido.",
    { requestedAt, recoveredAt: new Date().toISOString(), backup, restored },
  );
}
