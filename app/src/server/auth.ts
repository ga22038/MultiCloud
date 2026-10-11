import "server-only";
import { cookies } from "next/headers";
import type { Role } from "../domain";
import { database } from "./database";
import { sessionSecret } from "./config";
import { signSession, verifySession } from "./crypto";
import { ApiError } from "./errors";
export type User = { id: string; username?: string; name: string; role: Role };
const cookieName = "polaris_session";
export async function requireUser(): Promise<User> {
  const token = (await cookies()).get(cookieName)?.value;
  const id = token && verifySession(token, sessionSecret());
  if (!id)
    throw new ApiError(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  const rows = await database().query(
    "SELECT id, username, name, role FROM app_users WHERE id = ? AND active = 1",
    [id],
  );
  if (!rows[0])
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "La sesión ya no está disponible.",
    );
  return rows[0];
}
export async function establishSession(id: string) {
  (await cookies()).set(cookieName, signSession(id, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function clearSession() {
  (await cookies()).delete(cookieName);
}
