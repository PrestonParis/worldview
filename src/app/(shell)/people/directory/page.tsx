import type { Metadata } from "next";
import { PeopleDirectory, type DirectoryParams } from "@/components/graph/people-directory";
import { PeopleViewNav } from "@/components/graph/people-view-nav";
import { degreeById, withoutStructuralEdges } from "@/lib/graph/scope";
import { listEdges } from "@/lib/db/edges";
import { listEntities } from "@/lib/db/entities";

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

// Every filter combination is its own URL, so only the unfiltered directory
// is offered to search engines (robots.txt also keeps crawlers off query
// strings).
export async function generateMetadata({ searchParams }: PageProps<"/people/directory">): Promise<Metadata> {
  const filtered = Object.keys(await searchParams).length > 0;
  return {
    title: "Directory | People & Power | Worldview",
    description: "Filter and sort every political person, organization and institution in Worldview.",
    alternates: { canonical: "/people/directory" },
    ...(filtered ? { robots: { index: false, follow: false } } : {}),
  };
}

// The whole graph loads on every view, so warm instances reuse it for a few
// minutes. Edits show up once it expires.
const TTL_MS = 10 * 60 * 1000;
let graph: { at: number; data: Promise<[Awaited<ReturnType<typeof listEntities>>, Awaited<ReturnType<typeof listEdges>>]> } | null = null;

function loadGraph() {
  if (!graph || Date.now() - graph.at > TTL_MS) {
    const data = Promise.all([listEntities(), listEdges()]);
    graph = { at: Date.now(), data };
    data.catch(() => { graph = null; });
  }
  return graph.data;
}

export default async function DirectoryPage({ searchParams }: PageProps<"/people/directory">) {
  const raw = await searchParams;
  const [entities, edges] = await loadGraph();
  // Direct ties only: seats and party cards would rank every legislature first.
  const degree = new Map(Object.entries(degreeById(withoutStructuralEdges(edges))));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex justify-center"><PeopleViewNav active="directory" /></div>
      <PeopleDirectory
        entities={entities}
        degree={degree}
        params={{ q: first(raw.q), group: first(raw.group), side: first(raw.side), state: first(raw.state), ties: first(raw.ties), sort: first(raw.sort), layout: first(raw.layout), page: first(raw.page) } satisfies DirectoryParams}
      />
    </div>
  );
}
