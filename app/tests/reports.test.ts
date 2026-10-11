import { describe, it, expect } from "vitest";
import { createDemo } from "../src/seed";
import { createOrderReport, createInventoryReport } from "../src/reports";
describe("PDF reports", () => {
  it("paginates long observations and preserves document identity and footers", async () => {
    const state = createDemo();
    const order = {
      ...state.orders[0],
      notes: "Observaciones extensas de prueba. ".repeat(300),
    };
    const doc = await createOrderReport(state, order, "dispatch");
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const output = doc.output();
    expect(output.startsWith("%PDF-")).toBe(true);
    expect(output).toContain("POLARIS UES");
    expect(output).toContain(order.number);
    expect(output).not.toContain("Univar");
    expect(output).toContain("Prepar");
  });
  it("exports only the selected inventory rows", async () => {
    const state = createDemo();
    const selected = state.stocks.slice(0, 1);
    const output = (await createInventoryReport(state, selected)).output();
    expect(output).toContain(selected[0].lot);
    const omitted = state.stocks.find((stock) => stock.lot !== selected[0].lot);
    if (omitted) expect(output).not.toContain(omitted.lot);
  });
});
