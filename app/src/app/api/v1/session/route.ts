import { z } from "zod";
import { createHash } from "node:crypto";
import { database } from "../../../../server/database";
import {
  requireUser,
  establishSession,
  clearSession,
} from "../../../../server/auth";
import { hashPassword, verifyPassword } from "../../../../server/crypto";
import { ApiError } from "../../../../server/errors";
import { handle, json, sameOrigin, body } from "../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dummyHash = hashPassword("unused-dummy-password");
export const GET = handle(async () => json({ user: await requireUser() }));
export const POST = handle(async (request) => {
  sameOrigin(request);
  const input = z
    .object({
      username: z.string().trim().min(1).max(100),
      password: z.string().min(1).max(256),
    })
    .strict()
    .parse(await body(request));
  // Shared between sites. Counters survive restarts; names are not stored in this table.
  const key = createHash("sha256")
    .update(input.username.toLowerCase())
    .digest("hex");
  await database().query(
    "INSERT INTO login_attempts (bucket, attempts, window_start) VALUES (?, 1, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts = IF(window_start < UTC_TIMESTAMP() - INTERVAL 15 MINUTE, 1, attempts + 1), window_start = IF(window_start < UTC_TIMESTAMP() - INTERVAL 15 MINUTE, UTC_TIMESTAMP(), window_start)",
    [key],
  );
  const attempts = await database().query(
    "SELECT attempts FROM login_attempts WHERE bucket = ?",
    [key],
  );
  if (attempts[0].attempts > 10)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "Demasiados intentos. Espera 15 minutos.",
    );
  const rows = await database().query(
    "SELECT id, name, role, password_hash FROM app_users WHERE username = ? AND active = 1",
    [input.username.toLowerCase()],
  );
  const user = rows[0];
  const valid = verifyPassword(
    input.password,
    user?.password_hash || dummyHash,
  );
  if (!user || !valid)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Usuario o contraseña incorrectos.",
    );
  await database().query("DELETE FROM login_attempts WHERE bucket = ?", [key]);
  await establishSession(user.id);
  return json({ user: { id: user.id, name: user.name, role: user.role } });
});
export const DELETE = handle(async (request) => {
  sameOrigin(request);
  await clearSession();
  return json({ ok: true });
});
