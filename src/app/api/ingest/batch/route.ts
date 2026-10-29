import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/ingest/auth";
import { runIngestBatch, type IngestBatchPayload } from "@/lib/ingest/batch";
import { RequestBodyTooLarge, readJsonBody } from "@/lib/security/body";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

const MAX_BODY = 8 * 1024 * 1024;
const MAX_ITEMS = 5_000;

export async function POST(request: Request) {
  const authError = checkIngestAuth(request);
  if (authError) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }
  const limited = await enforceRateLimits([{ scope: "ingest-batch-hour", limit: 30, windowSeconds: 3600 }], {
    request,
  });
  if (limited) return rateLimitResponse(limited);

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) {
      return NextResponse.json({ ok: false, error: "Request body exceeds 8 MB." }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Request body must be an object with any of: entities, sources, edges, claims, elections, candidacies, electionResults, raceRatings (each an array of items).",
      },
      { status: 400 },
    );
  }

  const payload = body as IngestBatchPayload;
  for (const key of [
    "entities",
    "sources",
    "edges",
    "claims",
    "elections",
    "candidacies",
    "electionResults",
    "raceRatings",
  ] as const) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) {
      return NextResponse.json({ ok: false, error: `"${key}" must be an array when present.` }, { status: 400 });
    }
  }
  const totalItems = Object.values(payload).reduce(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    0,
  );
  if (totalItems > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: `At most ${MAX_ITEMS} total items per request.` }, { status: 413 });
  }

  const { results, summary } = await runIngestBatch(payload);
  const status = summary.failed > 0 ? 207 : 200;

  return NextResponse.json({ ok: summary.failed === 0, summary, results }, { status });
}
