import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("react", () => ({
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("session state before rendering the workspace", () => {
  it("has no verified identity while the initial request is pending or fails", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const store = await import("../src/frontend/store");
    const pending = store.initializeData();
    expect(store.useConnection().status).toBe("loading");
    expect(store.useConnection().id).toBe("");
    finish(
      Response.json({ error: { message: "Unavailable" } }, { status: 503 }),
    );
    await pending;
    expect(store.useConnection().status).toBe("error");
    expect(store.useConnection().id).toBe("");
  });
  it("clears cached identity and data after the server rejects a session", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          user: {
            id: "verified-user",
            name: "Account",
            username: "account",
            role: "Administrador",
          },
          site: "local",
          state: { revision: 8, customers: [{ id: "private-record" }] },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: { message: "Sign in" } }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetcher);
    const store = await import("../src/frontend/store");
    await store.initializeData();
    expect(store.useConnection().id).toBe("verified-user");
    await store.refreshData();
    expect(store.useConnection()).toMatchObject({
      status: "unauthenticated",
      id: "",
      name: "",
      site: "",
      welcome: false,
    });
    expect(store.useData().customers).toEqual([]);
  });
});
