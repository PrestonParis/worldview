import type { NextRequest } from "next/server";
import { loadCloseRaceRows } from "@/lib/db/closeRaces";
import { closeRacesCsv, closeRacesFilename } from "@/lib/elections/close-races/csv";
import { parseCloseRaceFilters } from "@/lib/elections/close-races/filters";

// The ranked close-races list as CSV, with the same filters and order as
// the Writ page (/writ/close-races/[election]).
export async function GET(req: NextRequest, { params }: { params: Promise<{ election: string }> }) {
  const { election } = await params;
  const filters = parseCloseRaceFilters(req.nextUrl.searchParams);
  const rows = await loadCloseRaceRows(election, filters);
  if (!rows) return new Response("Unknown election", { status: 404 });
  return new Response(closeRacesCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${closeRacesFilename(election, filters.sort, new Date())}"`,
      "cache-control": "public, max-age=30",
    },
  });
}
