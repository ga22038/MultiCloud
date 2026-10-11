import "server-only";
import { createHash } from "node:crypto";
import type { State } from "../domain";
import { PermissionError } from "../domain";
import { applyCommand, type Operation } from "../commands";
import { database } from "./database";
import { ApiError } from "./errors";
import type { User } from "./auth";
function decode(document: string | State): State {
  return typeof document === "string" ? JSON.parse(document) : document;
}
export async function loadState(): Promise<State> {
  const rows = await database().query(
    "SELECT document FROM application_state WHERE id = 1",
  );
  if (!rows[0])
    throw new ApiError(
      503,
      "NOT_INITIALIZED",
      "La base de datos necesita inicialización.",
    );
  return decode(rows[0].document);
}
export async function executeOperation(user: User, operation: Operation) {
  if (process.env.APP_WRITES_ENABLED === "false")
    throw new ApiError(
      503,
      "WRITES_DISABLED",
      "El sitio está en mantenimiento. No se aceptan cambios.",
    );
  const connection = await database().getConnection();
  const hash = createHash("sha256")
    .update(JSON.stringify({ operation, userId: user.id }))
    .digest("hex");
  try {
    await connection.beginTransaction();
    const rows = await connection.query(
      "SELECT document FROM application_state WHERE id = 1 FOR UPDATE",
    );
    if (!rows[0])
      throw new ApiError(
        503,
        "NOT_INITIALIZED",
        "Inicializa la base de datos.",
      );
    const state = decode(rows[0].document);
    const previous = await connection.query(
      "SELECT request_hash FROM operations WHERE id = ?",
      [operation.id],
    );
    if (previous[0]) {
      if (previous[0].request_hash !== hash)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "El identificador pertenece a otra operación.",
        );
      await connection.commit();
      return { state, operationId: operation.id, replayed: true };
    }
    if (state.revision !== operation.expectedRevision)
      throw new ApiError(
        409,
        "REVISION_CONFLICT",
        "Los datos cambiaron. Actualiza y revisa el formulario.",
      );
    let next: State;
    try {
      next = applyCommand(state, user, operation.command);
    } catch (error) {
      if (error instanceof PermissionError)
        throw new ApiError(403, "FORBIDDEN", error.message);
      throw new ApiError(
        422,
        "BUSINESS_RULE",
        error instanceof Error ? error.message : "Operación inválida.",
      );
    }
    await connection.query(
      "UPDATE application_state SET revision = ?, document = ? WHERE id = 1",
      [next.revision, JSON.stringify(next)],
    );
    await connection.query(
      "INSERT INTO operations (id, user_id, request_hash, revision, command_type) VALUES (?, ?, ?, ?, ?)",
      [operation.id, user.id, hash, next.revision, operation.command.type],
    );
    await connection.commit();
    return { state: next, operationId: operation.id, replayed: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function findOperation(id: string, userId: string) {
  const rows = await database().query(
    "SELECT id, revision, command_type AS commandType, created_at AS createdAt FROM operations WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!rows[0])
    throw new ApiError(
      404,
      "OPERATION_NOT_FOUND",
      "Operación no localizada. Verifica el primario y la réplica antes de repetirla.",
    );
  return { operation: rows[0], state: await loadState() };
}
