import { z } from "zod";
import { requireUser } from "../../../../../server/auth";
import { findOperation } from "../../../../../server/repository";
import { handle, json } from "../../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    return json(
      await findOperation(z.uuid().parse((await context.params).id), user.id),
    );
  })(request);
}
