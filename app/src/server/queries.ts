import "server-only";
import { z } from "zod";
import { balance, reserved, available, expired } from "../domain";
import { loadState } from "./repository";
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(180).default(""),
});
export function queryOptions(request: Request) {
  return paginationSchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
}
export function paginate<T>(
  rows: T[],
  options: { page: number; pageSize: number },
  revision: number,
) {
  const start = (options.page - 1) * options.pageSize;
  return {
    data: rows.slice(start, start + options.pageSize),
    page: options.page,
    pageSize: options.pageSize,
    total: rows.length,
    revision,
  };
}
export async function ordersQuery(request: Request) {
  const options = queryOptions(request);
  const state = await loadState();
  const status = z
    .enum(["Nuevo", "Asignado", "Confirmado", "Facturado", "Cancelado"])
    .optional()
    .parse(new URL(request.url).searchParams.get("status") || undefined);
  const rows = state.orders.filter(
    (order) =>
      (!status || order.status === status) &&
      `${order.number} ${state.customers.find((item) => item.id === order.customerId)?.name || ""}`
        .toLowerCase()
        .includes(options.q.toLowerCase()),
  );
  return paginate(rows, options, state.revision);
}
export async function inventoryQuery(request: Request) {
  const options = queryOptions(request);
  const state = await loadState();
  const warehouseId = new URL(request.url).searchParams.get("warehouseId");
  const rows = state.stocks
    .map((stock) => ({
      ...stock,
      material:
        state.materials.find((item) => item.id === stock.materialId)?.name ||
        "",
      warehouse:
        state.warehouses.find((item) => item.id === stock.warehouseId)?.name ||
        "",
      grams: balance(state, stock.id),
      reservedGrams: reserved(state, stock.id),
      availableGrams: expired(stock) ? 0 : available(state, stock.id),
      expired: expired(stock),
    }))
    .filter(
      (stock) =>
        (!warehouseId || stock.warehouseId === warehouseId) &&
        `${stock.material} ${stock.lot}`
          .toLowerCase()
          .includes(options.q.toLowerCase()),
    );
  return paginate(rows, options, state.revision);
}
export async function movementsQuery(request: Request) {
  const options = queryOptions(request);
  const state = await loadState();
  const rows = state.movements.filter((row) =>
    `${row.document} ${row.reason} ${row.actor} ${row.snapshot?.lot || ""}`
      .toLowerCase()
      .includes(options.q.toLowerCase()),
  );
  return paginate(rows, options, state.revision);
}
export async function catalogsQuery(request: Request, kind: string) {
  const options = queryOptions(request);
  const state = await loadState();
  const valid = z.enum(["customers", "materials", "warehouses"]).parse(kind);
  const rows = state[valid].filter((row) =>
    Object.values(row)
      .join(" ")
      .toLowerCase()
      .includes(options.q.toLowerCase()),
  );
  return paginate(rows, options, state.revision);
}
