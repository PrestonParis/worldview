import { NextResponse } from "next/server";
import { listEntities } from "@/lib/neo4j/entities";
import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";

const MAX_PER_GROUP = 6;

export interface SearchResult {
  id: string;
  label: string;
  meta: string;
  href: string;
  type?: string;
}

export interface SearchResponse {
  entities: SearchResult[];
  claims: SearchResult[];
  sources: SearchResult[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json<SearchResponse>({ entities: [], claims: [], sources: [] });
  }

  const [entities, claims, sources] = await Promise.all([
    listEntities(),
    listClaims(),
    listSources(),
  ]);

  const entityResults: SearchResult[] = entities
    .filter((e) => e.name.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map((e) => ({
      id: e.id,
      label: e.name,
      meta: e.type,
      href: `/data/entities/${e.id}`,
      type: e.type,
    }));

  const claimResults: SearchResult[] = claims
    .filter((c) => c.quote.toLowerCase().includes(q) || (c.topic ?? "").toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map((c) => ({
      id: c.id,
      label: c.quote,
      meta: c.topic || new Date(c.date).toLocaleDateString(),
      href: `/data/claims/${c.id}/edit`,
    }));

  const sourceResults: SearchResult[] = sources
    .filter(
      (s) =>
        s.title.toLowerCase().includes(q) || (s.publisher ?? "").toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_GROUP)
    .map((s) => ({
      id: s.id,
      label: s.title,
      meta: s.publisher || s.sourceType,
      href: `/data/sources/${s.id}/edit`,
    }));

  return NextResponse.json<SearchResponse>({
    entities: entityResults,
    claims: claimResults,
    sources: sourceResults,
  });
}
