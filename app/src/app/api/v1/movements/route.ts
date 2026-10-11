import { requireUser } from "../../../../server/auth";
import { movementsQuery } from "../../../../server/queries";
import { handle, json } from "../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handle(async (request) => {
  await requireUser();
  return json(await movementsQuery(request));
});
