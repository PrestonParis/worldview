import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PeopleDirectory, type DirectoryParams } from "@/components/graph/people-directory";
import { PeopleExplore } from "@/components/graph/people-explore";
import { PeopleViewNav, type PeopleView } from "@/components/graph/people-view-nav";
import { degreeById, withoutStructuralEdges } from "@/lib/graph/scope";
import { listEdges } from "@/lib/neo4j/edges";
import { getEntity, listEntities } from "@/lib/neo4j/entities";
import { publicEntityPath } from "@/lib/people/public";
import { loadCongressAtlas } from "@/lib/people/atlas";

export const metadata: Metadata = {
  title: "People & Power | Worldview",
  description: "Explore political people, organizations and institutions, and inspect the documented relationships between them.",
};

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

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
  const [entities, edges, atlas] = await Promise.all([
    listEntities(),
    listEdges(),
    view === "explore" ? loadCongressAtlas().catch(() => null) : Promise.resolve(null),
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
