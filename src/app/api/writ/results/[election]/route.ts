import { loadAllResultRows } from "@/lib/db/closeRaces";
import { allResultsFilename, closeRacesCsv } from "@/lib/elections/close-races/csv";

// Every contest in an election as CSV, unopposed ones included: the full
// results, where /api/writ/close-races/[election] is the ranked list.
export async function GET(_req: Request, { params }: { params: Promise<{ election: string }> }) {
  const { election } = await params;
  const rows = await loadAllResultRows(election);
  if (!rows) return new Response("Unknown election", { status: 404 });
  return new Response(closeRacesCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${allResultsFilename(election, new Date())}"`,
      "cache-control": "public, max-age=30",
    },
  });
}
