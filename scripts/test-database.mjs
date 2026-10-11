import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
if (existsSync(".secrets/runtime.env"))
  process.loadEnvFile(".secrets/runtime.env");
const child = spawn(
  process.execPath,
  ["../node_modules/vitest/vitest.mjs", "run", "tests/db.integration.test.ts"],
  {
    cwd: "app",
    stdio: "inherit",
    env: { ...process.env, RUN_DB_TESTS: "true" },
  },
);
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
