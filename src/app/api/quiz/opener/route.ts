import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { quizOpenerEvents } from "@/lib/db/schema";
import { parseOpenerEvent } from "@/lib/quiz/openers";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";
import { maybeRunAbuseRetention } from "@/lib/security/retention";

// Anonymous landing-page visit log for the quiz stats (docs/quiz.md).
// Sent once per visit by the hero via sendBeacon. Nothing identifying is
// stored: no cookies, IP, or user agent.

const MAX_BODY = 2048;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

export async function POST(req: NextRequest) {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const limited = await enforceRateLimits(
    [
      { scope: "quiz-opener-dedupe", limit: 1, windowSeconds: 60 },
      { scope: "quiz-opener-hour", limit: 30, windowSeconds: 3600 },
    ],
    { request: req },
  );
  if (limited) return rateLimitResponse(limited);
  const text = await req.text();
  if (text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const event = parseOpenerEvent(body);
  if (!event) return new NextResponse(null, { status: 400 });
  await db.insert(quizOpenerEvents).values(event);
  await maybeRunAbuseRetention();
  return new NextResponse(null, { status: 204 });
}
