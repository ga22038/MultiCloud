export type Role = "Customer" | "Logística" | "Facturación" | "Administrador";
export type Status =
  "Nuevo" | "Asignado" | "Confirmado" | "Facturado" | "Cancelado";
export type MovementType =
  "Entrada" | "Salida por pedido" | "Baja" | "Ajuste" | "Reversión";
export type CatalogKind = "customers" | "materials" | "warehouses";
interface Registered {
  createdAt?: string;
}
export interface Actor {
  name: string;
  role: Role;
}
export interface Customer extends Registered {
  id: string;
  name: string;
  nit: string;
  city: string;
}
export interface Material extends Registered {
  id: string;
  code: string;
  name: string;
  category: string;
}
export interface Warehouse extends Registered {
  id: string;
  name: string;
  city: string;
}
export interface Stock extends Registered {
  id: string;
  materialId: string;
  lot: string;
  warehouseId: string;
  expiry: string;
}
export interface Allocation {
  stockId: string;
  grams: number;
}
export interface OrderLine {
  id: string;
  materialId: string;
  grams: number;
  allocations: Allocation[];
}
export interface Order {
  id: string;
  number: string;
  customerId: string;
  createdAt: string;
  createdBy: string;
  status: Status;
  lines: OrderLine[];
  notes: string;
  invoice?: string;
  confirmedAt?: string;
  confirmedBy?: string;
}
export interface Movement {
  id: string;
  operationKey: string;
  stockId: string;
  type: MovementType;
  grams: number;
  balance: number;
  document: string;
  reason: string;
  actor: string;
  at: string;
  orderId?: string;
  correctsId?: string;
  snapshot?: {
    materialCode: string;
    materialName: string;
    lot: string;
    warehouseName: string;
    warehouseId?: string;
    expiry: string;
  };
}
export interface Audit {
  changes?: { before: unknown; after: unknown };
  id: string;
  action: string;
  detail: string;
  actor: string;
  role: Role;
  at: string;
}
export interface State {
  version: 1;
  revision: number;
  customers: Customer[];
  materials: Material[];
  warehouses: Warehouse[];
  stocks: Stock[];
  orders: Order[];
  movements: Movement[];
  audit: Audit[];
}
export interface Receipt {
  materialId: string;
  lot: string;
  warehouseId: string;
  expiry: string;
  grams: number;
  document: string;
  reason: string;
}

