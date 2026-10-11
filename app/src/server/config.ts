import { readFileSync } from "node:fs";
export function databaseConfig() {
  const host = process.env.MARIADB_HOST || "127.0.0.1";
  const password = process.env.MARIADB_APP_PASSWORD;
  if (!password) throw new Error("Falta MARIADB_APP_PASSWORD.");
  return {
    host,
    port: Number(process.env.MARIADB_PORT || 3307),
    user: process.env.MARIADB_APP_USER || "polaris_app",
    password,
    database: process.env.MARIADB_DATABASE || "polaris_ues",
    connectionLimit: 5,
    connectTimeout: 3000,
    acquireTimeout: 5000,
    queryTimeout: 10000,
    bigIntAsNumber: true,
    ...(process.env.MARIADB_SSL_CA_FILE
      ? {
          ssl: {
            ca: readFileSync(process.env.MARIADB_SSL_CA_FILE, "utf8"),
            servername: process.env.MARIADB_SSL_SERVER_NAME || host,
            rejectUnauthorized: true,
          },
        }
      : {}),
  };
}
export function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET requiere al menos 32 caracteres.");
  return secret;
}
