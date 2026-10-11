import { requireUser } from "../../../../server/auth";
import { executeOperation } from "../../../../server/repository";
import { operationSchema } from "../../../../commands";
import { handle, json, sameOrigin, body } from "../../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = handle(async (request) => {
  sameOrigin(request);
  const user = await requireUser();
  return json(
    await executeOperation(user, operationSchema.parse(await body(request))),
  );
});
