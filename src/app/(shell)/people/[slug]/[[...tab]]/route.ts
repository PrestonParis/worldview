import { NextResponse } from "next/server";
import { PROFILE_BASE } from "@/lib/people/public";

// Profiles moved into Subpoena. Old /people/[slug] links, tabs included,
// land on the case file; the Subpoena route resolves merges and slugs.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; tab?: string[] }> }) {
  const { slug, tab = [] } = await params;
  const url = new URL(request.url);
  const path = [PROFILE_BASE, encodeURIComponent(slug), ...tab.map(encodeURIComponent)].join("/");
  return NextResponse.redirect(new URL(`${path}${url.search}`, url), 308);
}
