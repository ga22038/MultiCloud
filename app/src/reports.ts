import type { jsPDF as Pdf } from "jspdf";
import type { RowInput } from "jspdf-autotable";
import { kg, balance, reserved, available, expired } from "./domain";
import type { State, Order, Stock, Movement } from "./domain";
import type { WorkflowModule } from "./workflow";
import { dateLabel } from "./dates";

type ReportOptions = {
  title: string;
  reference: string;
  metadata: RowInput[];
  head: string[];
  rows: RowInput[];
  notes?: RowInput[];
  landscape?: boolean;
  numeric?: number[];
};
/** Pure document builder: also usable in automated export tests without a browser. */
export async function buildReport(options: ReportOptions): Promise<Pdf> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({
    orientation: options.landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  doc.setProperties({
    title: `${options.title} | Polaris UES`,
    author: "Polaris UES",
    subject: options.reference,
    creator: "Polaris UES",
  });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const header = () => {
    doc.setFillColor(34, 48, 63);
    doc.rect(14, 12, 9, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255);
    doc.text("P", 16.5, 18.6);
    doc.setTextColor(34, 48, 63);
    doc.setFontSize(13);
    doc.text("POLARIS UES", 27, 16.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(106, 115, 123);
    doc.text(options.title.toUpperCase(), 27, 22);
    doc.text(doc.splitTextToSize(options.reference, 70), width - 14, 17, {
      align: "right",
    });
    doc.setDrawColor(211, 217, 223);
    doc.line(14, 28, width - 14, 28);
  };
  const margins = { top: 36, bottom: 22, left: 14, right: 14 };
  autoTable(doc, {
    startY: 36,
    body: options.metadata,
    theme: "plain",
    margin: margins,
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: [61, 72, 83],
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    didDrawPage: header,
  });
  const lastY = () =>
    (doc as Pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 36;
  autoTable(doc, {
    startY: lastY() + 7,
    head: [options.head],
    body: options.rows.length
      ? options.rows
      : [
          [
            {
              content: "No hay registros con los filtros seleccionados.",
              colSpan: options.head.length,
            },
          ],
        ],
    theme: "striped",
    margin: margins,
    showHead: "everyPage",
    headStyles: {
      fillColor: [34, 48, 63],
      textColor: 255,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles: { textColor: [52, 65, 78] },
    alternateRowStyles: { fillColor: [245, 247, 249] },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "top",
      lineColor: [225, 230, 235],
      lineWidth: 0.1,
    },
    columnStyles: Object.fromEntries(
      (options.numeric || []).map((index) => [index, { halign: "right" }]),
    ),
    didDrawPage: header,
  });
  if (options.notes?.length)
    autoTable(doc, {
      startY: lastY() + 8,
      body: options.notes,
      theme: "plain",
      margin: margins,
      styles: {
        fontSize: 9,
        textColor: [65, 75, 85],
        cellPadding: 3,
        overflow: "linebreak",
      },
      didDrawPage: header,
    });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 123, 132);
    doc.setDrawColor(220, 225, 230);
    doc.line(14, height - 18, width - 14, height - 18);
    doc.text(
      "Documento interno de operación. No es una factura fiscal.",
      14,
      height - 12,
    );
    doc.text(`Página ${page} de ${pages}`, width - 14, height - 12, {
      align: "right",
    });
  }
  return doc;
}
export async function createOrderReport(
  state: State,
  order: Order,
  module: WorkflowModule = "orders",
) {
  const customer = state.customers.find((item) => item.id === order.customerId);
  const title =
    module === "billing"
      ? "Resumen de facturación"
      : module === "dispatch"
        ? "Orden de alistamiento"
        : "Detalle del pedido";
  const rows = order.lines.flatMap((line) => {
    const material = state.materials.find(
      (item) => item.id === line.materialId,
    );
    if (module === "orders")
      return [
        [
          material?.code || "",
          material?.name || "Material no disponible",
          kg(line.grams),
        ],
      ];
    if (!line.allocations.length)
      return [
        [
          material?.code || "",
          material?.name || "Material no disponible",
          "Pendiente",
          "-",
          "-",
          kg(line.grams),
        ],
      ];
    return line.allocations.map((allocation) => {
      const stock = state.stocks.find((item) => item.id === allocation.stockId);
      return [
        material?.code || "",
        material?.name || "",
        stock?.lot || "",
        state.warehouses.find((item) => item.id === stock?.warehouseId)?.name ||
          "",
        stock ? dateLabel(stock.expiry) : "",
        kg(allocation.grams),
      ];
    });
  });
  return buildReport({
    title,
    reference: order.number,
    metadata: [
      ["Cliente", customer?.name || "No disponible"],
      [
        "Identificación / Ciudad",
        `${customer?.nit || ""} / ${customer?.city || ""}`,
      ],
      [
        "Estado / Creación",
        `${order.status} / ${dateLabel(order.createdAt, true)}`,
      ],
      ...(module === "billing"
        ? [["Referencia de factura", order.invoice || "Pendiente de registro"]]
        : []),
    ],
    head:
      module === "orders"
        ? ["Código", "Material", "Cantidad kg"]
        : [
            "Código",
            "Material",
            "Lote",
            "Bodega",
            "Vencimiento",
            "Cantidad kg",
          ],
    rows,
    numeric: [module === "orders" ? 2 : 5],
    notes: [
      [
        `Cantidad solicitada: ${kg(order.lines.reduce((sum, line) => sum + line.grams, 0))} kg`,
      ],
      [
        order.confirmedAt
          ? `Salida confirmada: ${dateLabel(order.confirmedAt, true)}. Responsable: ${order.confirmedBy || ""}.`
          : "Salida física pendiente de confirmación.",
      ],
      [`Observaciones: ${order.notes || "Sin observaciones."}`],
      ...(module === "dispatch"
        ? [["Preparó: ____________________    Verificó: ____________________"]]
        : []),
    ],
  });
}
export function createOrdersReport(
  state: State,
  orders: Order[],
  title: string,
) {
  return buildReport({
    title: `Reporte de ${title.toLowerCase()}`,
    reference: `Emisión: ${dateLabel(new Date().toISOString(), true)}`,
    landscape: true,
    metadata: [
      ["Registros", String(orders.length)],
      ["Alcance", "Registros que cumplen los filtros actuales."],
    ],
    head: ["Pedido", "Cliente", "Creación", "Estado", "Cantidad kg", "Factura"],
    numeric: [4],
    rows: orders.map((order) => [
      order.number,
      state.customers.find((item) => item.id === order.customerId)?.name || "",
      dateLabel(order.createdAt),
      order.status,
      kg(order.lines.reduce((sum, line) => sum + line.grams, 0)),
      order.invoice || "Pendiente",
    ]),
  });
}
export function createInventoryReport(state: State, stocks: Stock[]) {
  return buildReport({
    title: "Reporte de inventario",
    reference: `Revisión ${state.revision}`,
    landscape: true,
    metadata: [
      ["Lotes / Bodega", String(stocks.length)],
      ["Alcance", "Existencias según filtros actuales. Cantidades en kg."],
    ],
    head: [
      "Código",
      "Material",
      "Lote",
      "Bodega",
      "Vencimiento",
      "Existencias kg",
      "Reservado kg",
      "Disponible kg",
    ],
    numeric: [5, 6, 7],
    rows: stocks.map((stock) => {
      const material = state.materials.find(
        (item) => item.id === stock.materialId,
      );
      return [
        material?.code || "",
        material?.name || "",
        stock.lot,
        state.warehouses.find((item) => item.id === stock.warehouseId)?.name ||
          "",
        dateLabel(stock.expiry),
        kg(balance(state, stock.id)),
        kg(reserved(state, stock.id)),
        kg(expired(stock) ? 0 : available(state, stock.id)),
      ];
    }),
  });
}
export function createKardexReport(state: State, movements: Movement[]) {
  return buildReport({
    title: "Reporte de kardex",
    reference: `Revisión ${state.revision}`,
    landscape: true,
    metadata: [
      ["Movimientos", String(movements.length)],
      [
        "Alcance",
        "Movimientos según los filtros actuales. El saldo corresponde al lote y bodega.",
      ],
    ],
    head: [
      "Fecha",
      "Documento",
      "Material / Lote",
      "Movimiento",
      "Cantidad kg",
      "Saldo kg",
      "Responsable / Motivo",
    ],
    numeric: [4, 5],
    rows: movements.map((movement) => {
      const stock = state.stocks.find((item) => item.id === movement.stockId);
      const material = state.materials.find(
        (item) => item.id === stock?.materialId,
      );
      return [
        dateLabel(movement.at, true),
        movement.document,
        `${movement.snapshot?.materialName || material?.name || ""}\n${movement.snapshot?.lot || stock?.lot || ""}`,
        movement.type,
        kg(movement.grams),
        kg(movement.balance),
        `${movement.actor}\n${movement.reason}`,
      ];
    }),
  });
}
