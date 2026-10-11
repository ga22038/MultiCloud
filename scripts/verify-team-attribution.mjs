/** Academic fixture: receipt and offsetting write-off leave the test lot at zero. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
process.loadEnvFile(".secrets/gcp/user.env");
const origin = "https://aws.multicloud.polarisenterprisesv.com";
const cookies = new Map();
async function login(username) {
  const response = await fetch(`${origin}/api/v1/session`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: process.env.POLARIS_PASSWORD }),
  });
  assert.equal(response.status, 200);
  cookies.set(username, response.headers.get("set-cookie").split(";")[0]);
  return (await response.json()).user;
}
async function read(username, url = origin) {
  const response = await fetch(`${url}/api/v1/state`, {
    headers: { Cookie: cookies.get(username) },
  });
  assert.equal(response.status, 200);
  return (await response.json()).state;
}
async function command(username, command) {
  const state = await read(username);
  const operation = {
    id: randomUUID(),
    expectedRevision: state.revision,
    command,
  };
  const response = await fetch(`${origin}/api/v1/operations`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookies.get(username),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(operation),
  });
  assert.equal(response.status, 200, `Failed command ${command.type}`);
  const result = await response.json();
  assert.equal(result.state.audit[0].operationId, operation.id);
  return { ...result, operation };
}
const name = "UES · Prueba de trazabilidad";
try {
  const creator = await login("ca21062");
  const editor = await login("jm21008");
  const before = await read("ca21062");
  assert.equal(creator.role, "Administrador");
  assert.equal(editor.role, "Administrador");
  assert.ok(
    !before.warehouses.some((row) => row.name === name),
    "This fixture already exists. Inspect it before rerunning.",
  );
  const first = await command("ca21062", {
    type: "addWarehouse",
    args: [{ name, city: "Prueba académica" }],
  });
  const warehouse = first.state.warehouses.find((row) => row.name === name);
  assert.equal(warehouse.createdBy, "ca21062");
  assert.equal(warehouse.createdById, creator.id);
  const receipt = await command("ca21062", {
    type: "receive",
    args: [
      {
        materialId: before.materials[0].id,
        warehouseId: warehouse.id,
        lot: "UES-AUTORIA-001",
        expiry: "2027-10-11",
        grams: 1000,
        document: "UES-TRAZABILIDAD-ENTRADA-001",
        reason:
          "Prueba académica de autoría: 1 kg ficticio, se dará de baja para dejar saldo cero.",
      },
      randomUUID(),
    ],
  });
  const stock = receipt.state.stocks.find(
    (row) => row.warehouseId === warehouse.id,
  );
  assert.equal(stock.createdBy, "ca21062");
  assert.equal(stock.createdById, creator.id);
  const edited = await command("jm21008", {
    type: "updateCatalog",
    args: [
      "warehouses",
      warehouse.id,
      { name, second: "UES · ensayo de equipo", third: "" },
    ],
  });
  const editedWarehouse = edited.state.warehouses.find(
    (row) => row.id === warehouse.id,
  );
  assert.equal(editedWarehouse.createdBy, "ca21062");
  assert.equal(editedWarehouse.updatedBy, "jm21008");
  const final = await command("jm21008", {
    type: "writeOff",
    args: [
      stock.id,
      1000,
      "UES-TRAZABILIDAD-BAJA-001",
      "Cierre de prueba académica de autoría; saldo del lote ficticio en cero.",
      randomUUID(),
    ],
  });
  const finalStock = final.state.stocks.find((row) => row.id === stock.id);
  assert.equal(finalStock.createdBy, "ca21062");
  assert.equal(finalStock.updatedBy, "jm21008");
  assert.equal(finalStock.updatedById, editor.id);
  assert.equal(
    final.state.movements
      .filter((row) => row.stockId === stock.id)
      .reduce((sum, row) => sum + row.grams, 0),
    0,
  );
  assert.deepEqual(final.state.orders, before.orders);
  const gcp = await read(
    "jm21008",
    "https://gcp.multicloud.polarisenterprisesv.com",
  );
  assert.deepEqual(gcp, final.state);
  const forged = await fetch(`${origin}/api/v1/operations`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookies.get("ca21062"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: randomUUID(),
      expectedRevision: final.state.revision,
      command: {
        type: "addWarehouse",
        args: [
          {
            name: "Rejected spoofed creator",
            city: "UES",
            createdBy: "ga22038",
          },
        ],
      },
    }),
  });
  assert.equal(forged.status, 400);
  const evidence = {
    verifiedAt: new Date().toISOString(),
    result: "TEAM_ATTRIBUTION_OK",
    creator: "ca21062",
    editor: "jm21008",
    warehouseId: warehouse.id,
    stockId: stock.id,
    lot: stock.lot,
    fixtureGrams: 1000,
    finalBalanceGrams: 0,
    revisionBefore: before.revision,
    revisionAfter: final.state.revision,
    originalOrdersPreserved: true,
    forgedCreatorRejected: true,
    crossCloudDataMatches: true,
    creatorPreservedOnEdit: true,
    operationIds: [first, receipt, edited, final].map(
      (result) => result.operation.id,
    ),
  };
  fs.writeFileSync(
    "docs/evidence-team-attribution.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  for (const Cookie of cookies.values())
    await fetch(`${origin}/api/v1/session`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie },
    });
}
