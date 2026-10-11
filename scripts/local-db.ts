/** Optional Windows development database. Does not install a Windows service. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import mariadb from "mariadb";
async function main() {
  const root = resolve(".tools/mariadb-11.4.11-winx64");
  const data = resolve(".tools/mariadb-data");
  const ini = resolve(".secrets/mariadb-local.ini");
  const config = {
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: process.env.MARIADB_ROOT_PASSWORD,
    connectTimeout: 1000,
  };
  if (!config.password || !process.env.MARIADB_APP_PASSWORD)
    throw new Error("Ejecuta npm run local:init.");
  async function connect(password = config.password) {
    return mariadb.createConnection({ ...config, password });
  }
  if (process.platform !== "win32" || !existsSync(`${root}/bin/mariadbd.exe`)) {
    throw new Error(
      "Este script necesita el ZIP oficial MariaDB 11.4.11 para Windows en .tools, verificado con SHA256. Usa Docker en otros sistemas.",
    );
  }
  if (process.argv[2] === "stop") {
    const db = await connect();
    await db.query("SHUTDOWN");
    await db.end();
    console.log("MariaDB local detenido.");
  } else {
    try {
      const db = await connect();
      await db.end();
      console.log("MariaDB local ya está disponible.");
      process.exit(0);
    } catch {
      /* Start only the private development data directory. */
    }
    const first = !existsSync(`${data}/mysql`);
    if (first) {
      mkdirSync(data, { recursive: true });
      const initialized = spawnSync(
        `${root}/bin/mariadb-install-db.exe`,
        [`--datadir=${data}`, "--port=3307"],
        { windowsHide: true, stdio: "ignore" },
      );
      if (initialized.status !== 0)
        throw new Error("No se pudo inicializar MariaDB local.");
    }
    writeFileSync(
      ini,
      `[mysqld]\nbasedir=${root.replaceAll("\\", "/")}\ndatadir=${data.replaceAll("\\", "/")}\nbind-address=127.0.0.1\nport=3307\nserver-id=1\nlog-bin=polaris-bin\nbinlog-format=ROW\ngtid-strict-mode=ON\nlog-slave-updates=ON\ncharacter-set-server=utf8mb4\ncollation-server=utf8mb4_unicode_ci\n`,
      { mode: 0o600 },
    );
    const daemon = spawn(
      `${root}/bin/mariadbd.exe`,
      [`--defaults-file=${ini}`],
      { detached: true, windowsHide: true, stdio: "ignore" },
    );
    daemon.unref();
    let db;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        db = await connect(first ? "" : config.password);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!db)
      throw new Error(
        "MariaDB no inició. Revisa el archivo de error de .tools/mariadb-data.",
      );
    if (first) {
      if (!config.password || !process.env.MARIADB_APP_PASSWORD)
        throw new Error("Ejecuta npm run local:init.");
      // Fixed local database and user names. Passwords are bound parameters, never CLI arguments.
      await db.query(
        "CREATE DATABASE IF NOT EXISTS polaris_ues CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      );
      await db.query(
        "CREATE USER IF NOT EXISTS 'polaris_app'@'127.0.0.1' IDENTIFIED BY ?",
        [process.env.MARIADB_APP_PASSWORD],
      );
      await db.query(
        "GRANT ALL PRIVILEGES ON polaris_ues.* TO 'polaris_app'@'127.0.0.1'",
      );
      await db.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [
        config.password,
      ]);
    }
    await db.end();
    console.log("MariaDB local disponible en 127.0.0.1:3307.");
  }
}
main().catch(() => {
  console.error(
    "No se pudo iniciar o detener MariaDB local. Revisa el entorno y el archivo de error en .tools/mariadb-data.",
  );
  process.exitCode = 1;
});