const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function kg(grams: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(grams / 1000);
}
export function parseKg(value: string): number {
  const raw = value.trim();
  const clean = /^(?:[1-9]\d{0,2})(?:,\d{3})+(?:\.\d{1,3})?$/.test(raw)
    ? raw.replaceAll(",", "")
    : raw.replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(clean))
    throw new Error(
      "Ingresa kilos positivos, por ejemplo 10,000.00. Máximo 3 decimales.",
    );
  const [whole, fraction = ""] = clean.split(".");
  const grams = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  positive(grams);
  return grams;
}
function positive(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 999_999_999_999)
    throw new Error(
      "La cantidad debe ser mayor que cero y tener máximo 3 decimales.",
    );
}
function text(value: string, label: string) {
  const clean = value.trim();
  if (!clean || clean.length > 180)
    throw new Error(`${label}: ingresa entre 1 y 180 caracteres.`);
  return clean;
}
export class PermissionError extends Error {}
function allowed(actor: Actor, roles: Role[]) {
  if (actor.role !== "Administrador" && !roles.includes(actor.role))
    throw new PermissionError("Tu rol no permite realizar esta operación.");
}
function dateValid(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Ingresa una fecha de vencimiento válida.");
}
export function balance(state: State, stockId: string) {
  return state.movements
    .filter((m) => m.stockId === stockId)
    .reduce((sum, m) => sum + m.grams, 0);
}
export function reserved(
  state: State,
  stockId: string,
  exceptOrderId?: string,
) {
  return state.orders
    .filter((o) => o.status === "Asignado" && o.id !== exceptOrderId)
    .flatMap((o) => o.lines.flatMap((l) => l.allocations))
    .filter((a) => a.stockId === stockId)
    .reduce((sum, a) => sum + a.grams, 0);
}
export function available(
  state: State,
  stockId: string,
  exceptOrderId?: string,
) {
  return balance(state, stockId) - reserved(state, stockId, exceptOrderId);
}
export function expired(stock: Stock, date = today()) {
  return stock.expiry < date;
}
export function daysToExpiry(stock: Stock) {
  return Math.round(
    (Date.parse(stock.expiry) - Date.parse(today())) / 86400000,
  );
}
function log(
  state: State,
  actor: Actor,
  action: string,
  detail: string,
  changes?: Audit["changes"],
) {
  state.audit.unshift({
    id: uid(),
    action,
    detail,
    ...(changes ? { changes } : {}),
    actor: actor.name,
    role: actor.role,
    at: now(),
  });
}
function movement(
  state: State,
  actor: Actor,
  input: Omit<Movement, "id" | "actor" | "at" | "balance">,
) {
  if (state.movements.some((m) => m.operationKey === input.operationKey))
    throw new Error("Esta operación ya está registrada en el kardex.");
  const result = balance(state, input.stockId) + input.grams;
  if (result < 0 || !Number.isSafeInteger(result))
    throw new Error(
      "El movimiento dejaría existencias negativas o fuera de rango.",
    );
  const stock = state.stocks.find((s) => s.id === input.stockId)!;
  const material = state.materials.find((m) => m.id === stock.materialId)!;
  state.movements.push({
    ...input,
    id: uid(),
    actor: actor.name,
    at: now(),
    balance: result,
    snapshot: {
      warehouseId: stock.warehouseId,
      materialCode: material.code,
      materialName: material.name,
      lot: stock.lot,
      warehouseName: state.warehouses.find((w) => w.id === stock.warehouseId)!
        .name,
      expiry: stock.expiry,
    },
  });
}
function orderOf(state: State, id: string) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) throw new Error("No se encontró el pedido.");
  return order;
}

export function createOrder(
  state: State,
  actor: Actor,
  input: {
    number: string;
    customerId: string;
    lines: { materialId: string; grams: number }[];
    notes: string;
  },
) {
  allowed(actor, ["Customer"]);
  const number = text(input.number, "Número de pedido");
  if (
    state.orders.some(
      (o) => o.number.toLocaleLowerCase() === number.toLocaleLowerCase(),
    )
  )
    throw new Error("El número de pedido ya existe.");
  if (!state.customers.some((c) => c.id === input.customerId))
    throw new Error("Selecciona un cliente válido.");
  if (!input.lines.length) throw new Error("Agrega al menos un material.");
  const lines = input.lines.map((l) => {
    positive(l.grams);
    if (!state.materials.some((m) => m.id === l.materialId))
      throw new Error("Selecciona un material válido.");
    return { ...l, id: uid(), allocations: [] };
  });
  const order: Order = {
    id: uid(),
    number,
    customerId: input.customerId,
    lines,
    notes: input.notes.trim().slice(0, 2000),
    createdAt: now(),
    createdBy: actor.name,
    status: "Nuevo",
  };
  state.orders.unshift(order);
  log(state, actor, "Pedido creado", number);
  return order.id;
}

export function allocateOrder(
  state: State,
  actor: Actor,
  id: string,
  allocations: Record<string, Allocation[]>,
  date = today(),
) {
  allowed(actor, ["Logística"]);
  const order = orderOf(state, id);
  if (!["Nuevo", "Asignado"].includes(order.status))
    throw new Error("Solo puedes asignar pedidos nuevos o asignados.");
  const totals = new Map<string, number>();
  for (const line of order.lines) {
    const selected = allocations[line.id];
    if (
      !selected?.length ||
      selected.reduce((s, a) => s + a.grams, 0) !== line.grams
    )
      throw new Error(
        "La asignación de cada material debe coincidir con los kilos solicitados.",
      );
    const seen = new Set<string>();
    for (const a of selected) {
      positive(a.grams);
      if (seen.has(a.stockId))
        throw new Error("No repitas el mismo lote y bodega en una línea.");
      seen.add(a.stockId);
      const stock = state.stocks.find((s) => s.id === a.stockId);
      if (!stock || stock.materialId !== line.materialId)
        throw new Error("El lote no corresponde al material solicitado.");
      if (expired(stock, date))
        throw new Error("No puedes asignar un lote vencido.");
      totals.set(a.stockId, (totals.get(a.stockId) ?? 0) + a.grams);
    }
  }
  for (const [stockId, grams] of totals)
    if (available(state, stockId, order.id) < grams)
      throw new Error(
        "Existencias disponibles insuficientes. Revisa las reservas de otros pedidos.",
      );
  order.lines.forEach((l) => {
    l.allocations = structuredClone(allocations[l.id]);
  });
  order.status = "Asignado";
  log(state, actor, "Lotes y bodegas asignados", order.number);
}

