import assert from "node:assert/strict";
process.loadEnvFile(".secrets/gcp/runtime.env");
const origin = "https://gcp.multicloud.polarisenterprisesv.com";
for (const host of [origin]) {
  const response = await fetch(`${host}/api/health/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready", site: "gcp" });
}
const redirect = await fetch(origin.replace("https:", "http:"), {
  redirect: "manual",
});
assert.equal(redirect.status, 301);
assert.ok(redirect.headers.get("location").startsWith(origin));
assert.equal((await fetch(`${origin}/api/v1/state`)).status, 401);
assert.equal(
  (
    await fetch(`${origin}/api/v1/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://invalid.example",
      },
      body: "{}",
    })
  ).status,
  403,
);
const session = await fetch(`${origin}/api/v1/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    username: "admin",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  }),
});
assert.equal(session.status, 200);
const setCookie = session.headers.get("set-cookie");
assert.match(setCookie, /; Secure/i);
assert.match(setCookie, /; HttpOnly/i);
const Cookie = setCookie.split(";")[0];
try {
  const snapshot = await fetch(`${origin}/api/v1/state`, {
    headers: { Cookie },
  });
  assert.equal(snapshot.status, 200);
  const { state, user } = await snapshot.json();
  assert.equal(user.role, "Administrador");
  for (const path of [
    "orders",
    "inventory",
    "movements",
    "catalogs/materials",
  ]) {
    const response = await fetch(`${origin}/api/v1/${path}?pageSize=1`, {
      headers: { Cookie },
    });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).data.length <= 1);
  }
  if (process.argv.includes("--workflow")) {
    const order = state.orders.find(
      (row) => row.number === "UES-GCP-PRUEBA-001",
    );
    assert.equal(order?.status, "Facturado");
    assert.equal(order.invoice, "UES-GCP-FACTURA-001");
    const movements = state.movements.filter((row) => row.orderId === order.id);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].grams, -1000);
  }
  console.log(
    JSON.stringify({
      result: "GCP_OK",
      https: true,
      secureSession: true,
      originEnforced: true,
      authenticatedApis: true,
      workflow: process.argv.includes("--workflow"),
      revision: state.revision,
    }),
  );
} finally {
  await fetch(`${origin}/api/v1/session`, {
    method: "DELETE",
    headers: { Cookie, Origin: origin },
  });
}
