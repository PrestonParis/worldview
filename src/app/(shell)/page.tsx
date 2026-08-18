import {
  countEntities,
  countEntitiesCreatedSince,
  listEntities,
} from "@/lib/neo4j/entities";
import { countEdges, countEdgesCreatedSince, listEdges } from "@/lib/neo4j/edges";
import { countClaims, countClaimsCreatedSince, listRecentClaims } from "@/lib/db/claims";
import { countSources, countSourcesCreatedSince } from "@/lib/db/sources";
import { countBills, countBillsCreatedSince } from "@/lib/db/bills";
import { computeForceLayout } from "@/lib/graph/layout";
import { daysAgo } from "@/lib/dates";
import { Hero } from "@/components/home/hero";
import { KnowledgeBase } from "@/components/home/knowledge-base";
import { RecentActivity } from "@/components/home/recent-activity";
import { Connections } from "@/components/home/connections";
import { ToolModules } from "@/components/home/tool-modules";

export const dynamic = "force-dynamic";

const GRAPH_PREVIEW_SIZE = 20;

export default async function Home() {
  const weekAgo = daysAgo(7);

  const [
    entityCount,
    edgeCount,
    claimCount,
    sourceCount,
    billCount,
    entityDelta,
    edgeDelta,
    claimDelta,
    sourceDelta,
    billDelta,
    allEntities,
    allEdges,
    recentClaims,
  ] = await Promise.all([
    countEntities(),
    countEdges(),
    countClaims(),
    countSources(),
    countBills(),
    countEntitiesCreatedSince(weekAgo),
    countEdgesCreatedSince(weekAgo),
    countClaimsCreatedSince(weekAgo),
    countSourcesCreatedSince(weekAgo),
    countBillsCreatedSince(weekAgo),
    listEntities(),
    listEdges(),
    listRecentClaims(5),
  ]);

  const entityById = new Map(allEntities.map((e) => [e.id, e]));
  const sortedByCreated = [...allEntities].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const recentEntities = sortedByCreated.slice(0, 5);
  const graphEntities = sortedByCreated.slice(0, GRAPH_PREVIEW_SIZE);
  const graphEntityIds = new Set(graphEntities.map((e) => e.id));
  const graphEdges = allEdges.filter(
    (e) => graphEntityIds.has(e.sourceEntityId) && graphEntityIds.has(e.targetEntityId),
  );
  const graphPositions = computeForceLayout(graphEntities, graphEdges);
  const recentEdges = allEdges.slice(0, 5);

  const stats = [
    { label: "Entities", value: entityCount, delta: entityDelta, href: "/data/entities" },
    { label: "Relationships", value: edgeCount, delta: edgeDelta, href: "/data/edges" },
    { label: "Claims", value: claimCount, delta: claimDelta, href: "/data/claims" },
    { label: "Sources", value: sourceCount, delta: sourceDelta, href: "/data/sources" },
    { label: "Bills", value: billCount, delta: billDelta, href: "/data/bills" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12">
      <Hero />

      <KnowledgeBase
        stats={stats}
        graphEntities={graphEntities}
        graphEdges={graphEdges}
        graphPositions={graphPositions}
      />

      <RecentActivity
        entities={recentEntities}
        edges={allEdges}
        claims={recentClaims}
        entityById={entityById}
      />

      <Connections edges={recentEdges} entityById={entityById} />

      <ToolModules />
    </div>
  );
}
