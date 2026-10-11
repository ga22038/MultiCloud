import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
process.loadEnvFile(".secrets/runtime.env");
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  HOSTNAME: "127.0.0.1",
  PORT: process.env.PORT || "3000",
};
delete env.MARIADB_ROOT_PASSWORD;
delete env.BOOTSTRAP_ADMIN_PASSWORD;
delete env.MARIADB_MIGRATION_USER;
delete env.MARIADB_MIGRATION_PASSWORD;
for (const key of Object.keys(env))
  if (/^(GITHUB_|GH_|VERCEL_|AWS_|GOOGLE_|GCP_|AZURE_|ARM_|OPENAI_)/.test(key))
    delete env[key];
const mode = process.argv[2] || "dev";
let args;
if (mode === "start") {
  const server = "app/.next/standalone/app/server.js";
  if (!existsSync(server))
    throw new Error("Ejecuta npm run build antes de npm start.");
  cpSync("app/.next/static", "app/.next/standalone/app/.next/static", {
    recursive: true,
  });
  cpSync("app/public", "app/.next/standalone/app/public", { recursive: true });
  args = [server];
} else
  args = [
    "node_modules/next/dist/bin/next",
    "dev",
    "app",
    "--hostname",
    "127.0.0.1",
    "--port",
    env.PORT,
  ];
const child = spawn(process.execPath, args, { stdio: "inherit", env });
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
