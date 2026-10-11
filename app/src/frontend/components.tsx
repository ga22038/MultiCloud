import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import {
  X,
  Search,
  ArrowRight,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { usePagination } from "./pagination";
import type { Status } from "../domain";

export function ExportButton({
  onExport,
  label = "Exportar PDF",
}: {
  onExport: () => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="export-action">
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onExport();
          } catch {
            setError("No se pudo generar el documento. Reintenta.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} />
        {busy ? "Generando PDF…" : label}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span />
      {status === "Confirmado" ? "Listo para facturar" : status}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-describedby"?: string;
            }>,
            { id, "aria-describedby": hint ? `${id}-hint` : undefined },
          )
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  text = "No hay resultados con estos filtros.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <PackageOpen size={32} strokeWidth={1.4} />
      <h3>{text}</h3>
      <p>Prueba otra búsqueda o agrega un registro.</p>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const prior = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) {
          const rect = ref.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar ventana"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function Pagination({
  pagination: p,
}: {
  pagination: ReturnType<typeof usePagination>;
}) {
  return (
    <nav className="pagination" aria-label="Paginación de tabla">
      <span role="status">
        {p.total ? p.start + 1 : 0}–{Math.min(p.end, p.total)} de {p.total}{" "}
        registros
      </span>
      <label>
        Filas por página{" "}
        <select
          value={p.size}
          onChange={(e) => p.setSize(Number(e.target.value))}
        >
          {[5, 10, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="pagination-buttons">
        <button
          className="icon-button"
          disabled={p.page === 1}
          aria-label="Primera página"
          onClick={() => p.setPage(1)}
        >
          «
        </button>
        <button
          className="icon-button"
          disabled={p.page === 1}
          aria-label="Página anterior"
          onClick={() => p.setPage(p.page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          Página {p.page} de {p.pages}
        </span>
        <button
          className="icon-button"
          disabled={p.page === p.pages}
          aria-label="Página siguiente"
          onClick={() => p.setPage(p.page + 1)}
        >
          <ChevronRight size={17} />
        </button>
        <button
          className="icon-button"
          disabled={p.page === p.pages}
          aria-label="Última página"
          onClick={() => p.setPage(p.pages)}
        >
          »
        </button>
      </div>
    </nav>
  );
}
