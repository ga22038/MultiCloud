import assert from "node:assert/strict";
process.loadEnvFile(".secrets/runtime.env");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
assert.equal(
  new URL(base).hostname,
  "127.0.0.1",
  "Smoke tests are restricted to the local lab.",
);
const origin = new URL(base).origin;
const request = (path, options) => fetch(`${base}${path}`, options);
assert.equal((await request("/api/health/live")).status, 200);
assert.equal((await request("/api/health/ready")).status, 200);
assert.equal((await request("/api/v1/state")).status, 401);
assert.equal(
  (
    await request("/api/v1/session", {
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
const login = await request("/api/v1/session", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    username: "customer",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const response = await request("/api/v1/state", {
  headers: { Cookie: cookie },
});
assert.equal(response.status, 200);
const { state, user } = await response.json();
assert.equal(user.role, "Customer");
for (const path of [
  "/api/v1/orders?pageSize=1",
  "/api/v1/inventory?pageSize=1",
  "/api/v1/movements?pageSize=1",
  "/api/v1/catalogs/materials?pageSize=1",
]) {
  const list = await request(path, { headers: { Cookie: cookie } });
  assert.equal(list.status, 200);
  const result = await list.json();
  assert.ok(Array.isArray(result.data));
  assert.ok(result.data.length <= 1);
}
assert.equal(
  (
    await request("/api/v1/orders?pageSize=1000", {
      headers: { Cookie: cookie },
    })
  ).status,
  400,
);
const forbidden = await request("/api/v1/operations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: origin,
    Cookie: cookie,
  },
  body: JSON.stringify({
    id: crypto.randomUUID(),
    expectedRevision: state.revision,
    command: {
      type: "addWarehouse",
      args: [{ name: "Forbidden smoke test", city: "UES" }],
    },
  }),
});
assert.equal(forbidden.status, 403);
assert.equal(
  (
    await (
      await request("/api/v1/state", { headers: { Cookie: cookie } })
    ).json()
  ).state.revision,
  state.revision,
);
assert.equal(
  (
    await request("/api/v1/session", {
      method: "DELETE",
      headers: { Origin: origin, Cookie: cookie },
    })
  ).status,
  200,
);
console.log(
  "API local: salud, sesión, origen y permisos verificados. No se modificaron datos de negocio.",
);
