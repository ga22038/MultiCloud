import {
  randomBytes,
  scryptSync,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
export function signSession(id: string, secret: string, now = Date.now()) {
  const data = Buffer.from(
    JSON.stringify({ id, exp: now + 8 * 3600000 }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}
export function verifySession(
  token: string,
  secret: string,
  now = Date.now(),
): string | undefined {
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra) return;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (
      typeof payload.id === "string" &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp > now
    )
      return payload.id;
  } catch {
    /* Invalid cookie never establishes a session. */
  }
}
