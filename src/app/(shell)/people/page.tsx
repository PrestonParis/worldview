import type { Metadata } from "next";
import { PeopleExplore } from "@/components/graph/people-explore";
import { queryAttributes } from "@/lib/db/attributes";
import { listEntities } from "@/lib/db/entities";
import { getAdministration } from "@/lib/db/graph";
import { loadCongressAtlas } from "@/lib/people/atlas";
import { loadCourtComposition } from "@/lib/people/court";
import { toExecutiveMap } from "@/lib/people/executive";

export const metadata: Metadata = {
  title: "People & Power | Worldview",
  description: "Explore political people, organizations and institutions, and inspect the documented relationships between them.",
};

// One cached render for every visitor and crawler; the page reads no query
// string. The attribute explorer applies its filters client-side, and old
// administration and ?view= links are routed in next.config.ts.
export const revalidate = 86400;

export default async function Page() {
  const [entities, atlas, admin, court, attributes] = await Promise.all([
    listEntities(),
    loadCongressAtlas().catch(() => null),
    getAdministration().catch(() => null),
    loadCourtComposition().catch(() => null),
    queryAttributes({}),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PeopleExplore entities={entities} atlas={atlas} executive={admin ? toExecutiveMap(admin) : null} court={court} attributes={attributes} />
    </div>
  );
}
