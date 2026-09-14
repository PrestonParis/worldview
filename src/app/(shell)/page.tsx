import {
  countEntities,
  countEntitiesCreatedSince,
  listEntities,
} from "@/lib/neo4j/entities";
import { countEdges, countEdgesCreatedSince, listEdges } from "@/lib/neo4j/edges";
import { countSources, countSourcesCreatedSince } from "@/lib/db/sources";
import { countBills, countBillsCreatedSince } from "@/lib/db/bills";
import { countRollCalls, countRollCallsCreatedSince } from "@/lib/db/rollCalls";
import { countContributions, countContributionsCreatedSince } from "@/lib/db/contributions";
import { countElections, countElectionsCreatedSince } from "@/lib/db/elections";
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
    sourceCount,
    billCount,
    rollCallCount,
    contributionCount,
    electionCount,
    entityDelta,
    edgeDelta,
    sourceDelta,
    billDelta,
    rollCallDelta,
    contributionDelta,
    electionDelta,
    allEntities,
    allEdges,
  ] = await Promise.all([
    countEntities(),
    countEdges(),
    countSources(),
    countBills(),
    countRollCalls(),
    countContributions(),
    countElections(),
    countEntitiesCreatedSince(weekAgo),
    countEdgesCreatedSince(weekAgo),
    countSourcesCreatedSince(weekAgo),
    countBillsCreatedSince(weekAgo),
    countRollCallsCreatedSince(weekAgo),
    countContributionsCreatedSince(weekAgo),
    countElectionsCreatedSince(weekAgo),
    listEntities(),
    listEdges(),
  ]);

  const entityById = new Map(allEntities.map((e) => [e.id, e]));
  const sortedByCreated = [...allEntities].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const recentEntities = sortedByCreated.slice(0, 6);
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
    { label: "Sources", value: sourceCount, delta: sourceDelta, href: "/data/sources" },
    { label: "Bills", value: billCount, delta: billDelta, href: "/data/bills" },
    {
      label: "Roll-call votes",
      value: rollCallCount,
      delta: rollCallDelta,
      href: "/legislation",
    },
    {
      label: "Contributions",
      value: contributionCount,
      delta: contributionDelta,
      href: "/data/contributions",
    },
    {
      label: "Elections",
      value: electionCount,
      delta: electionDelta,
      href: "/data/elections",
    },
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

      <RecentActivity entities={recentEntities} edges={allEdges} />

      <Connections edges={recentEdges} entityById={entityById} />

      <ToolModules />
    </div>
  );
}
