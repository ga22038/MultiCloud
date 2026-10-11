import "server-only";
import mariadb, { type Pool } from "mariadb";
import { databaseConfig } from "./config";
const globalDb = globalThis as typeof globalThis & { polarisPool?: Pool };
export function database() {
  return (globalDb.polarisPool ??= mariadb.createPool(databaseConfig()));
}
