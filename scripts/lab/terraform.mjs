import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  repo,
  labDir,
  writePrivate,
  cleanEnvironment,
  checkBudget,
} from "./config.mjs";
import { run, aws, gcp, identity, freePlan } from "./process.mjs";

const roots = ["gcp-only", "aws-only", "vpn-only"];
const hash = (s) => createHash("sha256").update(s).digest("hex");
export function generateTerraform(c) {
  const dest = path.join(labDir(c), "terraform");
  const fingerprint = hash(
    JSON.stringify([
      c.name,
      c.awsAccountId,
      c.gcpProjectId,
      c.domainMode,
      c.domain,
    ]),
  );
  const marker = path.join(dest, "owner.json");
  if (fs.existsSync(marker)) {
    if (JSON.parse(fs.readFileSync(marker)).fingerprint !== fingerprint)
      throw Error(
        "Este laboratorio ya tiene otra configuración cloud. Usa un nombre nuevo; no se reasigna su estado.",
      );
    return dest;
  }
  if (fs.existsSync(dest))
    throw Error(
      "Directorio Terraform incompleto: revísalo antes de continuar; no se sobrescribe.",
    );
  for (const root of roots) {
    const source = path.join(repo, "infra/terraform", root);
    for (const file of fs
      .readdirSync(source)
      .filter((f) => f.endsWith(".tf"))) {
      if (
        c.domainMode === "none" &&
        ((root === "aws-only" && file === "dns.tf") ||
          (root === "gcp-only" && file === "monitoring.tf"))
      )
        continue;
      let text = fs
        .readFileSync(path.join(source, file), "utf8")
        .replaceAll("polaris-ues", `lab-${c.name}`)
        .replaceAll("117425831688", c.awsAccountId)
        .replaceAll("project-dba46330-c40e-432b-9ad", c.gcpProjectId)
        .replaceAll("ga22038", c.name);
      text = text
        .replace(/backend "s3" \{[\s\S]*?\n  \}/, 'backend "local" {}')
        .replace(/backend "gcs" \{[^}]+\}/, 'backend "local" {}');
      if (c.domainMode !== "none")
        text = text.replaceAll("multicloud.polarisenterprisesv.com", c.domain);
      if (root === "vpn-only" && file === "versions.tf") {
        text = text.replace(
          /data "terraform_remote_state" "aws" \{[\s\S]*?\n\}/,
          'data "terraform_remote_state" "aws" {\n  backend = "local"\n  config = { path = "${path.module}/../aws-only/terraform.tfstate" }\n}',
        );
      }
      if (root === "aws-only" && file === "dns.tf") {
        text = text.replaceAll(
          '"34.122.222.237"',
          "data.terraform_remote_state.gcp.outputs.app_ip",
        );
        text +=
          '\ndata "terraform_remote_state" "gcp" {\n  backend = "local"\n  config = { path = "${path.module}/../gcp-only/terraform.tfstate" }\n}\n';
      }
      if (root === "gcp-only" && file === "main.tf")
        text +=
          '\noutput "app_private_ip" { value = google_compute_instance.app.network_interface[0].network_ip }\nresource "google_compute_firewall" "aws_backend" {\n name = "${var.name}-aws-backend"\n network = google_compute_network.main.name\n source_ranges = ["10.10.0.0/16"]\n target_tags = ["lab-' +
          c.name +
          '-app"]\n allow {\n protocol = "tcp"\n ports = ["3000"]\n }\n}\n';
      writePrivate(path.join(dest, root, file), text);
    }
  }
  // Only the public Docker bootstrap is copied; no state, caches, credentials or old releases.
  writePrivate(
    path.join(dest, "bootstrap/docker.sh"),
    fs.readFileSync(path.join(repo, "infra/terraform/bootstrap/docker.sh")),
  );
  writePrivate(
    marker,
    JSON.stringify(
      {
        fingerprint,
        name: c.name,
        awsAccountId: c.awsAccountId,
        gcpProjectId: c.gcpProjectId,
      },
      null,
      2,
    ),
  );
  return dest;
}
export async function terraform(c, root, action) {
  if (
    !roots.includes(root) ||
    !["init", "validate", "plan", "apply", "outputs"].includes(action)
  )
    throw Error(
      "Uso: terraform gcp-only|aws-only|vpn-only init|validate|plan|apply|outputs",
    );
  const base = generateTerraform(c),
    dir = path.join(base, root);
  const env = cleanEnvironment();
  env.TF_VAR_project_id = c.gcpProjectId;
  const plan = path.join(dir, "reviewed.tfplan"),
    manifest = `${plan}.json`;
  if (["plan", "apply", "outputs"].includes(action)) {
    await identity(c);
    env.AWS_PROFILE = c.awsProfile;
    env.AWS_REGION = "us-east-2";
    if (action !== "outputs") {
      checkBudget(c);
      await freePlan(c);
      // Export only this profile's temporary credentials into this child's environment.
      const creds = JSON.parse(
        await aws(
          c,
          ["configure", "export-credentials", "--format", "process"],
          { capture: true, quiet: true },
        ),
      );
      env.AWS_ACCESS_KEY_ID = creds.AccessKeyId;
      env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey;
      if (creds.SessionToken) env.AWS_SESSION_TOKEN = creds.SessionToken;
      env.GOOGLE_OAUTH_ACCESS_TOKEN = await gcp(
        c,
        ["auth", "print-access-token"],
        { capture: true, quiet: true },
      );
    }
  }
  if (action === "init")
    return run("terraform", ["init", "-input=false"], { cwd: dir, env });
  if (action === "validate")
    return run("terraform", ["validate", "-no-color"], { cwd: dir, env });
  if (action === "outputs") {
    const out = JSON.parse(
      await run("terraform", ["output", "-json"], {
        cwd: dir,
        env,
        capture: true,
      }),
    );
    const safe = Object.fromEntries(
      Object.entries(out)
        .filter(([, v]) => !v.sensitive)
        .map(([k, v]) => [k, v.value]),
    );
    console.log(JSON.stringify(safe, null, 2));
    return safe;
  }
  if (action === "plan") {
    await run(
      "terraform",
      ["plan", "-input=false", "-no-color", `-out=${plan}`],
      { cwd: dir, env },
    );
    const data = JSON.parse(
      await run("terraform", ["show", "-json", plan], {
        cwd: dir,
        env,
        capture: true,
        quiet: true,
      }),
    );
    if (data.resource_changes?.some((r) => r.change.actions.includes("delete")))
      throw Error(
        "El plan contiene eliminaciones/reemplazos. El asistente de alumnos no los aplica.",
      );
    writePrivate(
      manifest,
      JSON.stringify({
        name: c.name,
        account: c.awsAccountId,
        project: c.gcpProjectId,
        root,
        sha256: hash(fs.readFileSync(plan)),
        createdAt: new Date().toISOString(),
      }),
    );
    console.log(
      "Revisa el plan mostrado. apply utiliza exclusivamente este plan guardado y estas cuentas.",
    );
    return;
  }
  const m = JSON.parse(fs.readFileSync(manifest));
  if (
    m.name !== c.name ||
    m.account !== c.awsAccountId ||
    m.project !== c.gcpProjectId ||
    m.root !== root ||
    m.sha256 !== hash(fs.readFileSync(plan)) ||
    Date.now() - Date.parse(m.createdAt) > 3_600_000
  )
    throw Error(
      "Plan ausente, cambiado, de otra cuenta o mayor de una hora. Ejecuta plan nuevamente.",
    );
  await run("terraform", ["apply", "-input=false", "-no-color", plan], {
    cwd: dir,
    env,
  });
  fs.unlinkSync(manifest);
}
export function readOutputs(c, root) {
  const filename = path.join(labDir(c), "terraform", root, "terraform.tfstate");
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  return Object.fromEntries(
    Object.entries(data.outputs || {}).map(([k, v]) => [k, v.value]),
  );
}
