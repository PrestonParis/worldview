import { NextResponse, type NextRequest } from "next/server";
import { STATES_51 } from "@/lib/geo/states";
import { stateSlug } from "@/lib/states/slug";
import { updateSession } from "@/lib/supabase/middleware";

// Crawler user agents: "Name/1.0", "Name;", or a contact URL like
// "(+https://...)". Phone models with "bot" in the name (CUBOT) don't match.
const CRAWLER = /bot[/;)]|crawler|spider|facebookexternalhit|meta-external|\(\+https?:\/\//i;

export async function proxy(request: NextRequest) {
  // Every query string is a filter, page or sort over a page crawlers can
  // read at its plain URL, and each variant is a fresh server render.
  // robots.txt asks crawlers to skip them; this sends the ones that don't
  // to the plain URL, which is cached.
  if (request.nextUrl.search && CRAWLER.test(request.headers.get("user-agent") ?? "")) {
    const plain = request.nextUrl.clone();
    plain.search = "";
    return NextResponse.redirect(plain, 301);
  }

  // The /subpoena directory is cached; its search (and the old ?entity= links)
  // moved to /subpoena/search.
  if (request.nextUrl.pathname === "/subpoena" && request.nextUrl.search) {
    const search = request.nextUrl.clone();
    search.pathname = "/subpoena/search";
    return NextResponse.redirect(search, 308);
  }

  // /states opens on the visitor's own state, from Vercel's IP geolocation.
  // Crawlers and "/states?all" (the state pages' breadcrumb) get the index.
  if (request.nextUrl.pathname === "/states" && !request.nextUrl.search && !CRAWLER.test(request.headers.get("user-agent") ?? "")) {
    const region = request.headers.get("x-vercel-ip-country") === "US" ? request.headers.get("x-vercel-ip-country-region") : null;
    const state = region ? STATES_51.find((s) => s.abbr === region) : undefined;
    if (state) {
      const home = request.nextUrl.clone();
      home.pathname = `/states/${stateSlug(state.name)}`;
      const res = NextResponse.redirect(home, 307);
      res.headers.set("Vary", "x-vercel-ip-country-region");
      return res;
    }
  }

  // Anonymous visitors (and crawlers) have no session to refresh, so skip
  // the Supabase round-trip entirely.
  const gated = SIGN_IN_REQUIRED.test(request.nextUrl.pathname);
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
  if (!hasSession) return gated ? toSignIn(request) : NextResponse.next();
  const { response, user } = await updateSession(request);
  return gated && !user ? toSignIn(request) : response;
}

// Subpoena is for signed-in accounts (notes/subpoena-plan.md). Gating here
// keeps its pages statically cached; the content is not secret, the gate
// keeps crawlers off ~26K entity pages and leaves room for paid access.
const SIGN_IN_REQUIRED = /^\/subpoena(\/|$)/;

function toSignIn(request: NextRequest) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(login, 307);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|geojson)$).*)",
  ],
};
