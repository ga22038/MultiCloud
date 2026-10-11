import type { Command } from "../commands";
import { Login } from "./Login";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  FileCheck2,
  Package,
  ArrowLeftRight,
  Users,
  Settings,
  ChevronRight,
  ShieldCheck,
  CircleCheck,
  AlertTriangle,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Actor, Role, Order, CatalogKind } from "../domain";
import {
  commit,
  storageError,
  useData,
  useConnection,
  initializeData,
  refreshData,
  recoverData,
  hasPendingOperation,
  signOut,
} from "./store";
import { Modal } from "./components";
import { orderPdf } from "./documents";
import {
  CatalogForm,
  OrderDetail,
  OrderForm,
  ReceiptForm,
  WriteOffForm,
  StockEditForm,
  MovementEditForm,
} from "./forms";
import {
  Overview,
  Orders,
  Inventory,
  Kardex,
  Catalogs,
  SettingsView,
} from "./views";

export type View =
  | "overview"
  | "dispatch"
  | "billing"
  | "orders"
  | "inventory"
  | "kardex"
  | "catalogs"
  | "settings";
type Dialog =
  | { type: "new-order" | "receipt" | "writeoff" }
  | { type: "order"; id: string }
  | { type: "catalog"; kind: CatalogKind; id?: string }
  | { type: "delete-catalog"; kind: CatalogKind; id: string }
  | { type: "stock-edit" | "movement-edit"; id: string }
  | null;
const titles: Record<View, string> = {
  overview: "Resumen",
  orders: "Pedidos",
  dispatch: "Despacho",
  billing: "Facturación",
  inventory: "Inventario",
  kardex: "Kardex",
  catalogs: "Catálogos",
  settings: "Configuración",
};
const nav: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "overview", label: "Resumen", icon: LayoutDashboard },
  { view: "orders", label: "Pedidos", icon: ClipboardList },
  { view: "dispatch", label: "Despacho", icon: Truck },
  { view: "billing", label: "Facturación", icon: FileCheck2 },
  { view: "inventory", label: "Inventario", icon: Package },
  { view: "kardex", label: "Kardex", icon: ArrowLeftRight },
  { view: "catalogs", label: "Catálogos", icon: Users },
];
const roles: Role[] = ["Administrador", "Customer", "Logística", "Facturación"];

