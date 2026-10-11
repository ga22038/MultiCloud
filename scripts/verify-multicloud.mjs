import assert from "node:assert/strict";
import { createHash } from "node:crypto";
process.loadEnvFile(".secrets/gcp/user.env");
const sites = {
  aws: "https://aws.multicloud.polarisenterprisesv.com",
  gcp: "https://gcp.multicloud.polarisenterprisesv.com",
};
const results = [];
let expectedHash;
for (const [site, origin] of Object.entries(sites)) {
  const ready = await fetch(`${origin}/api/health/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ready", site });
  assert.equal((await fetch(`${origin}/api/v1/state`)).status, 401);
  const login = await fetch(`${origin}/api/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      username: process.env.POLARIS_USERNAME,
      password: process.env.POLARIS_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; HttpOnly/i);
  const Cookie = cookie.split(";")[0];
  try {
    const response = await fetch(`${origin}/api/v1/state`, {
      headers: { Cookie },
    });
    assert.equal(response.status, 200);
    const { state, user } = await response.json();
    assert.equal(user.name, "ga22038");
    assert.equal(user.role, "Administrador");
    const hash = createHash("sha256")
      .update(JSON.stringify(state))
      .digest("hex");
    expectedHash ??= hash;
    assert.equal(hash, expectedHash);
    const order = state.orders.find((x) => x.number === "UES-GCP-PRUEBA-001");
    assert.equal(order.status, "Facturado");
    assert.equal(
      state.movements.filter((x) => x.orderId === order.id).length,
      1,
    );
    for (const path of [
      "orders",
      "inventory",
      "movements",
      "catalogs/materials",
    ]) {
      assert.equal(
        (
          await fetch(`${origin}/api/v1/${path}?pageSize=1`, {
            headers: { Cookie },
          })
        ).status,
        200,
      );
    }
    results.push({
      site,
      user: user.name,
      revision: state.revision,
      https: true,
      secureSession: true,
      dataMatches: true,
    });
  } finally {
    await fetch(`${origin}/api/v1/session`, {
      method: "DELETE",
      headers: { Cookie, Origin: origin },
    });
  }
}
console.log(JSON.stringify({ result: "MULTICLOUD_OK", sites: results }));
