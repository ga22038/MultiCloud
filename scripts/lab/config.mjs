import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const ownerMarkers = [
  "117425831688",
  "project-dba46330-c40e-432b-9ad",
  "developerengineer545@gmail.com",
  "polarisenterprisesv.com",
  "18.227.139.179",
  "34.122.222.237",
  "i-045241f9bd25d85b2",
];
const fields = new Set([
  "version",
  "name",
  "localPort",
  "databasePort",
  "awsProfile",
  "awsAccountId",
  "gcpAccount",
  "gcpProjectId",
  "domainMode",
  "domain",
  "budgetReviewedOn",
  "gcpTrialExpiresOn",
]);
export function validateConfig(input, cloud = false) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("La configuración debe ser un objeto JSON.");
  for (const key of Object.keys(input))
    if (!fields.has(key))
      throw Error(
        `Campo no permitido: ${key}. No pongas contraseñas ni tokens en lab.json.`,
      );
  const c = { ...input };
  if (c.version !== 1 || !/^[a-z][a-z0-9-]{2,17}$/.test(c.name || ""))
    throw Error(
      "Usa version 1 y un nombre de 3 a 18 letras minúsculas, números o guiones.",
    );
  if (["polaris-ues", "multicloudto-practica"].includes(c.name))
    throw Error("Elige un nombre nuevo para tu laboratorio.");
  for (const key of ["localPort", "databasePort"])
    if (!Number.isInteger(c[key]) || c[key] < 1024 || c[key] > 65535)
      throw Error(`${key}: puerto entre 1024 y 65535.`);
  if (c.localPort === c.databasePort)
    throw Error("Los puertos deben ser distintos.");
  for (const key of [
    "awsProfile",
    "awsAccountId",
    "gcpAccount",
    "gcpProjectId",
    "domain",
    "budgetReviewedOn",
    "gcpTrialExpiresOn",
  ])
    if (typeof c[key] !== "string")
      throw Error(`Falta el campo de texto ${key}.`);
  if (!["none", "delegated", "own"].includes(c.domainMode))
    throw Error("domainMode debe ser none, delegated u own.");
  if (c.domainMode === "none" && c.domain)
    throw Error("Deja domain vacío al elegir sin dominio.");
  if (
    c.domainMode !== "none" &&
    (!/^(?=.{1,180}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      c.domain,
    ) ||
      /^https?:/.test(c.domain))
  )
    throw Error(
      "Escribe la zona DNS sin https ni rutas, por ejemplo alumno1.ejemplo.edu.",
    );
  // A delegated child of the owner's domain is allowed; its parent zone is not.
  if (
    ["polarisenterprisesv.com", "multicloud.polarisenterprisesv.com"].includes(
      c.domain,
    )
  )
    throw Error(
      "Usa tu dominio o una subzona exclusiva delegada; no la zona del propietario.",
    );
  if (
    [c.awsAccountId, c.gcpProjectId, c.gcpAccount].some((v) =>
      ownerMarkers.includes(v),
    )
  )
    throw Error(
      "Esta ruta es para cuentas propias. No admite las identidades del propietario.",
    );
  if (cloud) {
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(c.awsProfile) ||
      c.awsProfile === "default" ||
      c.awsProfile === "polaris-ues"
    )
      throw Error(
        "Define un perfil AWS propio con nombre explícito (no default ni polaris-ues).",
      );
    if (!/^\d{12}$/.test(c.awsAccountId))
      throw Error("Falta tu ID AWS de 12 dígitos.");
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(c.gcpProjectId))
      throw Error("Falta tu project ID de GCP.");
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(c.gcpAccount))
      throw Error("Falta tu cuenta Google.");
  }
  return c;
}
export function loadConfig(filename = "lab.json", cloud = false) {
  return validateConfig(
    JSON.parse(
      fs
        .readFileSync(path.resolve(repo, filename), "utf8")
        .replace(/^\uFEFF/, ""),
    ),
    cloud,
  );
}
export const labDir = (c) => path.join(repo, ".secrets", "labs", c.name);
export function writePrivate(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value, { mode: 0o600 });
}
export function cleanEnvironment(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env))
    if (/^(AWS_|GOOGLE_|GCLOUD_|CLOUDSDK_|TF_)/.test(key)) delete env[key];
  return env;
}
export function checkBudget(c, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  if (c.budgetReviewedOn !== day)
    throw Error(
      `Revisa hoy créditos, servicios, facturación y vencimiento de GCP; escribe budgetReviewedOn: ${day} (UTC).`,
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(c.gcpTrialExpiresOn) ||
    !Number.isFinite(Date.parse(c.gcpTrialExpiresOn)) ||
    new Date(c.gcpTrialExpiresOn).toISOString().slice(0, 10) !==
      c.gcpTrialExpiresOn ||
    c.gcpTrialExpiresOn <= day
  )
    throw Error(
      "La fecha de fin de prueba GCP falta o ya venció. No se activa un plan de pago.",
    );
}
