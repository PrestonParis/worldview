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

/**
 * Lower is better. Ranks a match on where it occurs relative to word
 * boundaries, so "don" surfaces "Donald Trump" (first word starts with
 * the query) ahead of "Brandon Gill" (query only appears mid-word).
 */
function matchRank(text: string, q: string): number {
  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index === -1) return Infinity;
  if (index === 0) return 0;
  if (lower[index - 1] === " ") return 1;
  return 2;
}

function bestRank(q: string, ...fields: (string | undefined)[]): number {
  return Math.min(...fields.map((f) => matchRank(f ?? "", q)));
}

function byRank<T>(q: string, items: T[], ...fieldsOf: ((item: T) => string | undefined)[]) {
  return items
    .map((item) => ({ item, rank: bestRank(q, ...fieldsOf.map((f) => f(item))) }))
    .filter(({ rank }) => rank !== Infinity)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PER_GROUP)
    .map(({ item }) => item);
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

  const entityResults: SearchResult[] = byRank(q, entities, (e) => e.name).map((e) => ({
    id: e.id,
    label: e.name,
    meta: e.type,
    href: `/data/entities/${e.id}`,
    type: e.type,
  }));

  const claimResults: SearchResult[] = byRank(
    q,
    claims,
    (c) => c.quote,
    (c) => c.topic,
  ).map((c) => ({
    id: c.id,
    label: c.quote,
    meta: c.topic || new Date(c.date).toLocaleDateString(),
    href: `/data/claims/${c.id}/edit`,
  }));

  const sourceResults: SearchResult[] = byRank(
    q,
    sources,
    (s) => s.title,
    (s) => s.publisher,
  ).map((s) => ({
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
