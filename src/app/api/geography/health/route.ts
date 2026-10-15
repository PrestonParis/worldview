import { currentUserIsOwner } from "@/lib/auth/guard";
import { getAisIngestHealth } from "@/lib/db/ais";

export async function GET() {
  if (!(await currentUserIsOwner())) return Response.json({ error: "Not found." }, { status: 404 });
  const ais = await getAisIngestHealth();
  return Response.json({ ais, checkedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
  });
}
