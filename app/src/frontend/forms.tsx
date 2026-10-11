import type { WorkflowModule } from "../workflow";
import type { Command } from "../commands";
import { useState } from "react";
import {
  Plus,
  Trash2,
  WandSparkles,
  Download,
  ShieldCheck,
  CircleCheck,
  Package,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import type {
  Actor,
  Allocation,
  Order,
  State,
  CatalogKind,
  Customer,
  Material,
  Warehouse,
} from "../domain";
import {
  available,
  balance,
  expired,
  kg,
  parseKg,
  suggestFefo,
  today,
} from "../domain";
import { Badge, Field } from "./components";
import { dateLabel } from "../dates";

type Save = (
  change: () => Command,
  success: string,
  closeAfter?: boolean,
) => Promise<void>;
interface Props {
  state: State;
  actor: Actor;
  save: Save;
  busy: boolean;
  error: string;
  onClose: () => void;
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertTriangle size={16} />
      {error}
    </div>
  ) : null;
}
function Actions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="modal-footer">
      <button
        type="button"
        className="button secondary"
        onClick={onClose}
        disabled={busy}
      >
        Volver
      </button>
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? "Guardando…" : label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function MaterialSelect({
  state,
  value,
  onChange,
  label = "Material",
  id,
}: {
  state: State;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Seleccionar material</option>
      {state.materials.map((m) => (
        <option key={m.id} value={m.id}>
          {m.code} · {m.name}
        </option>
      ))}
    </select>
  );
}
function WarehouseSelect({
  state,
  value,
  onChange,
  id,
  disabled,
}: {
  state: State;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      disabled={disabled}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Seleccionar bodega</option>
      {state.warehouses.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
function Qty({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      required
      placeholder="10,000.00"
      maxLength={18}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (/^0+([.,]0+)?$/.test(value.trim())) onChange(kg(0));
        else {
          try {
            onChange(kg(parseKg(value)));
          } catch {
            /* Keep invalid input visible for validation. */
          }
        }
      }}
    />
  );
}

export function OrderForm({ state, save, busy, error, onClose }: Props) {
  const [number, setNumber] = useState(
    `PED-${today().slice(0, 4)}-${String(state.orders.length + 1).padStart(3, "0")}`,
  );
  const [customerId, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { key: crypto.randomUUID(), materialId: "", amount: "" },
  ]);
  const edit = (key: string, field: "materialId" | "amount", value: string) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(() => {
          return {
            type: "createOrder",
            args: [
              {
                number,
                customerId,
                notes,
                lines: lines.map((l) => ({
                  materialId: l.materialId,
                  grams: parseKg(l.amount),
                })),
              },
            ],
          };
        }, "Pedido creado. Logística puede asignar los lotes.");
      }}
    >
      <fieldset disabled={busy} className="form-body">
        <div className="form-grid">
          <Field label="Número de pedido">
            <input
              required
              maxLength={180}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>
          <Field label="Cliente">
            <select
              required
              value={customerId}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Seleccionar cliente</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="section-heading">
          <h3>Materiales solicitados</h3>
          <span className="muted">Unidad: kilogramos</span>
        </div>
        <div className="order-lines">
          {lines.map((line, i) => (
            <div className="order-line" key={line.key}>
              <span className="line-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Field label={`Material ${i + 1}`}>
                <MaterialSelect
                  state={state}
                  value={line.materialId}
                  label={`Material ${i + 1}`}
                  onChange={(value) => edit(line.key, "materialId", value)}
                />
              </Field>
              <Field label={`Cantidad kg ${i + 1}`}>
                <Qty
                  value={line.amount}
                  onChange={(value) => edit(line.key, "amount", value)}
                />
              </Field>
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar material ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() =>
                  setLines(lines.filter((l) => l.key !== line.key))
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="button add-line"
          onClick={() =>
            setLines([
              ...lines,
              { key: crypto.randomUUID(), materialId: "", amount: "" },
            ])
          }
        >
          <Plus size={16} />
          Agregar material
        </button>
        <Field
          label="Observaciones"
          hint="Opcional. Indicaciones para logística."
          wide
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instrucciones de entrega o alistamiento…"
          />
        </Field>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions busy={busy} onClose={onClose} label="Crear pedido" />
    </form>
  );
}

type DraftAllocation = { key: string; stockId: string; amount: string };
function initialAllocations(order: Order): Record<string, DraftAllocation[]> {
  return Object.fromEntries(
    order.lines.map((line) => [
      line.id,
      line.allocations.length
        ? line.allocations.map((a) => ({
            key: crypto.randomUUID(),
            stockId: a.stockId,
            amount: String(a.grams / 1000),
          }))
        : [
            {
              key: crypto.randomUUID(),
              stockId: "",
              amount: String(line.grams / 1000),
            },
          ],
    ]),
  );
}
export function OrderDetail({
  state,
  order,
  actor,
  save,
  busy,
  error,
  onPdf,
  mode = "orders",
  onWorkflow,
}: Omit<Props, "onClose"> & {
  order: Order;
  onPdf: () => void;
  mode?: WorkflowModule;
  onWorkflow: (module: WorkflowModule) => void;
}) {
  const [draft, setDraft] = useState(() => initialAllocations(order));
  const [localError, setLocalError] = useState("");
  const [checked, setChecked] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const logistics =
    mode === "dispatch" &&
    (actor.role === "Administrador" || actor.role === "Logística");
  const billing =
    mode === "billing" &&
    (actor.role === "Administrador" || actor.role === "Facturación");
  const canCancel =
    mode === "orders" &&
    ["Administrador", "Customer", "Logística"].includes(actor.role) &&
    ["Nuevo", "Asignado"].includes(order.status);
  const assignable = logistics && ["Nuevo", "Asignado"].includes(order.status);
  const total = order.lines.reduce((sum, line) => sum + line.grams, 0);
  const update = (
    lineId: string,
    key: string,
    field: "stockId" | "amount",
    value: string,
  ) => {
    setLocalError("");
    setChecked(false);
    setDraft({
      ...draft,
      [lineId]: draft[lineId].map((a) =>
        a.key === key ? { ...a, [field]: value } : a,
      ),
    });
  };
  let dirty = false;
  if (order.status === "Asignado") {
    try {
      dirty = order.lines.some(
        (line) =>
          JSON.stringify(line.allocations) !==
          JSON.stringify(
            draft[line.id].map((a) => ({
              stockId: a.stockId,
              grams: parseKg(a.amount),
            })),
          ),
      );
    } catch {
      dirty = true;
    }
  }
  const suggest = () => {
    setChecked(false);
    try {
      const values = suggestFefo(state, order);
      setDraft(
        Object.fromEntries(
          Object.entries(values).map(([id, values]) => [
            id,
            values.map((a) => ({
              key: crypto.randomUUID(),
              stockId: a.stockId,
              amount: String(a.grams / 1000),
            })),
          ]),
        ),
      );
      setLocalError("");
    } catch (err) {
      setLocalError((err as Error).message);
    }
  };
  return (
    <div className="order-detail">
      <div className="detail-top">
        <Badge status={order.status} />
        <span>Creado {dateLabel(order.createdAt, true)}</span>
        <button
          className="button secondary small-button"
          disabled={busy}
          onClick={onPdf}
        >
          <Download size={15} />
          {mode === "dispatch"
            ? "PDF de alistamiento"
            : mode === "billing"
              ? "Resumen de factura PDF"
              : "Pedido PDF"}
        </button>
      </div>
      <div className="detail-progress">
        {["Nuevo", "Asignado", "Confirmado", "Facturado"].map((stage, i) => {
          const active =
            ["Nuevo", "Asignado", "Confirmado", "Facturado"].indexOf(
              order.status,
            ) >= i;
          return (
            <div className={active ? "done" : ""} key={stage}>
              <span>{active ? <CircleCheck size={16} /> : i + 1}</span>
              {stage === "Confirmado" ? "Salida confirmada" : stage}
            </div>
          );
        })}
      </div>
      <div className="detail-content">
        <div className="section-heading">
          <h3>Detalle del pedido</h3>
          <strong>{kg(total)} kg</strong>
        </div>
        <div className="detail-lines">
          {order.lines.map((line) => {
            const material = state.materials.find(
              (m) => m.id === line.materialId,
            )!;
            return (
              <div key={line.id}>
                <div className="detail-material">
                  <Package size={19} />
                  <div>
                    <strong>{material.name}</strong>
                    <small>
                      {material.code} · {material.category}
                    </small>
                  </div>
                  <strong>{kg(line.grams)} kg</strong>
                </div>
                {line.allocations.map((a) => {
                  const stock = state.stocks.find((s) => s.id === a.stockId)!;
                  return (
                    <div className="saved-allocation" key={a.stockId}>
                      <span className="lot-code">{stock.lot}</span>
                      <span>
                        {
                          state.warehouses.find(
                            (w) => w.id === stock.warehouseId,
                          )?.name
                        }
                      </span>
                      <span>Vence {dateLabel(stock.expiry)}</span>
                      <strong>{kg(a.grams)} kg</strong>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {order.notes && (
          <div className="order-notes">
            <strong>Observaciones</strong>
            <p>{order.notes}</p>
          </div>
        )}
        {mode === "orders" &&
          ["Nuevo", "Asignado", "Confirmado"].includes(order.status) && (
            <div className="workflow-next">
              <div>
                <strong>Siguiente paso</strong>
                <p>
                  {order.status === "Confirmado"
                    ? "La salida está registrada. Continúa en Facturación."
                    : "Continúa en Despacho para asignar lotes y confirmar la salida."}
                </p>
              </div>
              <button
                className="button primary"
                onClick={() =>
                  onWorkflow(
                    order.status === "Confirmado" ? "billing" : "dispatch",
                  )
                }
              >
                {order.status === "Confirmado"
                  ? "Ir a Facturación"
                  : "Ir a Despacho"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        {assignable && (
          <form
            className="assignment-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLocalError("");
              void save(
                () => {
                  const allocations: Record<string, Allocation[]> =
                    Object.fromEntries(
                      order.lines.map((l) => [
                        l.id,
                        draft[l.id].map((a) => ({
                          stockId: a.stockId,
                          grams: parseKg(a.amount),
                        })),
                      ]),
                    );
                  return {
                    type: "allocateOrder",
                    args: [order.id, allocations],
                  };
                },
                "Lotes asignados. Los kilos quedaron reservados.",
                false,
              );
            }}
          >
            <div className="section-heading">
              <div>
                <h3>
                  {order.status === "Asignado"
                    ? "Modificar asignación"
                    : "Asignar lotes y bodegas"}
                </h3>
                <p>
                  Selecciona existencias vigentes. Puedes dividir entre varios
                  lotes.
                </p>
              </div>
              <button
                type="button"
                className="button secondary small-button"
                onClick={suggest}
                disabled={busy}
              >
                <WandSparkles size={15} />
                Sugerir por vencimiento
              </button>
            </div>
            <fieldset disabled={busy}>
              {order.lines.map((line) => (
                <div className="assignment-line" key={line.id}>
                  <strong>
                    {
                      state.materials.find((m) => m.id === line.materialId)
                        ?.name
                    }
                    <span>{kg(line.grams)} kg solicitados</span>
                  </strong>
                  {draft[line.id].map((a, i) => (
                    <div className="assignment-row" key={a.key}>
                      <Field label={`Lote y bodega ${i + 1}`}>
                        <select
                          required
                          value={a.stockId}
                          onChange={(e) =>
                            update(line.id, a.key, "stockId", e.target.value)
                          }
                        >
                          <option value="">Seleccionar lote y bodega</option>
                          {state.stocks
                            .filter(
                              (s) =>
                                s.materialId === line.materialId && !expired(s),
                            )
                            .sort((a, b) => a.expiry.localeCompare(b.expiry))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.lot} ·{" "}
                                {
                                  state.warehouses.find(
                                    (w) => w.id === s.warehouseId,
                                  )?.name
                                }{" "}
                                · {kg(available(state, s.id, order.id))} kg ·
                                vence {s.expiry}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label={`Kilos a asignar ${i + 1}`}>
                        <Qty
                          value={a.amount}
                          onChange={(value) =>
                            update(line.id, a.key, "amount", value)
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Quitar asignación ${i + 1}`}
                        disabled={draft[line.id].length === 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            [line.id]: draft[line.id].filter(
                              (v) => v.key !== a.key,
                            ),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="button add-line small-button"
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        [line.id]: [
                          ...draft[line.id],
                          { key: crypto.randomUUID(), stockId: "", amount: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={15} />
                    Dividir en otro lote
                  </button>
                </div>
              ))}
              <ErrorMessage error={localError || error} />
              <div className="align-right">
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy}
                >
                  Guardar asignación
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {order.status === "Asignado" && logistics && (
          <section className="confirm-box">
            {dirty && (
              <p className="form-error" role="status">
                Guarda los cambios de asignación antes de confirmar la salida.
              </p>
            )}
            <div>
              <ShieldCheck size={23} />
              <div>
                <h3>Confirmar lote y cantidad</h3>
                <p>
                  Se descontarán <strong>{kg(total)} kg</strong> de los lotes
                  asignados y se registrará la salida en el kardex.
                </p>
              </div>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={busy}
              />
              Verifiqué físicamente los lotes y las cantidades de la asignación
              guardada.
            </label>
            <button
              className="button primary"
              disabled={!checked || busy || dirty}
              onClick={() =>
                void save(
                  () => ({ type: "confirmOrder", args: [order.id] }),
                  "Salida confirmada y registrada en el kardex. Listo para facturar.",
                  false,
                )
              }
            >
              <CircleCheck size={17} />
              Confirmar salida de {kg(total)} kg
            </button>
          </section>
        )}
        {order.status === "Confirmado" && (
          <section className="confirmed-box">
            <CircleCheck size={22} />
            <div>
              <h3>Salida registrada en el kardex</h3>
              <p>
                {order.confirmedBy} ·{" "}
                {order.confirmedAt && dateLabel(order.confirmedAt, true)}
              </p>
            </div>
          </section>
        )}
        {order.status === "Confirmado" && mode === "dispatch" && (
          <div className="workflow-next">
            <div>
              <strong>Despacho completado</strong>
              <p>
                La salida ya está registrada. Continúa con la referencia de
                factura.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => onWorkflow("billing")}
            >
              Continuar en Facturación
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {order.status === "Confirmado" && billing && (
          <form
            className="invoice-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                () => ({ type: "invoiceOrder", args: [order.id, invoice] }),
                "Factura registrada. El inventario no se descontó nuevamente.",
                false,
              );
            }}
          >
            <h3>Registrar factura</h3>
            <p>
              Vincula la referencia de la factura emitida en tu sistema de
              facturación.
            </p>
            <div className="invoice-row">
              <Field label="Número de factura">
                <input
                  required
                  maxLength={180}
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="Ej. FV-2026-1050"
                  disabled={busy}
                />
              </Field>
              <button className="button primary" disabled={busy}>
                Registrar factura
              </button>
            </div>
          </form>
        )}
        {order.status === "Facturado" && (
          <section className="confirmed-box">
            <FileInvoice />
            <div>
              <h3>Factura {order.invoice}</h3>
              <p>
                Pedido completado. La salida de inventario ocurrió al confirmar.
              </p>
            </div>
          </section>
        )}
        {!assignable && <ErrorMessage error={error} />}
        {canCancel && (
          <div className="cancel-section">
            {!cancel ? (
              <button
                className="text-danger"
                disabled={busy}
                onClick={() => setCancel(true)}
              >
                Cancelar pedido
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(
                    () => ({ type: "cancelOrder", args: [order.id, reason] }),
                    "Pedido cancelado. Las reservas fueron liberadas.",
                    false,
                  );
                }}
              >
                <Field label="Motivo de cancelación">
                  <input
                    required
                    maxLength={180}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <div className="align-right">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setCancel(false)}
                  >
                    Volver
                  </button>
                  <button className="button danger" disabled={busy}>
                    Confirmar cancelación
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function FileInvoice() {
  return <CircleCheck size={22} />;
}

export function ReceiptForm({ state, save, busy, error, onClose }: Props) {
  const [materialId, setMaterial] = useState("");
  const [warehouseId, setWarehouse] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [amount, setAmount] = useState("");
  const [document, setDocument] = useState("");
  const [reason, setReason] = useState("Recepción de mercancía");
  const [operationKey] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          () => ({
            type: "receive",
            args: [
              {
                materialId,
                warehouseId,
                lot,
                expiry,
                grams: parseKg(amount),
                document,
                reason,
              },
              operationKey,
            ],
          }),
          "Entrada registrada en inventario y kardex.",
        );
      }}
    >
      <fieldset disabled={busy} className="form-body">
        <div className="form-grid">
          <Field label="Material" wide>
            <MaterialSelect
              state={state}
              value={materialId}
              onChange={setMaterial}
            />
          </Field>
          <Field label="Lote">
            <input
              required
              maxLength={180}
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="Ej. AC-261001"
            />
          </Field>
          <Field label="Fecha de vencimiento">
            <input
              type="date"
              required
              min={today()}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
          <Field label="Bodega de entrada">
            <WarehouseSelect
              state={state}
              value={warehouseId}
              onChange={setWarehouse}
            />
          </Field>
          <Field
            label="Cantidad en kilos"
            hint="Ej. 10,000.00. Hasta 3 decimales si se requieren."
          >
            <Qty value={amount} onChange={setAmount} />
          </Field>
          <Field label="Documento de entrada">
            <input
              required
              maxLength={180}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Ej. REC-2026-108"
            />
          </Field>
          <Field label="Motivo">
            <input
              required
              maxLength={180}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions busy={busy} onClose={onClose} label="Registrar entrada" />
    </form>
  );
}

export function WriteOffForm({ state, save, busy, error, onClose }: Props) {
  const [stockId, setStock] = useState("");
  const [amount, setAmount] = useState("");
  const [document, setDocument] = useState("");
  const [reason, setReason] = useState("");
  const [operationKey] = useState(() => crypto.randomUUID());
  const stock = state.stocks.find((s) => s.id === stockId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          () => ({
            type: "writeOff",
            args: [stockId, parseKg(amount), document, reason, operationKey],
          }),
          "Baja registrada. El motivo y la salida quedaron en el kardex.",
        );
      }}
    >
      <fieldset disabled={busy} className="form-body">
        <div className="form-grid">
          <Field label="Material, lote y bodega" wide>
            <select
              required
              value={stockId}
              onChange={(e) => setStock(e.target.value)}
            >
              <option value="">Seleccionar existencias</option>
              {state.stocks
                .filter((s) => balance(state, s.id) > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {state.materials.find((m) => m.id === s.materialId)?.name} ·{" "}
                    {s.lot} ·{" "}
                    {state.warehouses.find((w) => w.id === s.warehouseId)?.name}
                  </option>
                ))}
            </select>
          </Field>
          {stock && (
            <div className="lot-summary field-wide">
              <span>
                Existencias: <strong>{kg(balance(state, stock.id))} kg</strong>
              </span>
              <span>
                Disponible para baja:{" "}
                <strong>{kg(available(state, stock.id))} kg</strong>
              </span>
            </div>
          )}
          <Field label="Cantidad a dar de baja kg">
            <Qty value={amount} onChange={setAmount} />
          </Field>
          <Field label="Documento de baja">
            <input
              required
              maxLength={180}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Ej. BAJA-2026-001"
            />
          </Field>
          <Field label="Motivo de baja" wide>
            <textarea
              required
              maxLength={180}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vencimiento, daño, ajuste documentado…"
            />
          </Field>
        </div>
        <div className="info-note compact">
          <AlertTriangle size={17} />
          <span>
            La baja reduce las existencias. Los kilos reservados en pedidos no
            se pueden dar de baja.
          </span>
        </div>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions busy={busy} onClose={onClose} label="Confirmar baja" />
    </form>
  );
}

export function CatalogForm({
  kind,
  record,
  save,
  busy,
  error,
  onClose,
}: Omit<Props, "state"> & {
  kind: CatalogKind;
  record?: Customer | Material | Warehouse;
}) {
  const [name, setName] = useState(record?.name ?? "");
  const [second, setSecond] = useState(
    record
      ? "code" in record
        ? record.code
        : "nit" in record
          ? record.nit
          : record.city
      : "",
  );
  const [third, setThird] = useState(
    record
      ? "category" in record
        ? record.category
        : "nit" in record
          ? record.city
          : ""
      : "",
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          () => {
            if (record)
              return {
                type: "updateCatalog",
                args: [kind, record.id, { name, second, third }],
              };
            else if (kind === "customers")
              return {
                type: "addCustomer",
                args: [{ name, nit: second, city: third }],
              };
            else if (kind === "materials")
              return {
                type: "addMaterial",
                args: [{ name, code: second, category: third }],
              };
            else
              return { type: "addWarehouse", args: [{ name, city: second }] };
          },
          record
            ? "Registro actualizado. Fecha de registro conservada."
            : "Registro agregado al catálogo.",
        );
      }}
    >
      <fieldset disabled={busy} className="form-body">
        <div className="form-grid">
          <Field
            label={
              kind === "customers"
                ? "Nombre del cliente"
                : kind === "materials"
                  ? "Nombre del material"
                  : "Nombre de la bodega"
            }
            wide
          >
            <input
              required
              maxLength={180}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label={
              kind === "customers"
                ? "NIT"
                : kind === "materials"
                  ? "Código de material"
                  : "Ciudad"
            }
          >
            <input
              required
              maxLength={180}
              value={second}
              onChange={(e) => setSecond(e.target.value)}
            />
          </Field>
          {kind !== "warehouses" && (
            <Field label={kind === "customers" ? "Ciudad" : "Categoría"}>
              <input
                required
                maxLength={180}
                value={third}
                onChange={(e) => setThird(e.target.value)}
              />
            </Field>
          )}
        </div>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions busy={busy} onClose={onClose} label="Guardar registro" />
    </form>
  );
}

export function StockEditForm({
  state,
  stockId,
  save,
  busy,
  error,
  onClose,
}: Props & { stockId: string }) {
  const stock = state.stocks.find((s) => s.id === stockId)!;
  const [lot, setLot] = useState(stock.lot);
  const [warehouseId, setWarehouse] = useState(stock.warehouseId);
  const [expiry, setExpiry] = useState(stock.expiry);
  const [amount, setAmount] = useState(kg(balance(state, stockId)));
  const [document, setDocument] = useState("");
  const [reason, setReason] = useState("");
  const [operationKey] = useState(() => crypto.randomUUID());
  const [revision] = useState(state.revision);
  const linked = state.orders.some((o) =>
    o.lines.some((l) => l.allocations.some((a) => a.stockId === stockId)),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          () => ({
            type: "updateStock",
            args: [
              stockId,
              {
                lot,
                warehouseId,
                expiry,
                grams: /^(0+)([.,]0+)?$/.test(amount.trim())
                  ? 0
                  : parseKg(amount),
                document,
                reason,
              },
              operationKey,
              revision,
            ],
          }),
          "Inventario corregido. El ajuste y el motivo quedaron registrados.",
        );
      }}
    >
      <fieldset className="form-body" disabled={busy}>
        <p>
          <strong>
            {state.materials.find((m) => m.id === stock.materialId)?.name}
          </strong>
        </p>
        <div className="form-grid">
          <Field label="Lote">
            <input
              required
              maxLength={180}
              value={lot}
              disabled={linked}
              onChange={(e) => setLot(e.target.value)}
            />
          </Field>
          <Field label="Fecha de vencimiento">
            <input
              required
              type="date"
              disabled={linked}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
          <Field label="Bodega">
            <WarehouseSelect
              state={state}
              value={warehouseId}
              onChange={setWarehouse}
              disabled={linked}
            />
          </Field>
          <Field
            label="Existencias corregidas kg"
            hint="Saldo físico total. Ej. 10,000.00. Se acepta cero."
          >
            <Qty value={amount} onChange={setAmount} />
          </Field>
          <Field label="Documento de corrección">
            <input
              required
              maxLength={180}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </Field>
          <Field label="Motivo de corrección">
            <input
              required
              maxLength={180}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <div className="info-note compact">
          <ShieldCheck size={17} />
          <span>
            La diferencia de kilos se registra como ajuste en el kardex.{" "}
            {linked
              ? "Este lote tiene pedidos vinculados; sus datos de identificación se conservan."
              : "Los movimientos anteriores conservan los datos originales del lote."}
          </span>
        </div>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions busy={busy} onClose={onClose} label="Guardar corrección" />
    </form>
  );
}
export function MovementEditForm({
  state,
  movementId,
  save,
  busy,
  error,
  onClose,
}: Props & { movementId: string }) {
  const original = state.movements.find((m) => m.id === movementId)!;
  const [amount, setAmount] = useState(kg(Math.abs(original.grams)));
  const [document, setDocument] = useState(original.document);
  const [reason, setReason] = useState("");
  const [cancel, setCancel] = useState(false);
  const [operationKey] = useState(() => crypto.randomUUID());
  const [revision] = useState(state.revision);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          () => ({
            type: "correctMovement",
            args: [
              movementId,
              { grams: cancel ? 0 : parseKg(amount), document, reason },
              operationKey,
              revision,
            ],
          }),
          cancel
            ? "Movimiento anulado mediante reversión en el kardex."
            : "Movimiento corregido con trazabilidad en el kardex.",
        );
      }}
    >
      <fieldset className="form-body" disabled={busy}>
        <p>
          <strong>
            {original.type} · {original.document}
          </strong>
          <br />
          Cantidad registrada: {kg(Math.abs(original.grams))} kg
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={cancel}
            onChange={(e) => setCancel(e.target.checked)}
          />
          Anular este movimiento
        </label>
        <div className="form-grid">
          {!cancel && (
            <Field
              label="Cantidad corregida kg"
              hint="Cantidad total correcta del movimiento, no la diferencia."
            >
              <Qty value={amount} onChange={setAmount} />
            </Field>
          )}
          <Field label="Documento de corrección">
            <input
              required
              maxLength={180}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </Field>
          <Field label="Motivo de corrección" wide>
            <textarea
              required
              maxLength={180}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
        <div className="info-note compact">
          <ShieldCheck size={17} />
          <span>
            {cancel
              ? "La anulación revierte los kilos del movimiento."
              : "Se registrará la diferencia de kilos como ajuste."}{" "}
            El original permanece en el historial. Los kilos reservados y las
            salidas por pedido están protegidos.
          </span>
        </div>
        <ErrorMessage error={error} />
      </fieldset>
      <Actions
        busy={busy}
        onClose={onClose}
        label={cancel ? "Confirmar anulación" : "Guardar corrección"}
      />
    </form>
  );
}
