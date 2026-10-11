import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./errors";
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function handle(action: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const requestId = randomUUID();
    try {
      const response = await action(request);
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      if (error instanceof ApiError)
        return json(
          { error: { code: error.code, message: error.message, requestId } },
          error.status,
        );
      if (error instanceof z.ZodError)
        return json(
          {
            error: {
              code: "VALIDATION",
              message: "Revisa los campos enviados.",
              requestId,
            },
          },
          400,
        );
      // Do not log SQL, cookies, credentials, request bodies, or raw driver errors.
      console.error(JSON.stringify({ event: "request_failed", requestId }));
      return json(
        {
          error: {
            code: "UNAVAILABLE",
            message: "Servicio temporalmente no disponible.",
            requestId,
          },
        },
        503,
      );
    }
  };
}
export function sameOrigin(request: Request) {
  const allowed = (
    process.env.APP_ALLOWED_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080"
  )
    .split(",")
    .map((s) => s.trim());
  if (!allowed.includes(request.headers.get("origin") || ""))
    throw new ApiError(403, "ORIGIN", "Origen de solicitud no permitido.");
}
export async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "CONTENT_TYPE", "Se requiere JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON", "Falta el cuerpo JSON.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 1048576) {
      await reader.cancel();
      throw new ApiError(413, "BODY_SIZE", "Solicitud demasiado grande.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "JSON", "JSON inválido.");
  }
}
