export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      status: "alive",
      application: "Polaris UES",
      site: process.env.SITE_NAME || "local",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