export function suggestFefo(
  state: State,
  order: Order,
): Record<string, Allocation[]> {
  const used = new Map<string, number>();
  const result: Record<string, Allocation[]> = {};
  for (const line of order.lines) {
    let remaining = line.grams;
    result[line.id] = [];
    const candidates = state.stocks
      .filter((s) => s.materialId === line.materialId && !expired(s))
      .sort(
        (a, b) => a.expiry.localeCompare(b.expiry) || a.id.localeCompare(b.id),
      );
    for (const stock of candidates) {
      const grams = Math.min(
        remaining,
        available(state, stock.id, order.id) - (used.get(stock.id) ?? 0),
      );
      if (grams <= 0) continue;
      result[line.id].push({ stockId: stock.id, grams });
      used.set(stock.id, (used.get(stock.id) ?? 0) + grams);
      remaining -= grams;
      if (!remaining) break;
    }
    if (remaining)
      throw new Error(
        "No hay kilos disponibles suficientes para sugerir todos los materiales.",
      );
  }
  return result;
}

export function confirmOrder(
  state: State,
  actor: Actor,
  id: string,
  date = today(),
) {
  allowed(actor, ["Logística"]);
  const order = orderOf(state, id);
  if (order.status !== "Asignado")
    throw new Error("El pedido debe estar asignado y aún sin confirmar.");
  // Revalidate every allocation before recording any movement.
  allocateOrder(
    state,
    actor,
    id,
    Object.fromEntries(order.lines.map((l) => [l.id, l.allocations])),
    date,
  );
  for (const line of order.lines)
    for (const allocation of line.allocations) {
      movement(state, actor, {
        operationKey: `pedido:${order.id}:${line.id}:${allocation.stockId}`,
        stockId: allocation.stockId,
        type: "Salida por pedido",
        grams: -allocation.grams,
        document: order.number,
        reason: "Lote y cantidad confirmados",
        orderId: order.id,
      });
    }
  order.status = "Confirmado";
  order.confirmedAt = now();
  order.confirmedBy = actor.name;
  log(state, actor, "Pedido confirmado · salida registrada", order.number);
}

export function invoiceOrder(
  state: State,
  actor: Actor,
  id: string,
  reference: string,
) {
  allowed(actor, ["Facturación"]);
  const order = orderOf(state, id);
  if (order.status !== "Confirmado")
    throw new Error(
      "Confirma los lotes y cantidades antes de registrar la factura.",
    );
  const invoice = text(reference, "Número de factura");
  if (
    state.orders.some(
      (o) => o.invoice?.toLocaleLowerCase() === invoice.toLocaleLowerCase(),
    )
  )
    throw new Error("Ese número de factura ya está registrado.");
  order.invoice = invoice;
  order.status = "Facturado";
  log(state, actor, "Factura registrada", `${order.number} · ${invoice}`);
}

export function cancelOrder(
  state: State,
  actor: Actor,
  id: string,
  reason: string,
) {
  allowed(actor, ["Customer", "Logística"]);
  const order = orderOf(state, id);
  if (!["Nuevo", "Asignado"].includes(order.status))
    throw new Error("Solo puedes cancelar pedidos sin salida de inventario.");
  const clean = text(reason, "Motivo de cancelación");
  order.status = "Cancelado";
  log(
    state,
    actor,
    "Pedido cancelado · reserva liberada",
    `${order.number} · ${clean}`,
  );
}

