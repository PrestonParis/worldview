import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/ingest/auth";
import { runIngestBatch, type IngestBatchPayload } from "@/lib/ingest/batch";

export async function POST(request: Request) {
  const authError = checkIngestAuth(request);
  if (authError) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
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
      return NextResponse.json(
        { ok: false, error: `"${key}" must be an array when present.` },
        { status: 400 },
      );
    }
  }

  const { results, summary } = await runIngestBatch(payload);
  const status = summary.failed > 0 ? 207 : 200;

  return NextResponse.json(
    { ok: summary.failed === 0, summary, results },
    { status },
  );
}
