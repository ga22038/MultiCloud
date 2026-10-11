import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
mkdirSync(".secrets", { recursive: true });
const target = ".secrets/runtime.env";
const current = existsSync(target) ? readFileSync(target, "utf8") : "";
const existing = new Set(
  current.split(/\r?\n/).map((line) => line.split("=")[0]),
);
const secret = () => randomBytes(32).toString("hex");
const defaults = {
  MARIADB_HOST: "127.0.0.1",
  MARIADB_PORT: "3307",
  MARIADB_DATABASE: "polaris_ues",
  MARIADB_APP_USER: "polaris_app",
  MARIADB_APP_PASSWORD: secret(),
  MARIADB_ROOT_PASSWORD: secret(),
  AUTH_SECRET: secret(),
  BOOTSTRAP_ADMIN_PASSWORD: secret(),
  SEED_DEMO_USERS: "true",
  SESSION_COOKIE_SECURE: "false",
  SITE_NAME: "local",
  APP_ALLOWED_ORIGINS:
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080",
};
const additions = Object.entries(defaults)
  .filter(([key]) => !existing.has(key))
  .map(([key, value]) => `${key}=${value}`);
if (additions.length)
  writeFileSync(
    target,
    current +
      (current && !current.endsWith("\n") ? "\n" : "") +
      additions.join("\n") +
      "\n",
    { mode: 0o600 },
  );
console.log(
  "Entorno preparado en .secrets/runtime.env. Usuario inicial: admin. La contraseña está en BOOTSTRAP_ADMIN_PASSWORD; no la publiques.",
);
