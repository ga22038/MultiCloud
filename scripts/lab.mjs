import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  repo,
  loadConfig,
  validateConfig,
  labDir,
  writePrivate,
} from "./lab/config.mjs";
import { run, identity, freePlan, gcp } from "./lab/process.mjs";
import { prepareLocal, compose, verifyLocal } from "./lab/local.mjs";
import { generateTerraform, terraform } from "./lab/terraform.mjs";
import {
  verifyCloud,
  replica,
  runtime,
  deploy,
  failover,
  prepareAccess,
} from "./lab/cloud.mjs";

const rubric = JSON.parse(
  fs.readFileSync(path.join(repo, "app/src/learning/rubric.json"), "utf8"),
);
export function reporter(c) {
  const directory = path.join(labDir(c), "evidence");
  fs.mkdirSync(directory, { recursive: true });
  const runId = randomUUID();
  return async (id, status, summary, detail = {}) => {
    if (
      !rubric.some((r) => r.id === id) ||
      !["pass", "fail", "pending"].includes(status)
    )
      throw Error("Resultado de rúbrica inválido.");
    const entry = {
      id,
      status,
      summary,
      detail,
      observedAt: new Date().toISOString(),
      runId,
      source: "cli",
      accounts: { aws: c.awsAccountId, gcp: c.gcpProjectId },
    };
    writePrivate(
      path.join(directory, `${id}.json`),
      JSON.stringify(entry, null, 2),
    );
    writePrivate(
      path.join(directory, "history", `${runId}-${id}.json`),
      JSON.stringify(entry, null, 2),
    );
    console.log(`${status.toUpperCase()} ${id}: ${summary}`);
  };
}
export function report(c) {
  const directory = path.join(labDir(c), "evidence");
  const results = rubric.map((r) => {
    const f = path.join(directory, `${r.id}.json`);
    return {
      ...r,
      ...(fs.existsSync(f) &&
      (r.scope === "local" ||
        (() => {
          const e = JSON.parse(fs.readFileSync(f, "utf8"));
          return (
            e.accounts?.aws === c.awsAccountId &&
            e.accounts?.gcp === c.gcpProjectId
          );
        })())
        ? JSON.parse(fs.readFileSync(f, "utf8"))
        : {
            status: "pending",
            summary: "Sin evidencia de ejecución del alumno.",
            observedAt: null,
          }),
    };
  });
  const data = {
    version: 1,
    lab: c.name,
    generatedAt: new Date().toISOString(),
    accounts: { aws: c.awsAccountId, gcp: c.gcpProjectId },
    scope:
      "Resultados de este alumno. No certifican la rúbrica completa ni sustituyen la revisión del profesor.",
    results,
  };
  const filename = path.join(labDir(c), "informe.json");
  writePrivate(filename, JSON.stringify(data, null, 2));
  writePrivate(
    path.join(labDir(c), "informe.md"),
    `# Informe del laboratorio ${c.name}\n\nFecha: ${data.generatedAt}\n\n${data.scope}\n\n` +
      results
        .map(
          (r) =>
            `## ${r.title}\n\nEstado: ${r.status}. ${r.summary}\n\nObservado: ${r.observedAt || "no ejecutado"}.\n\nCriterio: ${r.expected}\n\nDefensa: ${r.question}\n`,
        )
        .join("\n"),
  );
  console.log(
    `Informe: ${filename}\nImporta este JSON en /aprender. ${results.filter((r) => r.status === "pass").length}/${results.length} comprobaciones con resultado pass; revisa alcance y fecha de cada una.`,
  );
  return data;
}
async function main(args) {
  let configFile = "lab.json";
  const ci = args.indexOf("--config");
  if (ci !== -1) {
    configFile = args[ci + 1];
    if (!configFile) throw Error("Falta ruta después de --config.");
    args.splice(ci, 2);
  }
  const [command, action, stage] = args;
  if (!command || command === "help") {
    console.log(
      `Laboratorio personal (desde la raíz del clon)\n\nnpm run lab -- init\nnpm run lab -- doctor\nnpm run lab -- local up|test|failover|status|down\nnpm run lab -- cloud identity|prepare|test|replica|runtime|enable-apis\nnpm run lab -- terraform gcp-only|aws-only|vpn-only init|validate|plan|apply|outputs\nnpm run lab -- cloud deploy build|database|aws|gcp|tls\nnpm run lab -- report\n\nConfiguración: lab.json. Puedes elegir --config ruta.json. Manual: docs/laboratorio-personal.md.\nNo pegues credenciales en la web o en lab.json. Usa las CLI oficiales con tu identidad.`,
    );
    return;
  }
  if (command === "init") {
    const filename = path.resolve(repo, configFile);
    if (!fs.existsSync(filename)) {
      const example = JSON.parse(
        fs.readFileSync(path.join(repo, "lab.example.json")),
      );
      const ni = args.indexOf("--name");
      if (ni !== -1) example.name = args[ni + 1];
      validateConfig(example);
      writePrivate(filename, JSON.stringify(example, null, 2));
    }
    const c = loadConfig(configFile);
    prepareLocal(c);
    console.log(
      `Configuración: ${filename}\nLaboratorio lab-${c.name}; URL local http://localhost:${c.localPort}/aprender\nSecretos nuevos en .secrets/labs/${c.name}/runtime.env. No se copió ninguna credencial del propietario.`,
    );
    return;
  }
  const c = loadConfig(
    configFile,
    command === "cloud" || command === "terraform",
  );
  const record = reporter(c);
  if (command === "doctor") {
    for (const [p, a] of [
      ["node", ["--version"]],
      ["git", ["--version"]],
      ["docker", ["version", "--format", "{{.Server.Version}}"]],
      ["docker", ["compose", "version"]],
    ])
      await run(p, a);
    await compose(c, ["config", "--quiet"]);
    console.log(
      "Herramientas locales listas. AWS CLI, gcloud y Terraform se necesitan en la etapa cloud.",
    );
  } else if (command === "local") {
    if (action === "up") await compose(c, ["up", "--build", "-d", "--wait"]);
    else if (action === "down") await compose(c, ["down"]);
    else if (action === "status") await compose(c, ["ps", "-a"]);
    else if (["test", "failover"].includes(action)) {
      for (const id of [
        "local-containers",
        "local-api",
        ...(action === "failover" ? ["local-failover"] : []),
      ])
        await record(
          id,
          "pending",
          "Prueba iniciada; todavía sin resultado de esta ejecución.",
        );
      try {
        await verifyLocal(c, record, action === "failover");
      } catch (e) {
        await record(
          action === "failover" ? "local-failover" : "local-containers",
          "fail",
          e.message,
        );
        throw e;
      }
    } else throw Error("Usa local up|test|failover|status|down.");
  } else if (command === "cloud") {
    if (action === "identity") {
      await record(
        "identity",
        "pass",
        "Credenciales personales verificadas contra lab.json.",
        await identity(c),
      );
      const plan = await freePlan(c);
      console.log(JSON.stringify(plan, null, 2));
      console.log(
        "GCP: revisa personalmente prueba/créditos en Billing y anota budgetReviewedOn y gcpTrialExpiresOn. No basta con billingEnabled.",
      );
    } else if (action === "prepare")
      console.log(
        `Terraform personal preparado en ${generateTerraform(c)}. Backend local privado; cada root tiene estado separado.`,
      );
    else if (action === "test") {
      for (const id of [
        "cloud-http",
        "cloud-tls",
        "rds-private",
        "rds-multiaz",
        "vpn",
      ])
        await record(
          id,
          "pending",
          "Consulta iniciada; todavía sin resultado de esta ejecución.",
        );
      await verifyCloud(c, record);
    } else if (action === "replica") {
      try {
        await replica(c, record);
      } catch (e) {
        await record("replica", "fail", e.message);
        throw e;
      }
    } else if (action === "runtime") {
      try {
        await runtime(c, record);
      } catch (e) {
        await record("same-image", "fail", e.message);
        throw e;
      }
    } else if (action === "access") await prepareAccess(c);
    else if (action === "deploy") await deploy(c, stage);
    else if (action === "failover") {
      const id = stage === "nginx" ? "nginx-remote" : "dns-failover";
      await record(id, "pending", "Ensayo iniciado; recuperación pendiente.");
      try {
        await failover(c, stage, record);
      } catch (e) {
        await record(
          id,
          "fail",
          e.message + " Comprueba recuperación de tu VM antes de repetir.",
        );
        throw e;
      }
    } else if (action === "enable-apis") {
      await identity(c);
      await gcp(c, [
        "services",
        "enable",
        "compute.googleapis.com",
        "iap.googleapis.com",
        "oslogin.googleapis.com",
        "artifactregistry.googleapis.com",
        "storage.googleapis.com",
        "monitoring.googleapis.com",
        "logging.googleapis.com",
        "iam.googleapis.com",
      ]);
    } else
      throw Error(
        "Usa cloud identity|prepare|test|replica|runtime|enable-apis|deploy.",
      );
  } else if (command === "terraform") await terraform(c, action, stage);
  else if (command === "report") report(c);
  else throw Error("Comando desconocido. Consulta npm run lab -- help.");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
