import { loadContestDetail } from "@/lib/db/closeRaces";

// One contest's options, vote-method split, county splits and margin history,
// for the expandable row on the close-races report.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadContestDetail(id);
  if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(detail, { headers: { "cache-control": "public, max-age=30" } });
}
