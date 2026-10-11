import mariadb from "mariadb";
import { randomUUID } from "node:crypto";
import { databaseConfig } from "../src/server/config";
import { hashPassword } from "../src/server/crypto";
import { createDemo } from "../src/seed";
const runtimeConfig = databaseConfig();
const pool = mariadb.createPool({
  ...runtimeConfig,
  user: process.env.MARIADB_MIGRATION_USER || runtimeConfig.user,
  password: process.env.MARIADB_MIGRATION_PASSWORD || runtimeConfig.password,
});
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_users (
    id CHAR(36) PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL, password_hash VARCHAR(180) NOT NULL,
    role ENUM('Customer','Logística','Facturación','Administrador') NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS application_state (
    id TINYINT PRIMARY KEY, revision BIGINT NOT NULL, document JSON NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT one_state CHECK (id = 1)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operations (
    id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL,
    revision BIGINT NOT NULL, command_type VARCHAR(40) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (user_id) REFERENCES app_users(id), INDEX user_operations (user_id, created_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS login_attempts (
    bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL, window_start DATETIME NOT NULL
  ) ENGINE=InnoDB`);
  const current = await pool.query(
    "SELECT id FROM application_state WHERE id = 1",
  );
  if (!current[0])
    await pool.query(
      "INSERT IGNORE INTO application_state (id, revision, document) VALUES (1, 0, ?)",
      [JSON.stringify(createDemo())],
    );
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password || password.length < 16)
    throw new Error(
      "Configura BOOTSTRAP_ADMIN_PASSWORD de al menos 16 caracteres.",
    );
  const users = [
    ["admin", "Administrador Polaris UES", "Administrador"],
    ...(process.env.SEED_DEMO_USERS === "true"
      ? [
          ["customer", "Pedidos UES", "Customer"],
          ["logistica", "Logística UES", "Logística"],
          ["facturacion", "Facturación UES", "Facturación"],
        ]
      : []),
  ];
  for (const [username, name, role] of users) {
    const found = await pool.query(
      "SELECT id FROM app_users WHERE username = ?",
      [username],
    );
    if (!found[0])
      await pool.query(
        "INSERT IGNORE INTO app_users (id, username, name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
        [randomUUID(), username, name, role, hashPassword(password)],
      );
  }
  console.log(
    "Esquema y usuarios iniciales preparados. Los datos existentes se conservaron.",
  );
} catch {
  console.error(
    "No se pudo preparar MariaDB. Revisa conectividad y variables locales.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
