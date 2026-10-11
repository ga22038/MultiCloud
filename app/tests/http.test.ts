import { describe, expect, it } from "vitest";
import { body, handle, json, sameOrigin } from "../src/server/http";
describe("HTTP boundary", () => {
  it("rejects missing and untrusted origins", () => {
    expect(() => sameOrigin(new Request("http://localhost/api"))).toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost/api", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("returns a controlled error for malformed JSON without leaking content", async () => {
    const handler = handle(async (request) => json(await body(request)));
    const result = await handler(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "PRIVATE-invalid-json",
      }),
    );
    expect(result.status).toBe(400);
    expect(await result.text()).not.toContain("PRIVATE");
  });
  it("rejects oversized requests", async () => {
    const handler = handle(async (request) => json(await body(request)));
    const result = await handler(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: " ".repeat(1048577),
      }),
    );
    expect(result.status).toBe(413);
  });
});
