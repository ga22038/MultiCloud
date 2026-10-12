import { probeLearningHealth } from "../../../../server/learning-health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fixed public targets only. No cloud credentials, cookies or arbitrary URL input.
export async function GET() {
  return Response.json(
    {
      observedAt: new Date().toISOString(),
      observer: process.env.SITE_NAME || "local",
      results: await probeLearningHealth(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
