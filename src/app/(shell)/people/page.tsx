import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { GraphPage, type GraphPageParams } from "@/components/graph/graph-page";
import { PeopleDirectory, type DirectoryParams } from "@/components/graph/people-directory";
import { PeopleExplore } from "@/components/graph/people-explore";
import { PeopleSearch } from "@/components/graph/people-search";
import { PeopleViewNav, type PeopleView } from "@/components/graph/people-view-nav";
import { degreeById, withoutStructuralEdges } from "@/lib/graph/scope";
import { listEdges } from "@/lib/neo4j/edges";
import { listEntities } from "@/lib/neo4j/entities";
import { publicEntityPath } from "@/lib/people/public";
import { loadCongressAtlas } from "@/lib/people/atlas";
import { pagesContent } from "@/lib/pages-content";

export const metadata: Metadata = {
  title: "People & Power | Worldview",
  description: "Explore political people, organizations and institutions, and inspect the documented relationships between them.",
};

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function Page({ searchParams }: PageProps<"/people">) {
  const raw = await searchParams;
  const requested = first(raw.view);
  const view: PeopleView = requested === "network" || requested === "directory" ? requested : "explore";
  const [entities, edges, atlas] = await Promise.all([
    listEntities(),
    listEdges(),
    view === "explore" ? loadCongressAtlas().catch(() => null) : Promise.resolve(null),
  ]);
  const degree = new Map(Object.entries(degreeById(edges)));
  const directDegree = degreeById(withoutStructuralEdges(edges));
  const searchItems = entities.map((entity) => ({ id: entity.id, name: entity.name, type: entity.type, href: publicEntityPath(entity) }));
  const root = first(raw.root);

  return (
    <div className={view === "network" && root ? "mx-auto w-full max-w-[1800px]" : "mx-auto w-full max-w-7xl"}>
      <div className="mb-8 flex justify-center"><PeopleViewNav active={view} /></div>

      {view === "explore" ? <PeopleExplore entities={entities} edges={edges} atlas={atlas} featuredId={first(raw.featured)} /> : null}

      {view === "directory" ? (
        <PeopleDirectory
          entities={entities}
          degree={degree}
          params={{ q: first(raw.q), group: first(raw.group), side: first(raw.side), sort: first(raw.sort), page: first(raw.page) } satisfies DirectoryParams}
        />
      ) : null}

      {view === "network" && !root ? (
        <section className="mx-auto max-w-4xl py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950"><Network className="h-6 w-6" /></div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Build a focused network</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-slate-500 dark:text-slate-400">
            Choose one person or institution. Worldview will begin with its direct documented relationships, then let you expand from there.
          </p>
          <div className="mx-auto mt-8 max-w-2xl text-left"><PeopleSearch entities={searchItems} destination="network" large /></div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {entities
              .filter((entity) => (directDegree[entity.id] ?? 0) > 0 && !entity.name.startsWith("United States "))
              .sort((a, b) => (directDegree[b.id] ?? 0) - (directDegree[a.id] ?? 0))
              .slice(0, 6)
              .map((entity) => (
                <Link key={entity.id} href={`/people?view=network&root=${entity.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500">
                  {entity.name} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      {view === "network" && root ? (
        <GraphPage
          content={pagesContent.people}
          params={{ root, depth: first(raw.depth), type: first(raw.type), hubs: first(raw.hubs), rel: first(raw.rel), side: first(raw.side) } satisfies GraphPageParams}
          compactHeader
        />
      ) : null}
    </div>
  );
}
