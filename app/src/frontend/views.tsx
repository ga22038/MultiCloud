import {
  workflowDefinition,
  workflowOrders,
  type WorkflowModule,
} from "../workflow";
import { useState } from "react";
import {
  ClipboardList,
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  ShieldCheck,
  CircleCheck,
  Clock3,
  FileText,
  Boxes,
  ChevronRight,
  Users,
  Warehouse as WarehouseIcon,
  Layers3,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  available,
  balance,
  daysToExpiry,
  expired,
  kg,
  reserved,
  today,
  newestFirst,
  registrationDate,
} from "../domain";
import type { State, Order, Movement, CatalogKind } from "../domain";
import type { View } from "./App";
import {
  Badge,
  ExportButton,
  Empty,
  Field,
  PageTitle,
  SearchBox,
  TextLink,
  Pagination,
} from "./components";
import { usePagination } from "./pagination";
import { dateLabel } from "../dates";
import { kardexCsv, inventoryPdf, ordersPdf, kardexPdf } from "./documents";
import { exportBackup, useConnection } from "./store";

export function Overview({
  state,
  canOrder,
  canStock,
  go,
  onOrder,
  onReceipt,
  onDetail,
}: {
  state: State;
  canOrder: boolean;
  canStock: boolean;
  go: (view: View) => void;
  onOrder: () => void;
  onReceipt: () => void;
  onDetail: (id: string) => void;
}) {
  const pending = state.orders.filter((o) =>
    ["Nuevo", "Asignado"].includes(o.status),
  ).length;
  const ready = state.orders.filter((o) => o.status === "Confirmado").length;
  const total = state.movements.reduce((s, m) => s + m.grams, 0);
  const warnings = state.stocks
    .filter((s) => balance(state, s.id) > 0 && daysToExpiry(s) <= 30)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  const reservedTotal = state.stocks.reduce(
    (s, lot) => s + reserved(state, lot.id),
    0,
  );
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today()}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const day = d.toISOString().slice(0, 10);
    const rows = state.movements.filter(
      (m) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
          new Date(m.at),
        ) === day,
    );
    return {
      day,
      label: new Intl.DateTimeFormat("es-CO", { weekday: "short" })
        .format(d)
        .replace(".", ""),
      incoming: rows
        .filter((m) => m.grams > 0)
        .reduce((s, m) => s + m.grams, 0),
      outgoing: -rows
        .filter((m) => m.grams < 0)
        .reduce((s, m) => s + m.grams, 0),
    };
  });
  const max = Math.max(1000, ...trend.flatMap((t) => [t.incoming, t.outgoing]));
  return (
    <>
      <PageTitle
        eyebrow="TU OPERACIÓN, EN UN SOLO LUGAR"
        title="Resumen de operaciones"
        description="Pedidos, despacho, inventario y facturación en un mismo espacio."
      >
        {canStock && (
          <button className="button secondary" onClick={onReceipt}>
            <ArrowDownLeft size={17} />
            Registrar entrada
          </button>
        )}
        {canOrder && (
          <button className="button primary" onClick={onOrder}>
            <Plus size={18} />
            Nuevo pedido
          </button>
        )}
      </PageTitle>
      <div className="metrics">
        <Metric
          label="Pedidos en gestión"
          value={String(pending).padStart(2, "0")}
          detail="Pendientes de asignar o confirmar"
          icon={ClipboardList}
          color="blue"
        />
        <Metric
          label="Listos para facturar"
          value={String(ready).padStart(2, "0")}
          detail="Lote y cantidad confirmados"
          icon={CircleCheck}
          color="green"
        />
        <Metric
          label="Existencias totales"
          value={kg(total)}
          suffix="kg"
          detail={`${kg(reservedTotal)} kg reservados`}
          icon={Boxes}
          color="violet"
        />
        <Metric
          label="Lotes por revisar"
          value={String(warnings.length).padStart(2, "0")}
          detail="Vencidos o vencen en 30 días"
          icon={Clock3}
          color="orange"
        />
      </div>
      <section className="process-card">
        <div className="process-intro">
          <span className="eyebrow">FLUJO DE PEDIDOS</span>
          <h2>Cada etapa, bajo control</h2>
        </div>
        <div className="process-steps">
          {[
            {
              label: "Crear pedido",
              text: "Customer",
              count: state.orders.filter((o) => o.status === "Nuevo").length,
              icon: ClipboardList,
            },
            {
              label: "Asignar lote",
              text: "Logística",
              count: state.orders.filter((o) => o.status === "Asignado").length,
              icon: Package,
            },
            {
              label: "Confirmar salida",
              text: "Descuenta inventario",
              count: ready,
              icon: ShieldCheck,
            },
            {
              label: "Registrar factura",
              text: "Facturación",
              count: state.orders.filter((o) => o.status === "Facturado")
                .length,
              icon: FileText,
            },
          ].map((step, i) => (
            <div className="process-step" key={step.label}>
              <div className={`step-circle step-${i}`}>
                <step.icon size={18} />
              </div>
              <div>
                <strong>{step.label}</strong>
                <small>{step.text}</small>
              </div>
              <span className="step-count">{step.count}</span>
              {i < 3 && <ChevronRight className="step-chevron" size={16} />}
            </div>
          ))}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel orders-panel">
          <div className="panel-heading">
            <div>
              <h2>Pedidos recientes</h2>
              <p>Lo que está pasando en tu operación.</p>
            </div>
            <TextLink onClick={() => go("orders")}>Ver todos</TextLink>
          </div>
          <OrderTable
            state={state}
            orders={state.orders.slice(0, 5)}
            onDetail={onDetail}
            compact
          />
        </section>
        <section className="panel expiry-panel">
          <div className="panel-heading">
            <div>
              <h2>Atención a vencimientos</h2>
              <p>Prioriza los lotes que necesitan acción.</p>
            </div>
            <span className="counter orange-counter">{warnings.length}</span>
          </div>
          <div className="expiry-list">
            {warnings.slice(0, 4).map((stock) => {
              const material = state.materials.find(
                (m) => m.id === stock.materialId,
              )!;
              const days = daysToExpiry(stock);
              return (
                <div className="expiry-item" key={stock.id}>
                  <div
                    className={`expiry-icon ${days < 0 ? "expired-icon" : ""}`}
                  >
                    <Package size={18} />
                  </div>
                  <div className="expiry-info">
                    <strong>{material.name}</strong>
                    <small>
                      {stock.lot} · {kg(balance(state, stock.id))} kg
                    </small>
                    <small>
                      {
                        state.warehouses.find((w) => w.id === stock.warehouseId)
                          ?.name
                      }
                    </small>
                  </div>
                  <span
                    className={`expiry-days ${days < 0 ? "expired-text" : ""}`}
                  >
                    {days < 0 ? "Vencido" : `${days} días`}
                  </span>
                </div>
              );
            })}
            {!warnings.length && <Empty text="Todos tus lotes están al día." />}
          </div>
          <button className="panel-bottom-link" onClick={() => go("inventory")}>
            Revisar inventario
            <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="panel movement-panel">
          <div className="panel-heading">
            <div>
              <h2>Movimiento de inventario</h2>
              <p>Últimos 7 días · cantidades en kilos</p>
            </div>
            <div className="chart-legend">
              <span>
                <i />
                Entradas
              </span>
              <span>
                <i />
                Salidas
              </span>
            </div>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Entradas: ${kg(trend.reduce((s, t) => s + t.incoming, 0))} kilos. Salidas: ${kg(trend.reduce((s, t) => s + t.outgoing, 0))} kilos en los últimos siete días.`}
          >
            <div className="chart-axis">
              <span>{kg(max)}</span>
              <span>{kg(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-columns">
              {trend.map((t) => (
                <div className="chart-column" key={t.day}>
                  <div
                    className="bars"
                    title={`${t.day}: entrada ${kg(t.incoming)} kg; salida ${kg(t.outgoing)} kg`}
                  >
                    <span
                      className="bar incoming"
                      style={{ height: `${(t.incoming / max) * 100}%` }}
                    />
                    <span
                      className="bar outgoing"
                      style={{ height: `${(t.outgoing / max) * 100}%` }}
                    />
                  </div>
                  <small>{t.label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Una operación con trazabilidad.</p>
            </div>
            <Activity size={19} />
          </div>
          <div className="activity-list">
            {state.audit.slice(0, 4).map((a, i) => (
              <div className="activity-item" key={a.id}>
                <span className={`activity-dot ${i === 0 ? "latest" : ""}`} />
                <div>
                  <strong>{a.action}</strong>
                  <p>{a.detail}</p>
                  <small>
                    {dateLabel(a.at, true)} · {a.actor}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  suffix,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="metric">
      <div className="metric-heading">
        <span>{label}</span>
        <div className={`metric-icon ${color}`}>
          <Icon size={19} />
        </div>
      </div>
      <div className="metric-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}
function OrderTable({
  state,
  orders,
  onDetail,
  compact = false,
  actionLabel = "Ver pedido",
}: {
  state: State;
  orders: Order[];
  onDetail: (id: string) => void;
  compact?: boolean;
  actionLabel?: string;
}) {
  const sorted = orders
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const p = usePagination(
    sorted.length,
    JSON.stringify(sorted.map((o) => o.id)),
  );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido / Cliente</th>
              {!compact && <th>Materiales</th>}
              <th className="numeric">Cantidad</th>
              <th>Estado</th>
              {!compact && <th>Creado</th>}
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(p.start, p.end).map((order) => (
              <tr key={order.id}>
                <td>
                  <button
                    className="row-title"
                    onClick={() => onDetail(order.id)}
                  >
                    {order.number}
                  </button>
                  <small className="cell-subtitle">
                    {
                      state.customers.find((c) => c.id === order.customerId)
                        ?.name
                    }
                  </small>
                </td>
                {!compact && (
                  <td>
                    <span>
                      {
                        state.materials.find(
                          (m) => m.id === order.lines[0].materialId,
                        )?.name
                      }
                    </span>
                    <small className="cell-subtitle">
                      {order.lines.length > 1
                        ? `+ ${order.lines.length - 1} material(es)`
                        : state.materials.find(
                            (m) => m.id === order.lines[0].materialId,
                          )?.code}
                    </small>
                  </td>
                )}
                <td className="numeric">
                  <strong>
                    {kg(order.lines.reduce((s, l) => s + l.grams, 0))}
                  </strong>
                  <small className="unit"> kg</small>
                </td>
                <td>
                  <Badge status={order.status} />
                </td>
                {!compact && (
                  <td className="muted">{dateLabel(order.createdAt)}</td>
                )}
                <td>
                  <button
                    className="icon-button row-open"
                    aria-label={`${actionLabel} ${order.number}`}
                    onClick={() => onDetail(order.id)}
                  >
                    {!compact && <span>{actionLabel}</span>}
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <Empty />}
      </div>
      <Pagination pagination={p} />
    </>
  );
}

export function Orders({
  state,
  module = "orders",
  canOrder,
  onNew,
  onDetail,
}: {
  state: State;
  module?: WorkflowModule;
  canOrder: boolean;
  onNew: () => void;
  onDetail: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const definition = workflowDefinition[module];
  const source = workflowOrders(state, module);
  const rows = source.filter(
    (o) =>
      (status === "Todos" || o.status === status) &&
      `${o.number} ${state.customers.find((c) => c.id === o.customerId)?.name} ${o.lines
        .map((l) => {
          const m = state.materials.find((m) => m.id === l.materialId);
          return `${m?.code} ${m?.name}`;
        })
        .join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
      >
        <ExportButton
          onExport={() => ordersPdf(state, rows, definition.title)}
        />
        {canOrder && module === "orders" && (
          <button className="button primary" onClick={onNew}>
            <Plus size={18} />
            Nuevo pedido
          </button>
        )}
      </PageTitle>
      <div className="workflow-summary">
        <div>
          <span>En este módulo</span>
          <strong>{source.length}</strong>
        </div>
        <div>
          <span>{module === "billing" ? "Por facturar" : "Por preparar"}</span>
          <strong>
            {
              source.filter(
                (o) =>
                  o.status === (module === "billing" ? "Confirmado" : "Nuevo"),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>
            {module === "billing" ? "Facturas registradas" : "Lotes asignados"}
          </span>
          <strong>
            {
              source.filter(
                (o) =>
                  o.status ===
                  (module === "billing" ? "Facturado" : "Asignado"),
              ).length
            }
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="tabs" role="group" aria-label="Filtrar por estado">
          {["Todos", ...definition.statuses].map((s) => (
            <button
              className={status === s ? "tab active" : "tab"}
              key={s}
              onClick={() => setStatus(s)}
            >
              {s === "Confirmado" ? "Por facturar" : s}
              <span>
                {source.filter((o) => s === "Todos" || o.status === s).length}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar pedido, cliente o material…"
          />
          <span className="muted">{rows.length} pedidos</span>
        </div>
        <OrderTable
          state={state}
          orders={rows}
          onDetail={onDetail}
          actionLabel={definition.action}
        />
      </section>
      <div className="info-note">
        <ShieldCheck size={18} />
        <span>
          Confirmar lote y cantidad registra la salida en el kardex. Registrar
          la factura no vuelve a descontar inventario.
        </span>
      </div>
    </>
  );
}

export function Inventory({
  state,
  canStock,
  onReceipt,
  onWriteOff,
  onEdit,
}: {
  state: State;
  canStock: boolean;
  onReceipt: () => void;
  onWriteOff: () => void;
  onEdit: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [expiry, setExpiry] = useState("");
  const rows = newestFirst(
    state.stocks.filter((s) => {
      const material = state.materials.find((m) => m.id === s.materialId)!;
      return (
        (!warehouse || s.warehouseId === warehouse) &&
        (!expiry ||
          (expiry === "expired"
            ? expired(s)
            : !expired(s) && daysToExpiry(s) <= 30)) &&
        `${material.name} ${material.code} ${s.lot}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    }),
    (s) => registrationDate(state, "stocks", s.id),
  );
  const p = usePagination(
    rows.length,
    [query, warehouse, expiry, state.revision].join("|"),
  );
  const total = rows.reduce((s, stock) => s + balance(state, stock.id), 0);
  const reserve = rows.reduce((s, stock) => s + reserved(state, stock.id), 0);
  const usable = rows
    .filter((s) => !expired(s))
    .reduce((s, stock) => s + available(state, stock.id), 0);
  return (
    <>
      <PageTitle
        eyebrow="CONTROL POR MATERIAL, LOTE Y BODEGA"
        title="Inventario"
        description="Conoce las existencias, las reservas y la fecha de cada lote."
      >
        <ExportButton onExport={() => inventoryPdf(state, rows)} />
        {canStock && (
          <>
            <button className="button secondary" onClick={onWriteOff}>
              <ArrowUpRight size={17} />
              Registrar baja
            </button>
            <button className="button primary" onClick={onReceipt}>
              <Plus size={18} />
              Registrar entrada
            </button>
          </>
        )}
      </PageTitle>
      <div className="stock-summary">
        <div>
          <span>Existencias físicas</span>
          <strong>
            {kg(total)} <small>kg</small>
          </strong>
        </div>
        <div>
          <span>Reservado en pedidos</span>
          <strong>
            {kg(reserve)} <small>kg</small>
          </strong>
        </div>
        <div>
          <span>Disponible vigente</span>
          <strong className="green-text">
            {kg(usable)} <small>kg</small>
          </strong>
        </div>
        <div>
          <span>Lotes / Bodega</span>
          <strong>{rows.length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar filters">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar código, material o lote…"
          />
          <select
            aria-label="Filtrar inventario por bodega"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">Todas las bodegas</option>
            {state.warehouses.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por vencimiento"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            <option value="">Todos los vencimientos</option>
            <option value="soon">Vencen en 30 días</option>
            <option value="expired">Vencidos</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Lote / Bodega</th>
                <th>Fecha de ingreso</th>
                <th>Vencimiento</th>
                <th className="numeric">Existencias kg</th>
                <th className="numeric">Reservado kg</th>
                <th className="numeric">Disponible kg</th>
                {canStock && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(p.start, p.end).map((stock) => {
                const m = state.materials.find(
                  (m) => m.id === stock.materialId,
                )!;
                return (
                  <tr key={stock.id}>
                    <td>
                      <strong>{m.name}</strong>
                      <small className="cell-subtitle">
                        {m.code} · {m.category}
                      </small>
                    </td>
                    <td>
                      <span className="lot-code">{stock.lot}</span>
                      <small className="cell-subtitle">
                        {
                          state.warehouses.find(
                            (w) => w.id === stock.warehouseId,
                          )?.name
                        }
                      </small>
                    </td>
                    <td className="date-cell">
                      {dateLabel(registrationDate(state, "stocks", stock.id))}
                    </td>
                    <td>
                      <span
                        className={
                          expired(stock)
                            ? "expired-text"
                            : daysToExpiry(stock) <= 30
                              ? "orange-text"
                              : ""
                        }
                      >
                        {dateLabel(stock.expiry)}
                      </span>
                      <small className="cell-subtitle">
                        {expired(stock)
                          ? "Lote vencido"
                          : `${daysToExpiry(stock)} días restantes`}
                      </small>
                    </td>
                    <td className="numeric">{kg(balance(state, stock.id))}</td>
                    <td className="numeric muted">
                      {kg(reserved(state, stock.id))}
                    </td>
                    <td
                      className={`numeric ${expired(stock) ? "muted" : "green-text"}`}
                    >
                      <strong>
                        {expired(stock)
                          ? kg(0)
                          : kg(available(state, stock.id))}
                      </strong>
                    </td>
                    {canStock && (
                      <td>
                        <button
                          className="icon-button table-edit"
                          title="Editar registro"
                          onClick={() => onEdit(stock.id)}
                          aria-label={`Editar lote ${stock.lot}`}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <Empty />}
        </div>
        <Pagination pagination={p} />
      </section>
      <div className="info-note">
        <Layers3 size={18} />
        <span>
          Existencias calculadas desde el kardex. Los lotes vencidos conservan
          su saldo físico y no están disponibles para pedidos.
        </span>
      </div>
    </>
  );
}

export function Kardex({
  state,
  canStock,
  onCorrect,
}: {
  state: State;
  canStock: boolean;
  onCorrect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [material, setMaterial] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const invalidRange = Boolean(start && end && start > end);
  const rows = newestFirst(
    state.movements.filter((m) => {
      const stock = state.stocks.find((s) => s.id === m.stockId)!;
      const item = state.materials.find((p) => p.id === stock.materialId)!;
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/El_Salvador",
      }).format(new Date(m.at));
      return (
        !invalidRange &&
        (!type || m.type === type) &&
        (!material || stock.materialId === material) &&
        (!warehouse ||
          (m.snapshot?.warehouseId ?? stock.warehouseId) === warehouse) &&
        (!start || day >= start) &&
        (!end || day <= end) &&
        `${m.snapshot?.lot ?? stock.lot} ${m.document} ${m.actor} ${m.reason} ${m.snapshot?.materialName ?? item.name} ${m.snapshot?.materialCode ?? item.code}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    }),
    (m) => m.at,
  );
  const p = usePagination(
    rows.length,
    [query, type, material, warehouse, start, end, state.revision].join("|"),
  );
  const incoming = rows
    .filter((m) => m.grams > 0)
    .reduce((s, m) => s + m.grams, 0);
  const outgoing = -rows
    .filter((m) => m.grams < 0)
    .reduce((s, m) => s + m.grams, 0);
  return (
    <>
      <PageTitle
        eyebrow="EL HISTORIAL DE CADA KILO"
        title="Kardex de inventario"
        description="Entradas, salidas y bajas. Un registro permanente de tu operación."
      >
        <ExportButton onExport={() => kardexPdf(state, rows)} />
        <button
          className="button secondary"
          disabled={invalidRange || !rows.length}
          onClick={() => kardexCsv(state, rows)}
        >
          <Download size={17} />
          Exportar CSV
        </button>
      </PageTitle>
      <div className="kardex-summary">
        <span>
          <i className="green-dot" />
          Entradas<strong>{kg(incoming)} kg</strong>
        </span>
        <span>
          <i className="orange-dot" />
          Salidas y bajas<strong>{kg(outgoing)} kg</strong>
        </span>
        <span>
          Movimientos<strong>{rows.length}</strong>
        </span>
      </div>
      <section className="panel">
        <div className="table-toolbar filters">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar lote, documento o responsable…"
          />
          <select
            aria-label="Filtrar kardex por material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            <option value="">Todos los materiales</option>
            {state.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar kardex por bodega"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">Todas las bodegas</option>
            {state.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo de movimiento"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos los movimientos</option>
            <option>Entrada</option>
            <option>Salida por pedido</option>
            <option>Baja</option>
            <option>Ajuste</option>
            <option>Reversión</option>
          </select>
        </div>
        <div className="date-filters">
          <Field label="Desde">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <span>
            El saldo corresponde a cada combinación de material, lote y bodega.
          </span>
        </div>
        {invalidRange && (
          <p className="form-error" role="alert">
            La fecha inicial no puede ser posterior a la fecha final.
          </p>
        )}
        <div className="table-scroll">
          <table className="kardex-table">
            <thead>
              <tr>
                <th>Fecha de registro / Documento</th>
                <th>Material / Lote</th>
                <th>Bodega</th>
                <th>Movimiento</th>
                <th className="numeric">Cantidad kg</th>
                <th className="numeric">Saldo kg</th>
                <th>Responsable / Motivo</th>
                {canStock && (
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(p.start, p.end).map((m) => (
                <KardexRow
                  key={m.id}
                  state={state}
                  movement={m}
                  canStock={canStock}
                  onCorrect={onCorrect}
                />
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty />}
        </div>
        <Pagination pagination={p} />
      </section>
    </>
  );
}
function KardexRow({
  state,
  movement: m,
  canStock,
  onCorrect,
}: {
  state: State;
  movement: Movement;
  canStock: boolean;
  onCorrect: (id: string) => void;
}) {
  const stock = state.stocks.find((s) => s.id === m.stockId)!;
  const material = state.materials.find((p) => p.id === stock.materialId)!;
  const corrected = state.movements.some((row) => row.correctsId === m.id);
  return (
    <tr>
      <td>
        <strong className="date-cell">{dateLabel(m.at)}</strong>
        <small className="cell-subtitle">{m.document}</small>
      </td>
      <td>
        <span>{m.snapshot?.materialName ?? material.name}</span>
        <small className="cell-subtitle">
          {m.snapshot?.materialCode ?? material.code} ·{" "}
          {m.snapshot?.lot ?? stock.lot}
        </small>
      </td>
      <td>
        {m.snapshot?.warehouseName ??
          state.warehouses.find((w) => w.id === stock.warehouseId)?.name}
      </td>
      <td>
        <span
          className={`movement-type ${m.grams > 0 ? "movement-in" : "movement-out"}`}
        >
          {m.grams > 0 ? (
            <ArrowDownLeft size={13} />
          ) : (
            <ArrowUpRight size={13} />
          )}
          {m.type}
        </span>
        {corrected && (
          <small className="cell-subtitle">Corregido / anulado</small>
        )}
      </td>
      <td className={`numeric ${m.grams < 0 ? "orange-text" : ""}`}>
        <span>
          {m.grams > 0 ? "+" : m.grams < 0 ? "−" : ""}
          {kg(Math.abs(m.grams))}
        </span>
      </td>
      <td className="numeric">
        <strong>{kg(m.balance)}</strong>
      </td>
      <td>
        <span className="small-text">{m.actor}</span>
        <details className="movement-details">
          <summary>Ver motivo</summary>
          <p>{m.reason}</p>
        </details>
      </td>
      {canStock && (
        <td>
          {["Entrada", "Baja"].includes(m.type) && !corrected ? (
            <button
              className="icon-button table-edit"
              title="Corregir o anular movimiento"
              onClick={() => onCorrect(m.id)}
              aria-label={`Corregir movimiento ${m.document}`}
            >
              <Pencil size={16} />
            </button>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

export function Catalogs({
  state,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
}: {
  state: State;
  isAdmin: boolean;
  onAdd: (kind: CatalogKind) => void;
  onEdit: (kind: CatalogKind, id: string) => void;
  onDelete: (kind: CatalogKind, id: string) => void;
}) {
  const [tab, setTab] = useState<"customers" | "materials" | "warehouses">(
    "customers",
  );
  const [query, setQuery] = useState("");
  const customers = state.customers.filter((c) =>
    `${c.name} ${c.nit} ${c.city}`.toLowerCase().includes(query.toLowerCase()),
  );
  const materials = state.materials.filter((m) =>
    `${m.name} ${m.code} ${m.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const warehouses = state.warehouses.filter((w) =>
    `${w.name} ${w.city}`.toLowerCase().includes(query.toLowerCase()),
  );
  const rows = newestFirst<{ id: string }>(
    tab === "customers"
      ? customers
      : tab === "materials"
        ? materials
        : warehouses,
    (item) => registrationDate(state, tab, item.id),
  );
  const p = usePagination(rows.length, [tab, query, state.revision].join("|"));
  const visibleIds = new Set(rows.slice(p.start, p.end).map((item) => item.id));
  const actions = (id: string, name: string) =>
    isAdmin && (
      <td>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label={"Editar " + name}
            title="Editar"
            onClick={() => onEdit(tab, id)}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button text-danger"
            aria-label={"Eliminar " + name}
            title="Eliminar"
            onClick={() => onDelete(tab, id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    );
  return (
    <>
      <PageTitle
        eyebrow="LOS DATOS QUE CONECTAN TU OPERACIÓN"
        title="Catálogos"
        description="Clientes, materiales y bodegas listos para tus pedidos."
      >
        {isAdmin && (
          <button className="button primary" onClick={() => onAdd(tab)}>
            <Plus size={18} />
            Agregar{" "}
            {tab === "customers"
              ? "cliente"
              : tab === "materials"
                ? "material"
                : "bodega"}
          </button>
        )}
      </PageTitle>
      <section className="panel">
        <div className="tabs">
          {(
            [
              { key: "customers", label: "Clientes", icon: Users },
              { key: "materials", label: "Materiales", icon: Package },
              { key: "warehouses", label: "Bodegas", icon: WarehouseIcon },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => {
                setTab(t.key);
                setQuery("");
              }}
            >
              <t.icon size={16} />
              {t.label}
              <span>{state[t.key].length}</span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar en el catálogo…"
          />
        </div>
        <div className="table-scroll">
          {tab === "customers" && (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>NIT</th>
                  <th>Ciudad</th>
                  <th>Fecha de registro</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((item) => visibleIds.has(item.id))
                  .map((item) => customers.find((row) => row.id === item.id)!)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.nit}</td>
                      <td>{c.city}</td>
                      <td className="date-cell">
                        {dateLabel(registrationDate(state, tab, c.id))}
                      </td>
                      {actions(c.id, c.name)}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {tab === "materials" && (
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Fecha de registro</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((item) => visibleIds.has(item.id))
                  .map((item) => materials.find((row) => row.id === item.id)!)
                  .map((m) => (
                    <tr key={m.id}>
                      <td className="lot-code">{m.code}</td>
                      <td>
                        <strong>{m.name}</strong>
                      </td>
                      <td>{m.category}</td>
                      <td>Kilogramos</td>
                      <td className="date-cell">
                        {dateLabel(registrationDate(state, tab, m.id))}
                      </td>
                      {actions(m.id, m.name)}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {tab === "warehouses" && (
            <table>
              <thead>
                <tr>
                  <th>Bodega</th>
                  <th>Ciudad</th>
                  <th className="numeric">Existencias kg</th>
                  <th>Fecha de registro</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((item) => visibleIds.has(item.id))
                  .map((item) => warehouses.find((row) => row.id === item.id)!)
                  .map((w) => (
                    <tr key={w.id}>
                      <td>
                        <strong>{w.name}</strong>
                      </td>
                      <td>{w.city}</td>
                      <td className="numeric">
                        {kg(
                          state.stocks
                            .filter((s) => s.warehouseId === w.id)
                            .reduce((sum, s) => sum + balance(state, s.id), 0),
                        )}
                      </td>
                      <td className="date-cell">
                        {dateLabel(registrationDate(state, tab, w.id))}
                      </td>
                      {actions(w.id, w.name)}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {(tab === "customers"
            ? customers
            : tab === "materials"
              ? materials
              : warehouses
          ).length === 0 && <Empty />}
        </div>
        <Pagination pagination={p} />
      </section>
    </>
  );
}

export function SettingsView({ state }: { state: State; isAdmin: boolean }) {
  const connection = useConnection();
  return (
    <>
      <PageTitle
        eyebrow="POLARIS UES"
        title="Configuración"
        description="Inventario y pedidos con control central de operaciones."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <Layers3 size={24} />
          <h2>Estado del sistema</h2>
          <p>
            Sesión: {connection.name}. Sitio: {connection.site || "local"}.
          </p>
          <div className="settings-detail">
            <span>Pedidos</span>
            <strong>{state.orders.length}</strong>
          </div>
          <div className="settings-detail">
            <span>Movimientos</span>
            <strong>{state.movements.length}</strong>
          </div>
          <div className="settings-detail">
            <span>Revisión</span>
            <strong>{state.revision}</strong>
          </div>
          <button className="button secondary" onClick={exportBackup}>
            <Download size={16} />
            Exportar datos JSON
          </button>
        </section>
        <section className="panel settings-panel">
          <ShieldCheck size={24} />
          <h2>Reglas de inventario</h2>
          <ul className="rules-list">
            <li>Asignar un lote reserva existencias.</li>
            <li>Confirmar registra una única salida.</li>
            <li>Facturar no descuenta nuevamente.</li>
            <li>Los lotes vencidos no se asignan.</li>
            <li>Las correcciones conservan el historial.</li>
            <li>Precisión: 0,001 kg.</li>
          </ul>
        </section>
        <section className="panel settings-panel">
          <h2>Acceso por rol</h2>
          <p>
            El servidor valida el rol de la sesión en cada operación. El
            administrador puede cambiar la vista de trabajo.
          </p>
          <div className="role-definition">
            <strong>Customer</strong>
            <span>Crea y consulta pedidos internos.</span>
          </div>
          <div className="role-definition">
            <strong>Logística</strong>
            <span>Asigna lotes, confirma salidas y gestiona existencias.</span>
          </div>
          <div className="role-definition">
            <strong>Facturación</strong>
            <span>Registra referencias de factura.</span>
          </div>
          <div className="role-definition">
            <strong>Administrador</strong>
            <span>Gestiona catálogos y todas las operaciones.</span>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Control de operaciones</h2>
          <p>
            Los cambios se validan y guardan en una transacción. Una versión
            anterior requiere actualizar antes de guardar.
          </p>
          <p>
            Si una respuesta se pierde, comprueba la operación pendiente antes
            de registrar otro cambio.
          </p>
          <div className="info-note compact">
            <FileText size={18} />
            <span>
              El sistema registra la referencia de factura. No emite facturas
              electrónicas.
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
