import { revalidateTag } from "next/cache";
import { authenticatePartner } from "@/lib/data/partner-keys";
import { AREA_STATS_TAG, getDataset, getPartnerDataset, queryObservations, upsertObservations } from "@/lib/db/stats";
import { observationBatchSchema, periodSchema } from "@/lib/validation/observation";

type Context = { params: Promise<{ slug: string }> };

const MAX_LIMIT = 10_000;

// Public read: GET ?metric=&geoLevel=&geoid=&from=&to=&limit=&offset=
export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  if (!(await getDataset(slug))) {
    return Response.json({ error: `No published dataset "${slug}".` }, { status: 404 });
  }
  const q = new URL(request.url).searchParams;
  for (const field of ["from", "to"] as const) {
    const value = q.get(field);
    if (value && !periodSchema.safeParse(value).success) {
      return Response.json(
        { error: `${field} must be YYYY, YYYY-MM, YYYY-MM-DD, YYYY-Qn, or FYYYYY.` },
        { status: 400 },
      );
    }
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.get("limit")) || 1000));
  const offset = Math.max(0, Number(q.get("offset")) || 0);
  try {
    const observations = await queryObservations({
      dataset: slug,
      metric: q.get("metric") ?? undefined,
      geoLevel: q.get("geoLevel") ?? undefined,
      geoid: q.get("geoid") ?? undefined,
      from: q.get("from") ?? undefined,
      to: q.get("to") ?? undefined,
      limit,
      offset,
    });
    return Response.json({
      dataset: slug,
      observations,
      next: observations.length === limit ? offset + limit : null,
    });
  } catch (error) {
    console.error(`[api:data:observations:${slug}]`, error);
    return Response.json({ error: "Observations are temporarily unavailable." }, { status: 500 });
  }
}

// Partner write: an approved partner upserts observations into a dataset it
// owns. Body: { metrics?: { <metric>: { label, unit, description? } },
//               observations: [{ metric, geoLevel, geoid, period, value, ... }] }
export async function POST(request: Request, { params }: Context) {
  const auth = await authenticatePartner(request);
  if ("error" in auth) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  const { slug } = await params;

  const dataset = await getPartnerDataset(slug);
  if (!dataset || dataset.partnerId !== auth.partner.id) {
    return Response.json(
      { ok: false, error: `Dataset "${slug}" does not exist or is not assigned to ${auth.partner.name}.` },
      { status: 403 },
    );
  }
  if (dataset.status === "retired") {
    return Response.json({ ok: false, error: `Dataset "${slug}" is retired.` }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = observationBatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Validation failed.",
        issues: parsed.error.issues.slice(0, 50).map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  const known = { ...(dataset.metrics as Record<string, unknown>), ...(parsed.data.metrics ?? {}) };
  const undefinedMetrics = [...new Set(parsed.data.observations.map((o) => o.metric))].filter((m) => !(m in known));
  if (undefinedMetrics.length) {
    return Response.json(
      {
        ok: false,
        error: `Define these metrics (label + unit) in "metrics" before publishing values: ${undefinedMetrics.join(", ")}`,
      },
      { status: 422 },
    );
  }

  const result = await upsertObservations({ id: dataset.id, slug }, parsed.data.observations, parsed.data.metrics);
  revalidateTag(AREA_STATS_TAG, "max");
  return Response.json({ ok: true, dataset: slug, status: dataset.status, ...result });
}
