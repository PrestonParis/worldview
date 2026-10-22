import { NextResponse } from "next/server";
import { loadOfficialRecords, parseRecordKeys } from "@/lib/my-government/records";

// Profile links and headline numbers for the officials on a My Government
// result. Public data keyed only by ids, so responses are shared.
export async function GET(request: Request) {
  const { entityIds, bioguideIds } = parseRecordKeys(new URL(request.url).searchParams);
  const records = await loadOfficialRecords(entityIds, bioguideIds);
  return NextResponse.json(
    { records },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
