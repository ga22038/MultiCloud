import { kg } from "../domain";
import type { Order, State, Movement, Stock } from "../domain";
import type { WorkflowModule } from "../workflow";
import { dateLabel } from "../dates";
import { download } from "./store";
import {
  createOrderReport,
  createOrdersReport,
  createInventoryReport,
  createKardexReport,
} from "../reports";
export async function orderPdf(
  state: State,
  order: Order,
  module: WorkflowModule = "orders",
) {
  const doc = await createOrderReport(state, order, module);
  const safe = order.number.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Polaris_UES_${module}_${safe}.pdf`);
}
export async function ordersPdf(state: State, rows: Order[], title: string) {
  (await createOrdersReport(state, rows, title)).save(
    `Polaris_UES_${title}.pdf`,
  );
}
export async function inventoryPdf(state: State, rows: Stock[]) {
  (await createInventoryReport(state, rows)).save("Polaris_UES_Inventario.pdf");
}
export async function kardexPdf(state: State, rows: Movement[]) {
  (await createKardexReport(state, rows)).save("Polaris_UES_Kardex.pdf");
}

export function kardexCsv(state: State, rows: Movement[]) {
  const cell = (value: string | number) => {
    const safe =
      typeof value === "string" && /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : String(value);
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const data: (string | number)[][] = [
    [
      "Fecha",
      "Material",
      "Descripción",
      "Lote",
      "Bodega",
      "Movimiento",
      "Entrada kg",
      "Salida kg",
      "Saldo lote-bodega kg",
      "Documento",
      "Motivo",
      "Responsable",
    ],
  ];
  rows.forEach((m) => {
    const stock = state.stocks.find((s) => s.id === m.stockId)!;
    const material = state.materials.find((p) => p.id === stock.materialId)!;
    data.push([
      dateLabel(m.at),
      m.snapshot?.materialCode ?? material.code,
      m.snapshot?.materialName ?? material.name,
      m.snapshot?.lot ?? stock.lot,
      m.snapshot?.warehouseName ??
        state.warehouses.find((w) => w.id === stock.warehouseId)!.name,
      m.type,
      kg(Math.max(0, m.grams)),
      kg(Math.max(0, -m.grams)),
      kg(m.balance),
      m.document,
      m.reason,
      m.actor,
    ]);
  });
  download(
    new Blob(
      ["\uFEFF" + data.map((row) => row.map(cell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "Polaris_UES_Kardex.csv",
  );
}
