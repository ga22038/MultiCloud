import { requireUser } from "../../../../server/auth";
import { loadState } from "../../../../server/repository";
import { handle, json } from "../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const user = await requireUser();
  return json({
    user,
    state: await loadState(),
    site: process.env.SITE_NAME || "local",
  });
});
