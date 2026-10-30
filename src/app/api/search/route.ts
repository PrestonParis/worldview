import { NextResponse } from "next/server";
import { getDossierEntityIds, searchEntities } from "@/lib/db/entities";
import { listDatasets } from "@/lib/db/stats";
import { entityPartyAndPlace, entityRole, publicEntityPath } from "@/lib/people/public";
import {
  findTopics,
  normalizeQuery,
  resultOrder,
  searchSite,
  significantWords,
  type ResultGroup,
} from "@/lib/search/site";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

const MAX_PER_GROUP = 6;
const MAX_ENTITIES = 5;

const PARTY_INITIALS: Record<string, string> = {
  Democratic: "D",
  Democrat: "D",
  DEM: "D",
  Republican: "R",
  REP: "R",
  Independent: "I",
  IND: "I",
};

export interface SearchResult {
  id: string;
  label: string;
  meta: string;
  href: string;
  type?: string;
  /** People and organizations with a full dossier. */
  dossier?: boolean;
}

export interface SearchResponse {
  pages: SearchResult[];
  datasets: SearchResult[];
  entities: SearchResult[];
  /** Groups in display order, most relevant to the query first. */
  order: ResultGroup[];
}

export async function GET(request: Request) {
  const limited = await enforceRateLimits([{ scope: "global-search-minute", limit: 60, windowSeconds: 60 }], {
    request,
  });
  if (limited) return rateLimitResponse(limited);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json<SearchResponse>({ pages: [], datasets: [], entities: [], order: [] });
  }
  if (q.length > 100) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  // One letter matches most of the directory; wait for a second.
  const [entities, datasets] = await Promise.all([
    q.length > 1 ? searchEntities(q, MAX_ENTITIES) : [],
    listDatasets().catch(() => []),
  ]);
  const dossierIds = await getDossierEntityIds(entities.map((e) => e.id));

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

  const entityResults: SearchResult[] = entities.map((e) => {
    const { party, place } = entityPartyAndPlace(e);
    return {
      id: e.id,
      label: e.name,
      meta: [entityRole(e), PARTY_INITIALS[party] ?? party, place === "United States" ? "" : place]
        .filter(Boolean)
        .join(" · "),
      href: publicEntityPath(e),
      type: e.type,
      dossier: dossierIds.has(e.id),
    };
  });

  return NextResponse.json<SearchResponse>(
    {
      pages: pageResults,
      datasets: datasetResults,
      entities: entityResults,
      order: resultOrder(q, pageResults, entities.map((e) => e.name)),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
