import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PeopleDirectory, type DirectoryParams } from "@/components/graph/people-directory";
import { PeopleExplore } from "@/components/graph/people-explore";
import { PeopleViewNav, type PeopleView } from "@/components/graph/people-view-nav";
import { degreeById, withoutStructuralEdges } from "@/lib/graph/scope";
import { listEdges } from "@/lib/db/edges";
import { getEntity, listEntities } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";
import { loadCongressAtlas } from "@/lib/people/atlas";

export const metadata: Metadata = {
  title: "People & Power | Worldview",
  description: "Explore political people, organizations and institutions, and inspect the documented relationships between them.",
};

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

// The whole graph loads on every view, so warm instances reuse it for a few
// minutes. Edits show up once it expires.
const TTL_MS = 10 * 60 * 1000;
let graph: { at: number; data: Promise<[Awaited<ReturnType<typeof listEntities>>, Awaited<ReturnType<typeof listEdges>>]> } | null = null;
let atlasCache: { at: number; data: ReturnType<typeof loadCongressAtlas> } | null = null;

function loadGraph() {
  if (!graph || Date.now() - graph.at > TTL_MS) {
    const data = Promise.all([listEntities(), listEdges()]);
    graph = { at: Date.now(), data };
    data.catch(() => { graph = null; });
  }
  return graph.data;
}

function loadAtlas() {
  if (!atlasCache || Date.now() - atlasCache.at > TTL_MS) {
    atlasCache = { at: Date.now(), data: loadCongressAtlas().catch(() => null) };
  }
  return atlasCache.data;
}

export default async function Page({ searchParams }: PageProps<"/people">) {
  const raw = await searchParams;
  const requested = first(raw.view);
  // The network view was retired; old links land on the subject's profile,
  // whose relationships section replaced it.
  if (requested === "network") {
    const root = first(raw.root);
    const entity = root ? await getEntity(root) : null;
    redirect(entity ? `${publicEntityPath(entity)}#relationships` : "/people");
  }
  const view: PeopleView = requested === "directory" ? "directory" : "explore";
  const [[entities, edges], atlas] = await Promise.all([
    loadGraph(),
    view === "explore" ? loadAtlas() : Promise.resolve(null),
  ]);
  // Direct ties only: seats and party cards would rank every legislature first.
  const degree = new Map(Object.entries(degreeById(withoutStructuralEdges(edges))));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex justify-center"><PeopleViewNav active={view} /></div>

      {view === "explore" ? <PeopleExplore entities={entities} edges={edges} atlas={atlas} featuredId={first(raw.featured)} /> : null}

      {view === "directory" ? (
        <PeopleDirectory
          entities={entities}
          degree={degree}
          params={{ q: first(raw.q), group: first(raw.group), side: first(raw.side), state: first(raw.state), ties: first(raw.ties), sort: first(raw.sort), layout: first(raw.layout), page: first(raw.page) } satisfies DirectoryParams}
        />
      ) : null}
    </div>
  );
}
