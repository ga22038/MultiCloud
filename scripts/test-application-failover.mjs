import fs from "node:fs";
import assert from "node:assert/strict";
import { request } from "node:https";
import { Resolver } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
process.loadEnvFile(".secrets/gcp/user.env");
const host = "app.multicloud.polarisenterprisesv.com";
const origin = `https://${host}`;
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(["1.1.1.1"]);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let Cookie;
async function api(path, body) {
  const [address] = await resolver.resolve4(host);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: host,
        path,
        family: 4,
        agent: false,
        lookup: (_h, _o, cb) => cb(null, address, 4),
        method: body ? "POST" : "GET",
        headers: {
          Origin: origin,
          ...(Cookie ? { Cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
      },
      (response) => {
        let text = "";
        response.on("data", (chunk) => (text += chunk));
        response.on("end", () => {
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }
          resolve({
            status: response.statusCode,
            body: json,
            headers: response.headers,
            address,
          });
        });
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error("Timeout HTTP")));
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function waitSite(site, deadline) {
  while (Date.now() < deadline) {
    try {
      const ready = await api("/api/health/ready");
      if (ready.status === 200 && ready.body?.site === site) return ready;
      console.log(
        JSON.stringify({
          waitingFor: site,
          address: ready.address,
          status: ready.status,
        }),
      );
    } catch {
      console.log(JSON.stringify({ waitingFor: site, status: "unavailable" }));
    }
    await pause(10000);
  }
  throw new Error(`No se observó ${site} dentro del intervalo de prueba.`);
}
const initial = await api("/api/health/ready");
assert.equal(initial.body?.site, "aws");
const login = await api("/api/v1/session", {
  username: process.env.POLARIS_USERNAME,
  password: process.env.POLARIS_PASSWORD,
});
assert.equal(login.status, 200);
Cookie = login.headers["set-cookie"][0].split(";")[0];
const before = await api("/api/v1/state");
assert.equal(before.status, 200);
assert.equal(before.body.user.name, "ga22038");
const number = "UES-AWS-FAILOVER-001";
assert.ok(
  !before.body.state.orders.some((x) => x.number === number),
  "La prueba ya existe; no repetir automáticamente.",
);
const operation = {
  id: randomUUID(),
  expectedRevision: before.body.state.revision,
  command: {
    type: "createOrder",
    args: [
      {
        number,
        customerId: before.body.state.customers[0].id,
        notes:
          "Pedido ficticio: conmutación de aplicación AWS a GCP; RDS permanece como único escritor.",
        lines: [{ materialId: before.body.state.materials[0].id, grams: 1000 }],
      },
    ],
  },
};
const evidence = {
  scenario: "AWS application failure; RDS and VPN remain available",
  startedAt: new Date().toISOString(),
  initialSite: "aws",
  user: "ga22038",
  revisionBefore: before.body.state.revision,
  operationId: operation.id,
  orderNumber: number,
};
const invoke = (script) =>
  execFileSync(
    "rtk",
    [
      "proxy",
      "pwsh",
      "-NoProfile",
      "-File",
      "scripts/run-aws-script.ps1",
      "-ScriptPath",
      script,
    ],
    { stdio: ["ignore", "inherit", "inherit"], timeout: 120000 },
  );
try {
  evidence.failureRequestedAt = new Date().toISOString();
  invoke("scripts/stop-aws-app.sh");
  const recovered = await waitSite("gcp", Date.now() + 240000);
  evidence.firstGcpSuccessAt = new Date().toISOString();
  evidence.observedSecondsToGcp =
    (Date.parse(evidence.firstGcpSuccessAt) -
      Date.parse(evidence.failureRequestedAt)) /
    1000;
  evidence.gcpAddress = recovered.address;
  const session = await api("/api/v1/state");
  assert.equal(session.status, 200);
  assert.equal(session.body.user.name, "ga22038");
  const write = await api("/api/v1/operations", operation);
  assert.equal(write.status, 200);
  const replay = await api("/api/v1/operations", operation);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(
    replay.body.state.orders.filter((x) => x.number === number).length,
    1,
  );
  evidence.sessionPreserved = true;
  evidence.writeOnGcp = true;
  evidence.idempotenceVerified = true;
  evidence.revisionAfter = write.body.state.revision;
} finally {
  invoke("scripts/recover-aws-app.sh");
  evidence.recoveryRequestedAt = new Date().toISOString();
}
await waitSite("aws", Date.now() + 240000);
const after = await api("/api/v1/state");
assert.equal(after.status, 200);
assert.equal(
  after.body.state.orders.filter((x) => x.number === number).length,
  1,
);
assert.equal(after.body.state.revision, evidence.revisionAfter);
evidence.awsReturnVerifiedAt = new Date().toISOString();
evidence.writePreservedOnAws = true;
evidence.databasePromotionTested = false;
fs.writeFileSync(
  "docs/evidence-app-failover.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify({ result: "APPLICATION_FAILOVER_OK", ...evidence }));
