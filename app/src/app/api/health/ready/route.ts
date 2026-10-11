import { database } from "../../../../server/database";
import { json } from "../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.APP_WRITES_ENABLED === "false")
    return json(
      { status: "unavailable", site: process.env.SITE_NAME || "local" },
      503,
    );
  try {
    const rows = await database().query(
      "SELECT @@global.read_only AS readOnly, revision FROM application_state WHERE id = 1",
    );
    const ready = !!rows[0] && Number(rows[0].readOnly) === 0;
    return json(
      {
        status: ready ? "ready" : "unavailable",
        site: process.env.SITE_NAME || "local",
      },
      ready ? 200 : 503,
    );
  } catch {
    return json(
      { status: "unavailable", site: process.env.SITE_NAME || "local" },
      503,
    );
  }
}
