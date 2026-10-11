import { describe, it, expect } from "vitest";
import { operationSchema, applyCommand } from "../src/commands";
import { createDemo } from "../src/seed";
describe("server command boundary", () => {
  it("rejects forged actor, extra fields and fractional inventory", () => {
    const base = {
      id: crypto.randomUUID(),
      expectedRevision: 0,
      command: {
        type: "createOrder",
        args: [
          {
            number: "TEST",
            customerId: "c1",
            notes: "",
            lines: [{ materialId: "m1", grams: 1000 }],
          },
        ],
      },
    };
    expect(operationSchema.safeParse(base).success).toBe(true);
    expect(
      operationSchema.safeParse({ ...base, actor: { role: "Administrador" } })
        .success,
    ).toBe(false);
    base.command.args[0].lines[0].grams = 0.1;
    expect(operationSchema.safeParse(base).success).toBe(false);
  });
  it("enforces trusted roles without mutating the source state on failure", () => {
    const state = createDemo();
    const command = {
      type: "addWarehouse",
      args: [{ name: "UES", city: "San Salvador" }],
    } as const;
    expect(() =>
      applyCommand(
        state,
        { name: "Restricted", role: "Customer" },
        { ...command, args: [...command.args] },
      ),
    ).toThrow();
    expect(state.warehouses).toHaveLength(3);
    const next = applyCommand(
      state,
      { name: "Admin", role: "Administrador" },
      { ...command, args: [...command.args] },
    );
    expect(next.warehouses).toHaveLength(4);
    expect(next.revision).toBe(state.revision + 1);
    expect(state.warehouses).toHaveLength(3);
  });
});
