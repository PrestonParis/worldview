import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeSignIn, safeNext } from "@/lib/auth/session";
import { claimAfterSignIn } from "@/lib/quiz/access";

// OAuth (Google) lands here with ?code=. Email sign-in uses a typed code and
// never touches this route.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const result = await finalizeSignIn();
      if (result === "ok") return NextResponse.redirect(`${origin}${await claimAfterSignIn(next)}`);
      if (result === "not_registered") {
        return NextResponse.redirect(`${origin}/register?error=not_registered&next=${encodeURIComponent(next)}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth&next=${encodeURIComponent(next)}`);
}
