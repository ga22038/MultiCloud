import { beforeAll, afterAll, describe, expect, it } from "vitest";
import mariadb, { type Connection } from "mariadb";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { database } from "../src/server/database";
import {
  executeOperation,
  findOperation,
  loadState,
} from "../src/server/repository";
import type { User } from "../src/server/auth";
import type { Operation } from "../src/commands";

// Never run against the application's database. Each run creates its own schema and user.
describe.skipIf(process.env.RUN_DB_TESTS !== "true")(
  "MariaDB transaction integration",
  () => {
    const name = `polaris_test_${process.pid}`;
    const username = `test_${process.pid}`;
    let root: Connection;
    let user: User;
    beforeAll(async () => {
      const password = randomBytes(32).toString("hex");
      root = await mariadb.createConnection({
        host: process.env.MARIADB_HOST || "127.0.0.1",
        port: Number(process.env.MARIADB_PORT || 3307),
        user: "root",
        password: process.env.MARIADB_ROOT_PASSWORD,
      });
      await root.query(`CREATE DATABASE ${name} CHARACTER SET utf8mb4`);
      await root.query(`CREATE USER '${username}'@'%' IDENTIFIED BY ?`, [
        password,
      ]);
      await root.query(
        `GRANT ALL PRIVILEGES ON ${name}.* TO '${username}'@'%'`,
      );
      process.env.MARIADB_DATABASE = name;
      process.env.MARIADB_APP_USER = username;
      process.env.MARIADB_APP_PASSWORD = password;
      const setup = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          fileURLToPath(new URL("../scripts/setup-db.ts", import.meta.url)),
        ],
        { env: process.env, windowsHide: true, stdio: "pipe" },
      );
      if (setup.status !== 0) throw new Error("Test database setup failed.");
      user = (
        await database().query(
          "SELECT id, name, role FROM app_users WHERE username = 'admin'",
        )
      )[0];
    });
    afterAll(async () => {
      if (!root) return;
      await database().end();
      await root.query(`DROP DATABASE IF EXISTS ${name}`);
      await root.query(`DROP USER IF EXISTS '${username}'@'%'`);
      await root.end();
    });
    const operation = async (suffix: string): Promise<Operation> => ({
      id: randomUUID(),
      expectedRevision: (await loadState()).revision,
      command: {
        type: "addWarehouse",
        args: [{ name: `TEST ${suffix}`, city: "San Salvador" }],
      },
    });
    it("replays identical operations once and rejects altered reuse", async () => {
      const request = await operation("idempotent");
      const first = await executeOperation(user, request);
      const replay = await executeOperation(user, request);
      expect(first.replayed).toBe(false);
      expect(replay.replayed).toBe(true);
      expect(replay.state.revision).toBe(first.state.revision);
      expect(
        replay.state.warehouses.filter((row) => row.name === "TEST idempotent"),
      ).toHaveLength(1);
      await expect(
        executeOperation(user, {
          ...request,
          command: {
            type: "addWarehouse",
            args: [{ name: "Changed", city: "UES" }],
          },
        }),
      ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
      const recovered = await findOperation(request.id, user.id);
      expect(recovered.operation.id).toBe(request.id);
      expect(() => JSON.stringify(recovered)).not.toThrow();
      await expect(
        findOperation(request.id, randomUUID()),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("serializes competing writes and rejects a stale revision atomically", async () => {
      const a = await operation("race-a");
      const b = await operation("race-b");
      const results = await Promise.allSettled([
        executeOperation(user, a),
        executeOperation(user, b),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({
        status: 409,
        code: "REVISION_CONFLICT",
      });
      expect((await loadState()).revision).toBe(a.expectedRevision + 1);
    });
    it("rolls back forbidden commands without a success record or state change", async () => {
      const request = await operation("restricted");
      await expect(
        executeOperation({ ...user, role: "Customer" }, request),
      ).rejects.toMatchObject({ status: 403 });
      expect((await loadState()).revision).toBe(request.expectedRevision);
      const rows = await database().query(
        "SELECT id FROM operations WHERE id = ?",
        [request.id],
      );
      expect(rows).toHaveLength(0);
    });
  },
);
