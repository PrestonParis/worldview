import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestAddresses } from "@/lib/my-government/suggestions";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

const requestSchema = z.object({
  query: z.string().trim().min(5).max(240),
});

export async function POST(request: Request) {
  const limited = await enforceRateLimits(
    [
      { scope: "government-suggestions-minute", limit: 20, windowSeconds: 60 },
      { scope: "government-suggestions-hour", limit: 120, windowSeconds: 3600 },
    ],
    { request },
  );
  if (limited) return rateLimitResponse(limited);
  let query: string;
  try {
    query = requestSchema.parse(await request.json()).query;
  } catch {
    return NextResponse.json({ error: "Enter at least a street number and street name." }, { status: 400 });
  }

  try {
    const suggestions = await suggestAddresses(query);
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address suggestions are temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