export function receive(
  state: State,
  actor: Actor,
  input: Receipt,
  operationKey: string,
) {
  allowed(actor, ["Logística"]);
  positive(input.grams);
  const lot = text(input.lot, "Lote").toUpperCase();
  const document = text(input.document, "Documento");
  const reason = text(input.reason, "Motivo");
  dateValid(input.expiry);
  if (input.expiry < today())
    throw new Error("La entrada requiere un lote vigente.");
  if (
    !state.materials.some((m) => m.id === input.materialId) ||
    !state.warehouses.some((w) => w.id === input.warehouseId)
  )
    throw new Error("Selecciona un material y una bodega válidos.");
  if (state.movements.some((m) => m.operationKey === operationKey))
    throw new Error("Esta entrada ya está registrada.");
  let stock = state.stocks.find(
    (s) =>
      s.materialId === input.materialId &&
      s.lot === lot &&
      s.warehouseId === input.warehouseId,
  );
  if (
    state.stocks.some(
      (s) =>
        s.materialId === input.materialId &&
        s.lot === lot &&
        s.expiry !== input.expiry,
    )
  )
    throw new Error("Este lote ya existe con otra fecha de vencimiento.");
  if (!stock) {
    stock = {
      id: uid(),
      createdAt: now(),
      materialId: input.materialId,
      warehouseId: input.warehouseId,
      expiry: input.expiry,
      lot,
    };
    state.stocks.push(stock);
  }
  movement(state, actor, {
    operationKey,
    stockId: stock.id,
    type: "Entrada",
    grams: input.grams,
    document,
    reason,
  });
  log(
    state,
    actor,
    "Entrada de inventario",
    `${lot} · ${kg(input.grams)} kg · ${document}`,
  );
}

export function writeOff(
  state: State,
  actor: Actor,
  stockId: string,
  grams: number,
  document: string,
  reason: string,
  operationKey: string,
) {
  allowed(actor, ["Logística"]);
  positive(grams);
  if (!state.stocks.some((s) => s.id === stockId))
    throw new Error("Selecciona un lote válido.");
  const reference = text(document, "Documento");
  const detail = text(reason, "Motivo de baja");
  if (available(state, stockId) < grams)
    throw new Error(
      "La baja supera la cantidad disponible. No puedes dar de baja kilos reservados.",
    );
  movement(state, actor, {
    operationKey,
    stockId,
    type: "Baja",
    grams: -grams,
    document: reference,
    reason: detail,
  });
  log(state, actor, "Baja de inventario", `${reference} · ${detail}`);
}

export function addCustomer(
  state: State,
  actor: Actor,
  input: Omit<Customer, "id" | "createdAt">,
) {
  allowed(actor, []);
  const nit = text(input.nit, "NIT");
  if (state.customers.some((c) => c.nit === nit))
    throw new Error("Ya existe un cliente con ese NIT.");
  state.customers.push({
    id: uid(),
    createdAt: now(),
    name: text(input.name, "Nombre"),
    city: text(input.city, "Ciudad"),
    nit,
  });
  log(state, actor, "Cliente creado", input.name);
}
export function addMaterial(
  state: State,
  actor: Actor,
  input: Omit<Material, "id" | "createdAt">,
) {
  allowed(actor, []);
  const code = text(input.code, "Código").toUpperCase();
  if (state.materials.some((m) => m.code.toUpperCase() === code))
    throw new Error("El código de material ya existe.");
  state.materials.push({
    id: uid(),
    createdAt: now(),
    code,
    name: text(input.name, "Nombre"),
    category: text(input.category, "Categoría"),
  });
  log(state, actor, "Material creado", code);
}
export function addWarehouse(
  state: State,
  actor: Actor,
  input: Omit<Warehouse, "id" | "createdAt">,
) {
  allowed(actor, []);
  const name = text(input.name, "Nombre");
  if (state.warehouses.some((w) => w.name.toLowerCase() === name.toLowerCase()))
    throw new Error("La bodega ya existe.");
  state.warehouses.push({
    id: uid(),
    createdAt: now(),
    name,
    city: text(input.city, "Ciudad"),
  });
  log(state, actor, "Bodega creada", name);
}

export function transact(state: State, change: (draft: State) => void): State {
  const draft = structuredClone(state);
  change(draft);
  draft.revision += 1;
  return draft;
}

