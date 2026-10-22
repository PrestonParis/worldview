import { compareByGeo, type CompareSeries } from "@/lib/db/stats";
import { PublicDataInputError } from "@/lib/data/public-error";

const MAX_SERIES = 8;

// Public read: several datasets' metrics side by side for every place at one
// geography level.
//   GET ?level=county&series=fbi-cde:violent_crime_rate,census-acs5:median_household_income[@2023]&within=06
// `series` is comma-separated source:metric, each optionally @period (the
// latest period at that level otherwise); `within` limits places to one
// parent geoid prefix, e.g. a state FIPS.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const level = q.get("level");
  const raw = (q.get("series") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!level || raw.length === 0) {
    return Response.json({ error: "Pass level and series=source:metric[@period],..." }, { status: 400 });
  }
  if (raw.length > MAX_SERIES) {
    return Response.json({ error: `At most ${MAX_SERIES} series.` }, { status: 400 });
  }
  const series: CompareSeries[] = [];
  for (const item of raw) {
    const match = item.match(/^([^:@]+):([^@]+)(?:@(.+))?$/);
    if (!match)
      return Response.json({ error: `Bad series "${item}"; expected source:metric[@period].` }, { status: 400 });
    series.push({ source: match[1], metric: match[2], ...(match[3] ? { period: match[3] } : {}) });
  }
  const within = q.get("within") ?? undefined;
  try {
    return Response.json(await compareByGeo(level, series, within ? { within } : {}));
  } catch (error) {
    if (error instanceof PublicDataInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[api:data:compare]", error);
    return Response.json({ error: "Comparison data is temporarily unavailable." }, { status: 500 });
  }
}
