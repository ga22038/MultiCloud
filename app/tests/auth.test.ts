import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
} from "../src/server/crypto";
describe("authentication", () => {
  it("salts passwords and rejects incorrect or malformed hashes", () => {
    const hash = hashPassword("test-password-for-unit-test");
    expect(hash).not.toBe(hashPassword("test-password-for-unit-test"));
    expect(verifyPassword("test-password-for-unit-test", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(verifyPassword("wrong", "invalid")).toBe(false);
  });
  it("rejects tampered, expired and incorrectly signed sessions", () => {
    const secret = "test-secret-only-with-at-least-32-characters";
    const token = signSession("user-id", secret, 1000);
    expect(verifySession(token, secret, 1001)).toBe("user-id");
    expect(verifySession(token + "x", secret, 1001)).toBeUndefined();
    expect(verifySession(token, "another-secret", 1001)).toBeUndefined();
    expect(verifySession(token, secret, 1000 + 8 * 3600000)).toBeUndefined();
    expect(verifySession("invalid", secret)).toBeUndefined();
  });
});
