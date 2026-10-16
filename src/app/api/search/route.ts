import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/db/entities";
import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";
import { listDatasets } from "@/lib/db/stats";
import { findTopics, normalizeQuery, searchSite, significantWords } from "@/lib/search/site";

const MAX_PER_GROUP = 6;

export interface SearchResult {
  id: string;
  label: string;
  meta: string;
  href: string;
  type?: string;
}

export interface SearchResponse {
  pages: SearchResult[];
  datasets: SearchResult[];
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
    return NextResponse.json<SearchResponse>({ pages: [], datasets: [], entities: [], claims: [], sources: [] });
  }

  const [entities, claims, sources, datasets] = await Promise.all([
    searchEntities(q, MAX_PER_GROUP),
    listClaims(),
    listSources(),
    listDatasets().catch(() => []),
  ]);

  const pageResults: SearchResult[] = searchSite(q).slice(0, MAX_PER_GROUP);

  // Datasets match when every meaningful word of the query appears in the
  // title, topic, or publisher. Failing that, show the datasets behind the
  // topic the query is about ("H-1B immigration" → immigration datasets).
  const words = significantWords(q);
  const exact = words.length
    ? datasets.filter((d) => {
        const haystack = `${d.title} ${d.topic} ${d.publisher} ${d.partner?.name ?? ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
    : [];
  const topics: string[] = findTopics(normalizeQuery(q));
  const matchedDatasets = exact.length ? exact : datasets.filter((d) => topics.includes(d.topic)).slice(0, 3);
  const datasetResults: SearchResult[] = matchedDatasets.slice(0, MAX_PER_GROUP).map((d) => ({
    id: d.slug,
    label: d.title,
    meta: d.publisher,
    href: `/datasets/${d.slug}`,
  }));

  const entityResults: SearchResult[] = entities.map((e) => ({
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
    pages: pageResults,
    datasets: datasetResults,
    entities: entityResults,
    claims: claimResults,
    sources: sourceResults,
  });
}
