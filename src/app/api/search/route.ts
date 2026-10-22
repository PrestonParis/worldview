import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/db/entities";
import { listDatasets } from "@/lib/db/stats";
import { publicEntityPath } from "@/lib/people/public";
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
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json<SearchResponse>({ pages: [], datasets: [], entities: [] });
  }

  const [entities, datasets] = await Promise.all([
    searchEntities(q, MAX_PER_GROUP),
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
    href: publicEntityPath(e),
    type: e.type,
  }));

  return NextResponse.json<SearchResponse>({
    pages: pageResults,
    datasets: datasetResults,
    entities: entityResults,
  });
}
