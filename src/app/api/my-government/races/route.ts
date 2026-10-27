import { NextResponse } from "next/server";
import { listCycles, listRacesForPlace } from "@/lib/db/election-overview";
import { US_STATE_NAMES } from "@/lib/money/us-states";

// The races on a saved address's ballot (src/components/my-government/my-races.tsx).
// Public data keyed only by state and district, so responses are shared.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const house = params.get("house");
  const stateName = US_STATE_NAMES[state];
  if (!stateName || (house && !new RegExp(`^${state}-(\\d{2}|AL)$`).test(house))) {
    return NextResponse.json({ error: "Unknown state or district." }, { status: 400 });
  }

  const cycles = await listCycles();
  const requested = Number(params.get("cycle"));
  const cycle = cycles.find((item) => item.cycle === requested)?.cycle ?? cycles[0]?.cycle;
  const races = cycle ? await listRacesForPlace(cycle, stateName, house || null) : [];
  return NextResponse.json(
    { cycle: cycle ?? null, races },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
