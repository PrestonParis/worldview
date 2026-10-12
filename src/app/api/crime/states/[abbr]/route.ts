import { loadStateDetail } from "@/lib/crime/sources";

// A state's large-city police departments and county homicide rates, for
// the /crime state profile. ?year= is the latest complete FBI year shown.
export async function GET(request: Request, { params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const q = new URL(request.url).searchParams;
  const year = /^\d{4}$/.test(q.get("year") ?? "") ? q.get("year")! : null;
  const detail = await loadStateDetail(abbr.toUpperCase(), year, year ? String(Number(year) - 1) : null);
  if (!detail) return Response.json({ error: `Unknown state "${abbr}".` }, { status: 404 });
  return Response.json(detail, { headers: { "Cache-Control": "public, max-age=3600" } });
}
