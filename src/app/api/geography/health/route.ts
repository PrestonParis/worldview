import { getAisIngestHealth } from "@/lib/db/ais";

export async function GET() {
  const ais = await getAisIngestHealth();
  return Response.json({ ais, checkedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
  });
}
