import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that don't require a signed-in session — either the sign-in flow
// itself, or a surface with its own separate auth (the ingest API's bearer
// token, checked in src/lib/ingest/auth.ts).
const SESSION_EXEMPT_PREFIXES = ["/login", "/auth", "/api/ingest"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not add logic between createServerClient and getUser() — it needs
  // to run on every request for token refresh to work correctly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isExempt = SESSION_EXEMPT_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isExempt) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
