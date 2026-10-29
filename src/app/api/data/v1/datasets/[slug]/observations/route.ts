import { revalidateTag } from "next/cache";
import { authenticatePartner } from "@/lib/data/partner-keys";
import { AREA_STATS_TAG, getDataset, getPartnerDataset, queryObservations, upsertObservations } from "@/lib/db/stats";
import { observationBatchSchema, periodSchema } from "@/lib/validation/observation";
import { RequestBodyTooLarge, readJsonBody } from "@/lib/security/body";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

type Context = { params: Promise<{ slug: string }> };

const MAX_LIMIT = 2_000;
const MAX_OFFSET = 100_000;
const MAX_WRITE_BODY = 12 * 1024 * 1024;

// Public read: GET ?metric=&geoLevel=&geoid=&from=&to=&limit=&offset=
export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  const dataset = await getDataset(slug);
  if (!dataset) {
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
  const offset = Math.min(MAX_OFFSET, Math.max(0, Number(q.get("offset")) || 0));
  for (const field of ["metric", "geoLevel", "geoid"] as const) {
    if ((q.get(field)?.length ?? 0) > 100) return Response.json({ error: `${field} is too long.` }, { status: 400 });
  }
  const metric = q.get("metric") ?? undefined;
  if (metric && !(metric in dataset.metrics)) {
    return Response.json({ error: `Unknown metric "${metric}".` }, { status: 400 });
  }
  const limited = await enforceRateLimits(
    [{ scope: "data-observations-minute", limit: 60, windowSeconds: 60, cost: Math.ceil(limit / 500) }],
    { request },
  );
  if (limited) return rateLimitResponse(limited);
  try {
    const observations = await queryObservations({
      dataset: slug,
      metric,
      geoLevel: q.get("geoLevel") ?? undefined,
      geoid: q.get("geoid") ?? undefined,
      from: q.get("from") ?? undefined,
      to: q.get("to") ?? undefined,
      limit,
      offset,
    });
    return Response.json(
      {
        dataset: slug,
        observations,
        next: observations.length === limit && offset + limit <= MAX_OFFSET ? offset + limit : null,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
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
  const limited = await enforceRateLimits([{ scope: "partner-observations-hour", limit: 24, windowSeconds: 3600 }], {
    identity: `partner:${auth.partner.id}`,
  });
  if (limited) return rateLimitResponse(limited);
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
    body = await readJsonBody(request, MAX_WRITE_BODY);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) {
      return Response.json({ ok: false, error: "Request body is too large." }, { status: 413 });
    }
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