export default function App() {
  const state = useData();
  const connection = useConnection();
  useEffect(() => {
    void initializeData();
  }, []);
  const [view, setView] = useState<View>("overview");
  const [role, setRole] = useState<Role>("Administrador");
  useEffect(() => {
    if (connection.role) setRole(connection.role);
  }, [connection.role]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [menu, setMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 700px)").matches,
  );
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const sidebarVisible = isMobile ? menu : sidebarOpen;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const sync = () => setIsMobile(query.matches);
    const update = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      setMenu(false);
    };
    query.addEventListener("change", update);
    const observer = new ResizeObserver(sync);
    observer.observe(document.documentElement);
    sync();
    return () => {
      query.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!isMobile || !menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, menu]);
  const hideSidebar = () => {
    if (isMobile) setMenu(false);
    else setSidebarOpen(false);
    requestAnimationFrame(() => menuTrigger.current?.focus());
  };
  const toggleSidebar = () => {
    if (sidebarVisible) hideSidebar();
    else {
      if (isMobile) setMenu(true);
      else setSidebarOpen(true);
      requestAnimationFrame(() => sidebarToggle.current?.focus());
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actor: Actor = { name: connection.name, role };
  const canOrder = role === "Administrador" || role === "Customer";
  const canStock = role === "Administrador" || role === "Logística";
  const go = (next: View) => {
    setView(next);
    setMenu(false);
    if (isMobile)
      requestAnimationFrame(() =>
        document.getElementById("main")?.focus({ preventScroll: true }),
      );
  };
  const open = (next: Dialog) => {
    setError("");
    setDialog(next);
  };
  const close = () => {
    if (!busy) {
      setDialog(null);
      setError("");
    }
  };
  const notify = (text: string, isError = false) =>
    setToast({ text, error: isError });
  const save = async (
    change: () => Command,
    success: string,
    closeAfter = true,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await commit(change);
      notify(success);
      if (closeAfter) setDialog(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      notify(message, true);
    } finally {
      setBusy(false);
    }
  };
  const pdf = async (order: Order) => {
    try {
      await orderPdf(
        state,
        order,
        view === "billing"
          ? "billing"
          : view === "dispatch"
            ? "dispatch"
            : "orders",
      );
      notify("Documento PDF descargado.");
    } catch {
      notify("No se pudo generar el PDF. Inténtalo nuevamente.", true);
    }
  };
  const selectedOrder =
    dialog?.type === "order"
      ? state.orders.find((o) => o.id === dialog.id)
      : undefined;
  if (connection.status === "unauthenticated") return <Login />;
  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-hidden"}`}>
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      {isMobile && menu && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar menú"
          onClick={hideSidebar}
        />
      )}
      <aside
        id="main-sidebar"
        className={`sidebar ${menu ? "sidebar-open" : ""}`}
        aria-label="Menú lateral"
        aria-hidden={!sidebarVisible}
        inert={!sidebarVisible}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            hideSidebar();
          }
          if (isMobile && menu && event.key === "Tab") {
            const buttons =
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              );
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          ref={sidebarToggle}
          className="icon-button sidebar-toggle"
          aria-label="Ocultar menú lateral"
          aria-expanded={sidebarVisible}
          aria-controls="main-sidebar"
          title="Ocultar menú lateral"
          onClick={hideSidebar}
        >
          <Menu size={21} />
        </button>
        <div className="brand">
          <div className="brand-symbol">
            P<span />
          </div>
          <div>
            <strong>
              Polaris<span>UES</span>
            </strong>
            <small>GESTIÓN MULTICLOUD</small>
          </div>
        </div>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {nav.map(({ view: next, label, icon: Icon }) => (
            <button
              key={next}
              className={view === next ? "nav-item active" : "nav-item"}
              aria-current={view === next ? "page" : undefined}
              onClick={() => go(next)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {next === "orders" && (
                <span className="nav-count">
                  {state.orders.filter((o) => o.status === "Nuevo").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <ShieldCheck size={22} />
            <strong>Trazabilidad de principio a fin</strong>
            <p>Cada kilo tiene una historia. Encuéntrala en el kardex.</p>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings size={19} />
            Configuración
          </button>
          <div className="sidebar-environment">
            <span className="status-dot" />
            <div>
              Polaris UES
              <small>{connection.site || "Conectando…"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={isMobile && menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuTrigger}
              className="icon-button menu-trigger"
              aria-label={
                sidebarVisible
                  ? "Ocultar menú lateral"
                  : "Expandir menú lateral"
              }
              aria-expanded={sidebarVisible}
              aria-controls="main-sidebar"
              title={
                sidebarVisible
                  ? "Ocultar menú lateral"
                  : "Expandir menú lateral"
              }
              onClick={toggleSidebar}
            >
              <Menu size={21} />
            </button>
            <span>Polaris UES</span>
            <ChevronRight size={14} />
            <strong>{titles[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="country">
              <i /> El Salvador
            </span>
            <label className="role-select">
              <span>Vista de trabajo</span>
              <select
                value={role}
                aria-label="Vista de trabajo"
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  setDialog(null);
                  setError("");
                }}
              >
                {(connection.role === "Administrador"
                  ? roles
                  : [connection.role]
                ).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <button className="button secondary" onClick={() => void signOut()}>
              Salir
            </button>
            <div className="avatar" aria-hidden="true">
              {connection.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="demo-strip">
          <span>
            <span className="demo-dot" />
            {connection.status === "ready"
              ? `${connection.name} · ${connection.site}`
              : connection.status === "loading"
                ? "Consultando datos…"
                : "Conexión pendiente"}
          </span>
          <button
            disabled={connection.status === "loading" || busy}
            onClick={() => void refreshData()}
          >
            Actualizar
            <ExternalLink size={12} />
          </button>
        </div>
        {storageError() && (
          <div className="storage-error" role="alert">
            {storageError()}{" "}
            <button onClick={() => void refreshData()}>
              Volver a consultar
            </button>
            {hasPendingOperation() && (
              <button
                disabled={connection.status === "loading" || busy}
                onClick={async () => {
                  try {
                    const recovered = await recoverData();
                    setDialog(null);
                    setError("");
                    notify(
                      recovered
                        ? "Operación comprobada. Los registros ya estaban guardados; no se duplicaron."
                        : "Datos actualizados.",
                    );
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "Se requiere revisión técnica.",
                      true,
                    );
                  }
                }}
              >
                Comprobar operación pendiente
              </button>
            )}
          </div>
        )}
        {connection.status === "loading" && (
          <p className="info-note" role="status">
            Consultando Polaris UES. Espera antes de registrar cambios.
          </p>
        )}
        <main id="main" tabIndex={-1} inert={connection.status !== "ready"}>
          {view === "overview" && (
            <Overview
              state={state}
              canOrder={canOrder}
              canStock={canStock}
              go={go}
              onOrder={() => open({ type: "new-order" })}
              onReceipt={() => open({ type: "receipt" })}
              onDetail={(id) => open({ type: "order", id })}
            />
          )}
          {(view === "orders" || view === "dispatch" || view === "billing") && (
            <Orders
              key={view}
              module={view}
              state={state}
              canOrder={canOrder}
              onNew={() => open({ type: "new-order" })}
              onDetail={(id) => open({ type: "order", id })}
            />
          )}
          {view === "inventory" && (
            <Inventory
              state={state}
              canStock={canStock}
              onReceipt={() => open({ type: "receipt" })}
              onWriteOff={() => open({ type: "writeoff" })}
              onEdit={(id) => open({ type: "stock-edit", id })}
            />
          )}
          {view === "kardex" && (
            <Kardex
              state={state}
              canStock={canStock}
              onCorrect={(id) => open({ type: "movement-edit", id })}
            />
          )}
          {view === "catalogs" && (
            <Catalogs
              state={state}
              isAdmin={role === "Administrador"}
              onAdd={(kind) => open({ type: "catalog", kind })}
              onEdit={(kind, id) => open({ type: "catalog", kind, id })}
              onDelete={(kind, id) =>
                open({ type: "delete-catalog", kind, id })
              }
            />
          )}
          {view === "settings" && (
            <SettingsView state={state} isAdmin={role === "Administrador"} />
          )}
        </main>
        <footer className="app-footer">
          <span>Polaris UES</span>
          <span>Pedidos conectados. Inventario trazable.</span>
        </footer>
      </div>
      {dialog?.type === "new-order" && (
        <Modal
          title="Crear nuevo pedido"
          subtitle="Registra el cliente y los materiales solicitados."
          wide
          onClose={close}
          busy={busy}
        >
          <OrderForm
            state={state}
            actor={actor}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}
      {selectedOrder && (
        <Modal
          title={selectedOrder.number}
          subtitle={
            state.customers.find((c) => c.id === selectedOrder.customerId)?.name
          }
          wide
          onClose={close}
          busy={busy}
        >
          <OrderDetail
            state={state}
            order={selectedOrder}
            actor={actor}
            save={save}
            busy={busy}
            error={error}
            mode={view === "dispatch" || view === "billing" ? view : "orders"}
            onWorkflow={(next) => go(next)}
            onPdf={() => pdf(selectedOrder)}
          />
        </Modal>
      )}
      {dialog?.type === "receipt" && (
        <Modal
          title="Registrar entrada"
          subtitle="Cada recepción crea un movimiento en el kardex."
          onClose={close}
          busy={busy}
        >
          <ReceiptForm
            state={state}
            actor={actor}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}
      {dialog?.type === "writeoff" && (
        <Modal
          title="Registrar baja de inventario"
          subtitle="La baja reduce existencias y conserva el motivo en el kardex."
          onClose={close}
          busy={busy}
        >
          <WriteOffForm
            state={state}
            actor={actor}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}
      {dialog?.type === "catalog" && (
        <Modal
          title={`${dialog.id ? "Editar" : "Agregar"} ${dialog.kind === "customers" ? "cliente" : dialog.kind === "materials" ? "material" : "bodega"}`}
          onClose={close}
          busy={busy}
        >
          <CatalogForm
            kind={dialog.kind}
            record={state[dialog.kind].find((row) => row.id === dialog.id)}
            actor={actor}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}

      {dialog?.type === "stock-edit" && (
        <Modal
          title="Editar registro de inventario"
          subtitle="Corrige los datos y el saldo físico con un motivo documentado."
          onClose={close}
          busy={busy}
        >
          <StockEditForm
            state={state}
            actor={actor}
            stockId={dialog.id}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}
      {dialog?.type === "movement-edit" && (
        <Modal
          title="Corregir movimiento"
          subtitle="El historial original se conserva en el kardex."
          onClose={close}
          busy={busy}
        >
          <MovementEditForm
            state={state}
            actor={actor}
            movementId={dialog.id}
            save={save}
            busy={busy}
            error={error}
            onClose={close}
          />
        </Modal>
      )}
      {dialog?.type === "delete-catalog" && (
        <Modal
          title="Eliminar registro del catálogo"
          onClose={close}
          busy={busy}
        >
          <div className="form-body">
            <p>
              ¿Eliminar{" "}
              <strong>
                {state[dialog.kind].find((row) => row.id === dialog.id)?.name}
              </strong>
              ?
            </p>
            <p>
              Esta acción no se puede deshacer. Solo se eliminan registros sin
              inventario ni pedidos relacionados.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void save(
                  () => ({
                    type: "deleteCatalog",
                    args: [dialog.kind, dialog.id],
                  }),
                  "Registro eliminado del catálogo.",
                )
              }
            >
              Eliminar registro
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? (
            <AlertTriangle size={20} />
          ) : (
            <CircleCheck size={20} />
          )}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
