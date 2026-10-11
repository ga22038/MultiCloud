import { mkdirSync, writeFileSync } from "node:fs";
import { createDemo } from "../app/src/seed";
import {
  createOrderReport,
  createOrdersReport,
  createInventoryReport,
  createKardexReport,
} from "../app/src/reports";
const state = createDemo();
mkdirSync("docs/examples", { recursive: true });
const examples = [
  ["pedido", await createOrderReport(state, state.orders[0], "orders")],
  [
    "alistamiento",
    await createOrderReport(
      state,
      state.orders.find((order) => order.status === "Asignado")!,
      "dispatch",
    ),
  ],
  [
    "facturacion",
    await createOrderReport(
      state,
      state.orders.find((order) => order.status === "Facturado")!,
      "billing",
    ),
  ],
  ["inventario", await createInventoryReport(state, state.stocks)],
  ["kardex", await createKardexReport(state, state.movements)],
  ["pedidos", await createOrdersReport(state, state.orders, "Pedidos")],
] as const;
for (const [name, doc] of examples)
  writeFileSync(
    `docs/examples/polaris-ues-${name}.pdf`,
    Buffer.from(doc.output("arraybuffer")),
  );
console.log(
  "Seis PDF de ejemplo generados con datos ficticios en docs/examples.",
);
