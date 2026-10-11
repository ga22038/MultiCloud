import { requireUser } from "../../../../../server/auth";
import { catalogsQuery } from "../../../../../server/queries";
import { handle, json } from "../../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  return handle(async () => {
    await requireUser();
    return json(await catalogsQuery(request, (await context.params).kind));
  })(request);
}
