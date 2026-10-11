import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
if (process.platform !== "win32")
  throw new Error("Usa Docker para la base local en Linux o macOS.");
const base = "https://archive.mariadb.org/mariadb-11.4.11/winx64-packages";
const filename = "mariadb-11.4.11-winx64.zip";
mkdirSync(".tools", { recursive: true });
const checksumResponse = await fetch(`${base}/sha256sums.txt`);
if (!checksumResponse.ok)
  throw new Error("No se pudo obtener el checksum oficial.");
const expected = (await checksumResponse.text())
  .split(/\r?\n/)
  .find((line) => line.trim().endsWith(filename))
  ?.split(/\s+/)[0];
if (!expected) throw new Error("No se encontró el checksum del ZIP oficial.");
const target = resolve(".tools/mariadb.zip");
if (!existsSync(target)) {
  const response = await fetch(`${base}/${filename}`);
  if (!response.ok)
    throw new Error("No se pudo descargar MariaDB desde el archivo oficial.");
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}
if (
  createHash("sha256").update(readFileSync(target)).digest("hex") !== expected
)
  throw new Error("Checksum incorrecto. No se ejecutará este archivo.");
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
if (!existsSync(".tools/mariadb-11.4.11-winx64/bin/mariadbd.exe")) {
  const extracted = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath ${quote(target)} -DestinationPath ${quote(resolve(".tools"))}`,
    ],
    { windowsHide: true, stdio: "inherit" },
  );
  if (extracted.status !== 0)
    throw new Error("No se pudo extraer el ZIP verificado.");
}
console.log(
  "MariaDB portátil preparado y verificado con SHA256. No se instaló ningún servicio de Windows.",
);
