import { describe, expect, it } from "vitest";
import { applyCommand, operationSchema } from "../src/commands";
import { createDemo } from "../src/seed";
import type { Actor } from "../src/domain";
const creator: Actor = {
  id: "user-ca",
  username: "ca21062",
  name: "Display name",
  role: "Administrador",
};
const editor: Actor = {
  id: "user-jm",
  username: "jm21008",
  name: "Another display name",
  role: "Administrador",
};

describe("shared workspace attribution", () => {
  it("preserves the creator across edits by another administrator and links deletion history", () => {
    const initial = createDemo();
    const created = applyCommand(initial, creator, {
      type: "addWarehouse",
      args: [{ name: "Attribution warehouse", city: "UES" }],
    });
    const warehouse = created.warehouses.at(-1)!;
    expect(warehouse).toMatchObject({
      createdBy: "ca21062",
      createdById: creator.id,
    });
    const edited = applyCommand(created, editor, {
      type: "updateCatalog",
      args: [
        "warehouses",
        warehouse.id,
        { name: "Edited warehouse", second: "San Salvador", third: "" },
      ],
    });
    expect(edited.warehouses.at(-1)).toMatchObject({
      createdBy: "ca21062",
      createdById: creator.id,
      updatedBy: "jm21008",
      updatedById: editor.id,
    });
    expect(edited.audit[0]).toMatchObject({
      actor: "jm21008",
      actorId: editor.id,
      commandType: "updateCatalog",
      entities: [{ kind: "warehouses", id: warehouse.id }],
    });
    expect(edited.audit[0].changes?.before).toMatchObject({
      name: "Attribution warehouse",
    });
    expect(edited.audit[0].changes?.after).toMatchObject({
      name: "Edited warehouse",
      updatedBy: "jm21008",
    });
    const deleted = applyCommand(edited, editor, {
      type: "deleteCatalog",
      args: ["warehouses", warehouse.id],
    });
    expect(deleted.audit[0].entities).toContainEqual({
      kind: "warehouses",
      id: warehouse.id,
    });
    expect(deleted.audit[0].changes?.before).toMatchObject({
      createdBy: "ca21062",
    });
    expect(initial.warehouses).toHaveLength(3);
  });
  it("keeps the first stock creator while attributing subsequent receipts and corrections separately", () => {
    const initial = createDemo();
    const receipt = {
      materialId: "m1",
      warehouseId: "w1",
      lot: "ATTRIBUTION",
      expiry: "2099-12-31",
      grams: 1000,
      document: "ATTR-1",
      reason: "Test receipt",
    };
    const first = applyCommand(initial, creator, {
      type: "receive",
      args: [receipt, "attr-1"],
    });
    const stock = first.stocks.at(-1)!;
    const second = applyCommand(first, editor, {
      type: "receive",
      args: [{ ...receipt, document: "ATTR-2" }, "attr-2"],
    });
    expect(second.stocks.find((row) => row.id === stock.id)).toMatchObject({
      createdBy: "ca21062",
      updatedBy: "jm21008",
    });
    expect(second.movements.at(-1)).toMatchObject({
      actor: "jm21008",
      actorId: editor.id,
    });
    expect(second.audit[0].entities).toContainEqual({
      kind: "stocks",
      id: stock.id,
    });
    expect(
      second.movements.filter((row) => row.stockId === stock.id),
    ).toHaveLength(2);
  });
  it("does not invent creators for historical records and rejects spoofed attribution fields", () => {
    const initial = createDemo();
    const edited = applyCommand(initial, editor, {
      type: "updateCatalog",
      args: [
        "warehouses",
        "w1",
        { name: "Historical warehouse", second: "UES", third: "" },
      ],
    });
    expect(edited.warehouses[0].createdBy).toBeUndefined();
    expect(edited.warehouses[0].updatedBy).toBe("jm21008");
    expect(
      operationSchema.safeParse({
        id: crypto.randomUUID(),
        expectedRevision: 0,
        command: {
          type: "addWarehouse",
          args: [{ name: "Fake", city: "UES", createdBy: "ga22038" }],
        },
      }).success,
    ).toBe(false);
  });
  it("records different creators in the shared order list", () => {
    let state = createDemo();
    for (const actor of [creator, editor])
      state = applyCommand(state, actor, {
        type: "createOrder",
        args: [
          {
            number: `ATTR-${actor.username}`,
            customerId: "c1",
            notes: "",
            lines: [{ materialId: "m1", grams: 1000 }],
          },
        ],
      });
    expect(state.orders.slice(0, 2).map((order) => order.createdBy)).toEqual([
      "jm21008",
      "ca21062",
    ]);
  });
});
