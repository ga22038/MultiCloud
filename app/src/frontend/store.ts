import { useSyncExternalStore } from "react";
import type { Role, State } from "../domain";
import type { Command, Operation } from "../commands";
type Connection = {
  status: "loading" | "ready" | "error" | "unauthenticated";
  id: string;
  name: string;
  username?: string;
  email: string;
  role: Role;
  error: string;
  site: string;
  welcome: boolean;
};
let connection: Connection = {
  status: "loading",
  id: "",
  name: "",
  email: "",
  role: "Customer",
  error: "",
  site: "",
  welcome: false,
};
let state: State = {
  version: 1,
  revision: 0,
  customers: [],
  materials: [],
  warehouses: [],
  stocks: [],
  orders: [],
  movements: [],
  audit: [],
};
let initialization: Promise<void> | undefined;
let saving = false;
let loadError: string | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const pendingKey = () => `polaris-ues:pending:${connection.id}`;
const pendingId = () => localStorage.getItem(pendingKey());
export const hasPendingOperation = () => !!pendingId();
export const useConnection = () =>
  useSyncExternalStore(subscribe, () => connection);
export const useData = () => useSyncExternalStore(subscribe, () => state);
export const storageError = () => loadError;
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      result.error?.message || "No se pudo completar la solicitud.",
      result.error?.code,
    );
  return result;
}
export function initializeData() {
  return (initialization ??= refreshData());
}
export async function refreshData() {
  if (saving) return;
  connection = { ...connection, status: "loading", error: "" };
  emit();
  try {
    const result = await request("/api/v1/state");
    state = result.state;
    connection = {
      ...connection,
      ...result.user,
      email: result.user.name,
      site: result.site,
      status: "ready",
      error: "",
    };
    loadError = pendingId()
      ? "Hay una operación pendiente de comprobar. Compruébala antes de guardar."
      : undefined;
    if (loadError)
      connection = { ...connection, status: "error", error: loadError };
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      state = {
        version: 1,
        revision: 0,
        customers: [],
        materials: [],
        warehouses: [],
        stocks: [],
        orders: [],
        movements: [],
        audit: [],
      };
      loadError = undefined;
      connection = {
        ...connection,
        status: "unauthenticated",
        error: "",
        welcome: false,
      };
    } else {
      loadError =
        error instanceof Error
          ? error.message
          : "No se pudo consultar Polaris UES.";
      connection = { ...connection, status: "error", error: loadError };
    }
  }
  emit();
}
export async function signIn(username: string, password: string) {
  await request("/api/v1/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  connection = { ...connection, welcome: true };
  await refreshData();
}
export function dismissWelcome() {
  connection = { ...connection, welcome: false };
  emit();
  requestAnimationFrame(() =>
    document.getElementById("main")?.focus({ preventScroll: true }),
  );
}
export async function signOut() {
  try {
    await request("/api/v1/session", { method: "DELETE" });
    await refreshData();
  } catch {
    loadError =
      "No se pudo cerrar la sesión. Reintenta cuando vuelva la conexión.";
    emit();
  }
}
export async function commit(buildCommand: () => Command) {
  if (!navigator.locks)
    throw new Error(
      "Actualiza el navegador para coordinar cambios entre pestañas.",
    );
  await navigator.locks.request(`polaris-ues:write:${connection.id}`, () =>
    commitLocked(buildCommand),
  );
}
async function commitLocked(buildCommand: () => Command) {
  if (loadError || pendingId() || connection.status !== "ready" || saving)
    throw new Error(
      loadError ||
        "Actualiza y comprueba las operaciones pendientes antes de guardar.",
    );
  const operation: Operation = {
    id: crypto.randomUUID(),
    expectedRevision: state.revision,
    command: buildCommand(),
  };
  // Persist before sending. A lost response must not permit another mutation.
  localStorage.setItem(pendingKey(), operation.id);
  saving = true;
  try {
    const result = await request("/api/v1/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operation),
    });
    state = result.state;
    localStorage.removeItem(pendingKey());
    emit();
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status < 500 || error.code === "WRITES_DISABLED")
    ) {
      localStorage.removeItem(pendingKey());
      if (error.status === 409 || error.status === 401) {
        saving = false;
        await refreshData();
      }
    } else {
      loadError =
        "El servidor no confirmó la operación. Comprueba su resultado antes de guardar otra vez.";
      connection = { ...connection, status: "error", error: loadError };
      emit();
    }
    throw error;
  } finally {
    saving = false;
  }
}
export async function recoverData() {
  const id = pendingId();
  if (!id) {
    await refreshData();
    if (connection.status !== "ready")
      throw new Error("La conexión todavía no está disponible.");
    return false;
  }
  if (saving) return;
  saving = true;
  try {
    const result = await request(`/api/v1/operations/${id}`);
    state = result.state;
    localStorage.removeItem(pendingKey());
    loadError = undefined;
    connection = { ...connection, status: "ready", error: "" };
    emit();
    return true;
  } finally {
    saving = false;
  }
}
export function exportBackup() {
  download(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    "polaris-ues-datos.json",
  );
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
