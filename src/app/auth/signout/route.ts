import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ?scope=global also ends the account's sessions on every other device.
export async function POST(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope") === "global" ? "global" : "local";
  const supabase = await createClient();
  await supabase.auth.signOut({ scope });
  // 303 so the browser follows with a GET instead of re-posting to /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
