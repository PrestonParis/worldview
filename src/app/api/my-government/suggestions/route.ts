import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestAddresses } from "@/lib/my-government/suggestions";

const requestSchema = z.object({
  query: z.string().trim().min(5).max(240),
});

export async function POST(request: Request) {
  let query: string;
  try {
    query = requestSchema.parse(await request.json()).query;
  } catch {
    return NextResponse.json(
      { error: "Enter at least a street number and street name." },
      { status: 400 },
    );
  }

  try {
    const suggestions = await suggestAddresses(query);
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address suggestions are temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
