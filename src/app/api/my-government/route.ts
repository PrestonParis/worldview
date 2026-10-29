import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupGovernment } from "@/lib/my-government/lookup";
import { addressInputError } from "@/lib/my-government/address";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

const requestSchema = z.object({
  address: z.string().trim().min(8).max(240),
  magicKey: z.string().trim().min(1).max(1024).optional(),
});

export function GET() {
  return NextResponse.json(
    { error: "Use POST with a JSON body: { address }." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(request: Request) {
  const limited = await enforceRateLimits(
    [
      { scope: "government-lookup-ten-minute", limit: 5, windowSeconds: 600 },
      { scope: "government-lookup-day", limit: 20, windowSeconds: 86_400 },
    ],
    { request },
  );
  if (limited) return rateLimitResponse(limited);
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a complete U.S. street address." }, { status: 400 });
  }

  // A selected suggestion is resolved by its key, so only free-typed addresses
  // need the stricter completeness check.
  const inputError = parsed.magicKey ? null : addressInputError(parsed.address);
  if (inputError) {
    return NextResponse.json({ error: inputError }, { status: 400 });
  }

  try {
    const result = await lookupGovernment(parsed.address, parsed.magicKey);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address lookup failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