export function registrationDate(
  state: State,
  kind: CatalogKind | "stocks",
  id: string,
): string {
  const item = state[kind].find((row) => row.id === id);
  if (item?.createdAt) return item.createdAt;
  if (kind === "stocks")
    return state.movements.find((m) => m.stockId === id)?.at ?? "";
  const action =
    kind === "materials"
      ? "Material creado"
      : kind === "customers"
        ? "Cliente creado"
        : "Bodega creada";
  const detail =
    kind === "materials"
      ? state.materials.find((m) => m.id === id)?.code
      : item && "name" in item
        ? item.name
        : "";
  return (
    state.audit.find((a) => a.action === action && a.detail === detail)?.at ??
    ""
  );
}
export function newestFirst<T>(items: T[], getDate: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        getDate(b.item).localeCompare(getDate(a.item)) || b.index - a.index,
    )
    .map(({ item }) => item);
}
export function updateCatalog(
  state: State,
  actor: Actor,
  kind: CatalogKind,
  id: string,
  input: { name: string; second: string; third: string },
) {
  allowed(actor, []);
  const item = state[kind].find((row) => row.id === id);
  if (!item) throw new Error("No se encontró el registro.");
  const before = structuredClone(item);
  const name = text(input.name, "Nombre");
  const second = text(
    input.second,
    kind === "materials" ? "Código" : kind === "customers" ? "NIT" : "Ciudad",
  );
  if (kind === "materials") {
    const code = second.toUpperCase();
    if (
      state.materials.some((m) => m.id !== id && m.code.toUpperCase() === code)
    )
      throw new Error("El código de material ya existe.");
    Object.assign(item, {
      name,
      code,
      category: text(input.third, "Categoría"),
    });
  } else if (kind === "customers") {
    if (state.customers.some((c) => c.id !== id && c.nit === second))
      throw new Error("Ya existe un cliente con ese NIT.");
    Object.assign(item, {
      name,
      nit: second,
      city: text(input.third, "Ciudad"),
    });
  } else {
    if (
      state.warehouses.some(
        (w) => w.id !== id && w.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error("La bodega ya existe.");
    Object.assign(item, { name, city: second });
  }
  log(state, actor, "Catálogo editado", name, {
    before,
    after: structuredClone(item),
  });
}
export function deleteCatalog(
  state: State,
  actor: Actor,
  kind: CatalogKind,
  id: string,
) {
  allowed(actor, []);
  const item = state[kind].find((row) => row.id === id);
  if (!item) throw new Error("No se encontró el registro.");
  const used =
    kind === "materials"
      ? state.stocks.some((s) => s.materialId === id) ||
        state.orders.some((o) => o.lines.some((l) => l.materialId === id))
      : kind === "customers"
        ? state.orders.some((o) => o.customerId === id)
        : state.stocks.some((s) => s.warehouseId === id);
  if (used)
    throw new Error(
      "Este registro tiene inventario o pedidos relacionados. Puedes editarlo; no se puede eliminar porque conserva el historial.",
    );
  state[kind].splice(
    state[kind].findIndex((row) => row.id === id),
    1,
  );
  log(state, actor, "Registro de catálogo eliminado", item.name, {
    before: structuredClone(item),
    after: null,
  });
}
function unchanged(state: State, expectedRevision: number) {
  if (state.revision !== expectedRevision)
    throw new Error(
      "Los datos cambiaron mientras editabas. Cierra y abre la ventana para revisar el saldo actualizado.",
    );
}
export function updateStock(
  state: State,
  actor: Actor,
  id: string,
  input: {
    lot: string;
    warehouseId: string;
    expiry: string;
    grams: number;
    document: string;
    reason: string;
  },
  operationKey: string,
  expectedRevision: number,
) {
  allowed(actor, ["Logística"]);
  unchanged(state, expectedRevision);
  const stock = state.stocks.find((s) => s.id === id);
  if (!stock) throw new Error("No se encontró el lote.");
  const lot = text(input.lot, "Lote").toUpperCase();
  const document = text(input.document, "Documento");
  const reason = text(input.reason, "Motivo de corrección");
  dateValid(input.expiry);
  if (
    !Number.isSafeInteger(input.grams) ||
    input.grams < 0 ||
    input.grams > 999_999_999_999
  )
    throw new Error("Ingresa existencias válidas, iguales o mayores que cero.");
  if (!state.warehouses.some((w) => w.id === input.warehouseId))
    throw new Error("Selecciona una bodega válida.");
  if (input.grams < reserved(state, id))
    throw new Error(
      "Las existencias corregidas no pueden ser menores que los kilos reservados.",
    );
  if (state.movements.some((m) => m.operationKey === operationKey))
    throw new Error("Esta corrección ya está registrada.");
  const identityChange =
    lot !== stock.lot ||
    input.warehouseId !== stock.warehouseId ||
    input.expiry !== stock.expiry;
  if (
    identityChange &&
    state.orders.some((o) =>
      o.lines.some((l) => l.allocations.some((a) => a.stockId === id)),
    )
  )
    throw new Error(
      "Este lote está vinculado a pedidos. Puedes corregir las existencias; lote, bodega y vencimiento deben conservarse para mantener sus documentos.",
    );
  if (
    state.stocks.some(
      (s) =>
        s.id !== id &&
        s.materialId === stock.materialId &&
        s.lot === lot &&
        s.warehouseId === input.warehouseId,
    )
  )
    throw new Error("Ya existe ese material, lote y bodega.");
  if (
    state.stocks.some(
      (s) =>
        s.id !== id &&
        s.materialId === stock.materialId &&
        s.lot === lot &&
        s.expiry !== input.expiry,
    )
  )
    throw new Error(
      "El lote tiene otra fecha de vencimiento en una bodega relacionada.",
    );
  const before = { ...stock, grams: balance(state, id) };
  const delta = input.grams - before.grams;
  stock.lot = lot;
  stock.warehouseId = input.warehouseId;
  stock.expiry = input.expiry;
  if (delta)
    movement(state, actor, {
      operationKey,
      stockId: id,
      type: "Ajuste",
      grams: delta,
      document,
      reason,
    });
  log(
    state,
    actor,
    "Inventario corregido",
    lot +
      " · " +
      kg(before.grams) +
      " a " +
      kg(input.grams) +
      " kg · " +
      document +
      " · " +
      reason,
    { before, after: { ...stock, grams: input.grams } },
  );
}
export function correctMovement(
  state: State,
  actor: Actor,
  id: string,
  input: { grams: number; document: string; reason: string },
  operationKey: string,
  expectedRevision: number,
) {
  allowed(actor, ["Logística"]);
  unchanged(state, expectedRevision);
  const original = state.movements.find((m) => m.id === id);
  if (!original || !["Entrada", "Baja"].includes(original.type))
    throw new Error(
      "Solo se pueden corregir o anular entradas y bajas manuales.",
    );
  if (state.movements.some((m) => m.correctsId === id))
    throw new Error("Este movimiento ya fue corregido o anulado.");
  const document = text(input.document, "Documento");
  const reason = text(input.reason, "Motivo de corrección");
  if (input.grams !== 0) positive(input.grams);
  const signed = original.grams > 0 ? input.grams : -input.grams;
  const delta = signed - original.grams;
  if (
    balance(state, original.stockId) + delta <
    reserved(state, original.stockId)
  )
    throw new Error(
      "La corrección afecta kilos reservados o dejaría existencias negativas.",
    );
  // A zero-quantity adjustment still records a document-only correction and prevents duplicate reversal.
  movement(state, actor, {
    operationKey,
    stockId: original.stockId,
    type: input.grams ? "Ajuste" : "Reversión",
    grams: delta,
    document,
    reason:
      reason +
      " · Corrige " +
      original.document +
      " (" +
      kg(Math.abs(original.grams)) +
      " kg) a " +
      kg(input.grams) +
      " kg",
    correctsId: original.id,
  });
  log(
    state,
    actor,
    input.grams ? "Movimiento corregido" : "Movimiento anulado",
    original.document +
      " · " +
      kg(Math.abs(original.grams)) +
      " a " +
      kg(input.grams) +
      " kg · " +
      document +
      " · " +
      reason,
    {
      before: structuredClone(original),
      after: { ...input, originalId: original.id },
    },
  );
}
