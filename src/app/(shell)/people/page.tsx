import type { Metadata } from "next";
import { PeopleExplore } from "@/components/graph/people-explore";
import { PeopleViewNav } from "@/components/graph/people-view-nav";
import { listEdges } from "@/lib/db/edges";
import { listEntities } from "@/lib/db/entities";
import { loadCongressAtlas } from "@/lib/people/atlas";

export const metadata: Metadata = {
  title: "People & Power | Worldview",
  description: "Explore political people, organizations and institutions, and inspect the documented relationships between them.",
};

// One cached render for every visitor and crawler; the page reads no query
// string. The directory (/people/directory) and old ?view= links are routed
// in next.config.ts.
export const revalidate = 86400;

export default async function Page() {
  const [entities, edges, atlas] = await Promise.all([
    listEntities(),
    listEdges(),
    loadCongressAtlas().catch(() => null),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex justify-center"><PeopleViewNav active="explore" /></div>
      <PeopleExplore entities={entities} edges={edges} atlas={atlas} />
    </div>
  );
}
