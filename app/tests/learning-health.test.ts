import { describe, expect, it, vi } from "vitest";
import {
  learningTargets,
  probeLearningHealth,
} from "../src/server/learning-health";
describe("public learning health observer", () => {
  it("contacts only fixed health URLs and drops unneeded remote fields", async () => {
    const fetcher = vi.fn(async (url: string) =>
      Response.json({
        status: "ready",
        site: url.includes("gcp.") ? "gcp" : "aws",
        privateField: "must not be returned",
      }),
    );
    const rows = await probeLearningHealth(fetcher as typeof fetch);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
      Object.values(learningTargets).map((url) => `${url}/api/health/ready`),
    );
    expect(rows.every((row) => row.ready)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("privateField");
  });
  it("reports a broken or mislabeled site without inventing readiness", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("app.")) throw new Error("private error detail");
      if (url.includes("aws."))
        return new Response("unavailable", { status: 503 });
      return Response.json({ status: "ready", site: "aws" });
    });
    const rows = await probeLearningHealth(fetcher as typeof fetch);
    expect(rows.map((row) => row.ready)).toEqual([false, false, false]);
    expect(rows.map((row) => row.httpStatus)).toEqual([0, 503, 200]);
    expect(JSON.stringify(rows)).not.toContain("private error detail");
  });
});
