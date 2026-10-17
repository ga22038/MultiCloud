import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  validateConfig,
  cleanEnvironment,
  checkBudget,
  labDir,
  repo,
} from "../config.mjs";
import { prepareLocal } from "../local.mjs";
import { generateTerraform } from "../terraform.mjs";
import { awsArgs } from "../process.mjs";
import { nginxConfig } from "../site-config.mjs";

const sample = () => ({
  version: 1,
  name: `qa-${randomUUID().slice(0, 8)}`,
  localPort: 18082,
  databasePort: 13309,
  awsProfile: "student-test",
  awsAccountId: "123456789012",
  gcpAccount: "student@example.com",
  gcpProjectId: "student-lab-123",
  domainMode: "none",
  domain: "",
  budgetReviewedOn: "2026-10-16",
  gcpTrialExpiresOn: "2026-11-16",
});
function cleanup(c, t) {
  const directory = labDir(c),
    allowed = path.resolve(repo, ".secrets/labs");
  assert.equal(path.dirname(path.resolve(directory)), allowed);
  assert.match(c.name, /^qa-/);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
}
test("rejects owner accounts, secrets, path traversal and shell injection", () => {
  for (const mutation of [
    { awsAccountId: "117425831688" },
    { gcpProjectId: "project-dba46330-c40e-432b-9ad" },
    { gcpAccount: "developerengineer545@gmail.com" },
    { name: "../other" },
    { awsProfile: "a;whoami" },
    { gcpAccount: "$(whoami)@example.com" },
    { password: "secret" },
    { domainMode: "own", domain: "multicloud.polarisenterprisesv.com" },
    { localPort: 0 },
  ])
    assert.throws(() => validateConfig({ ...sample(), ...mutation }, true));
  assert.doesNotThrow(() =>
    validateConfig(
      {
        ...sample(),
        domainMode: "delegated",
        domain: "ca21062.multicloud.polarisenterprisesv.com",
      },
      true,
    ),
  );
});
test("removes inherited provider credentials and Terraform overrides", () => {
  assert.deepEqual(
    cleanEnvironment({
      PATH: "tools",
      AWS_ACCESS_KEY_ID: "owner",
      AWS_PROFILE: "owner",
      GOOGLE_APPLICATION_CREDENTIALS: "owner.json",
      CLOUDSDK_AUTH_ACCESS_TOKEN: "owner",
      TF_VAR_project_id: "owner",
      TF_CLI_ARGS: "-target=owner",
      TF_DATA_DIR: "owner-data",
      TF_WORKSPACE: "owner-workspace",
    }),
    { PATH: "tools" },
  );
  assert.equal(
    awsArgs(sample(), [
      "freetier",
      "get-account-plan-state",
      "--region",
      "us-east-1",
    ]).filter((v) => v === "--region").length,
    1,
  );
});
test("requires current review and unexpired trial", () => {
  assert.doesNotThrow(() =>
    checkBudget(sample(), new Date("2026-10-16T12:00:00Z")),
  );
  assert.throws(() => checkBudget(sample(), new Date("2026-10-17T12:00:00Z")));
  assert.throws(() =>
    checkBudget(
      { ...sample(), gcpTrialExpiresOn: "2026-10-16" },
      new Date("2026-10-16T12:00:00Z"),
    ),
  );
});
test("local labs generate independent secrets and preserve them on repeat", (t) => {
  const a = sample(),
    b = sample();
  cleanup(a, t);
  cleanup(b, t);
  prepareLocal(a);
  prepareLocal(b);
  const read = (c) =>
    fs.readFileSync(path.join(labDir(c), "runtime.env"), "utf8");
  const before = read(a);
  assert.notEqual(before, read(b));
  prepareLocal(a);
  assert.equal(read(a), before);
  const compose = fs.readFileSync(path.join(labDir(a), "compose.yaml"), "utf8");
  assert.ok(compose.includes(`name: lab-${a.name}`));
  assert.ok(compose.includes("127.0.0.1:18082:8080"));
  assert.throws(() => prepareLocal({ ...a, localPort: 18083 }));
});
test("generated Terraform uses only student's identities and private separate states", (t) => {
  const c = sample();
  cleanup(c, t);
  const dir = generateTerraform(c);
  const files = fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".tf"));
  const all = files
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
  for (const marker of [
    "117425831688",
    "project-dba46330",
    "polarisenterprisesv.com",
    "34.122.222.237",
    'backend "s3"',
    'backend "gcs"',
  ])
    assert.ok(!all.includes(marker), marker);
  assert.ok(all.includes('allowed_account_ids = ["123456789012"]'));
  assert.ok(
    all.includes('path = "${path.module}/../aws-only/terraform.tfstate"'),
  );
  assert.ok(!fs.existsSync(path.join(dir, "aws-only/dns.tf")));
  assert.throws(() =>
    generateTerraform({ ...c, awsAccountId: "999999999999" }),
  );
});
test("delegated DNS derives GCP IP from student state rather than reference deployment", (t) => {
  const c = {
    ...sample(),
    domainMode: "delegated",
    domain: "student.example.edu",
  };
  cleanup(c, t);
  const dir = generateTerraform(c),
    dns = fs.readFileSync(path.join(dir, "aws-only/dns.tf"), "utf8");
  assert.ok(dns.includes('name    = "student.example.edu"'));
  assert.ok(dns.includes("data.terraform_remote_state.gcp.outputs.app_ip"));
  assert.ok(!dns.includes("34.122.222.237"));
});
test("NGINX backup uses student's private peer and does not enable unsafe POST retries", () => {
  const c = { ...sample(), domainMode: "own", domain: "student.example.edu" };
  const a = { aws_app_ip: "192.0.2.10" },
    g = { app_ip: "192.0.2.20", app_private_ip: "10.20.1.2" };
  const aws = nginxConfig(c, "aws", a, g, true),
    google = nginxConfig(c, "gcp", a, g);
  assert.ok(aws.includes("server 10.20.1.2:3000 backup;"));
  assert.ok(!google.includes("backup;"));
  assert.ok(aws.includes("aws.student.example.edu app.student.example.edu"));
  assert.ok(aws.includes("if ($http_x_lab_acme = 1) { return 404; }"));
  assert.ok(!/proxy_next_upstream[^;]*\bnon_idempotent\b/.test(aws));
});
