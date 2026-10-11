import { describe, it, expect } from "vitest";
import { createDemo } from "../src/seed";
import { workflowOrders } from "../src/workflow";
describe("module queues", () => {
  it("separates warehouse work from invoicing without duplicating records", () => {
    const state = createDemo();
    const dispatch = workflowOrders(state, "dispatch");
    const billing = workflowOrders(state, "billing");
    expect(dispatch.length).toBeGreaterThan(0);
    expect(billing.length).toBeGreaterThan(0);
    expect(
      dispatch.every((order) => ["Nuevo", "Asignado"].includes(order.status)),
    ).toBe(true);
    expect(
      billing.every((order) =>
        ["Confirmado", "Facturado"].includes(order.status),
      ),
    ).toBe(true);
    expect(dispatch.some((order) => billing.includes(order))).toBe(false);
    expect(workflowOrders(state, "orders")).toHaveLength(state.orders.length);
  });
});
