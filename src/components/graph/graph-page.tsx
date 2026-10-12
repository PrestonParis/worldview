import Link from "next/link";
import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { computeRadialLayout } from "@/lib/graph/layout";
import {
  neighborhoodSubgraph,
  filterByRelCategory,
  ENTITY_TYPE_ORDER,
} from "@/lib/graph/scope";
import { nodeSizeForDegree, type NetworkLink, type NetworkNode } from "@/lib/graph/network";
import { relationshipCategories, relationshipCategoryOf } from "@/lib/relationships";
import { familyOf } from "@/lib/graph/lean";
import { getSourcesByIds } from "@/lib/db/sources";
import { EmptyState } from "@/components/empty-state";
import { GraphView } from "./graph-view";
import type { PageContent } from "@/lib/pages-content";

export interface GraphPageParams {
  root?: string;
  depth?: string;
  type?: string;
  hubs?: string;
  rel?: string;
  side?: string;
  limit?: string;
}

const MAX_DEPTH = 2;
const MAX_FOCUSED_NODES = 60;

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"` —
// Next only reads that config from route segment files, not from an
// imported component like this one.
export async function GraphPage({
  content,
  params = {},
  compactHeader = false,
}: {
  content: PageContent;
  params?: GraphPageParams;
  compactHeader?: boolean;
}) {
  const [everyEntity, everyEdge] = await Promise.all([listEntities(), listEdges()]);

  const requestedRoot = params.root ? everyEntity.find((entity) => entity.id === params.root) : undefined;
  const allEntities = everyEntity;
  const allEdges = everyEdge;

  const typeFilter =
    params.type && params.type.length
      ? new Set(params.type.split(",").filter((t) => ENTITY_TYPE_ORDER.includes(t as never)))
      : undefined;
  const depth = Math.min(MAX_DEPTH, Math.max(1, Number(params.depth) || 1));
  const includeHubs = params.hubs === "1";
  const relFilter =
    params.rel && params.rel.length
      ? new Set(params.rel.split(",").filter((r) => relationshipCategories.includes(r as never)))
      : new Set<string>();

  const rootEntity = requestedRoot;
  if (!rootEntity) {
    return <EmptyState message="Choose a person or organization to build a focused network." cta={{ href: "/people?view=network", label: "Search the network" }} />;
  }

  const base = neighborhoodSubgraph(allEntities, allEdges, rootEntity.id, {
    depth,
    entityTypes: typeFilter,
    includeHubs,
  });

  const filtered = filterByRelCategory(base, relFilter, rootEntity.id);

  // A focused network remains readable even for a president, party or
  // chamber with hundreds of immediate links. Keep the selected subject
  // plus the most connected neighbours; the inspector reports the limit.
  const fullDegree = new Map<string, number>();
  for (const edge of allEdges) {
    fullDegree.set(edge.sourceEntityId, (fullDegree.get(edge.sourceEntityId) ?? 0) + 1);
    fullDegree.set(edge.targetEntityId, (fullDegree.get(edge.targetEntityId) ?? 0) + 1);
  }
  const keptIds = new Set(
    [rootEntity, ...filtered.entities
      .filter((entity) => entity.id !== rootEntity.id)
      .sort((a, b) => (fullDegree.get(b.id) ?? 0) - (fullDegree.get(a.id) ?? 0))]
      .slice(0, MAX_FOCUSED_NODES)
      .map((entity) => entity.id),
  );
  const scoped = {
    entities: filtered.entities.filter((entity) => keptIds.has(entity.id)),
    edges: filtered.edges.filter((edge) => keptIds.has(edge.sourceEntityId) && keptIds.has(edge.targetEntityId)),
  };
  const hiddenNodeCount = Math.max(0, filtered.entities.length - scoped.entities.length);

  const relCategoryCounts: Record<string, number> = {};
  for (const e of base.edges) {
    const cat = relationshipCategoryOf(e.relType ?? "");
    if (cat) relCategoryCounts[cat] = (relCategoryCounts[cat] ?? 0) + 1;
  }

  const degree = new Map<string, number>();
  for (const e of scoped.edges) {
    degree.set(e.sourceEntityId, (degree.get(e.sourceEntityId) ?? 0) + 1);
    degree.set(e.targetEntityId, (degree.get(e.targetEntityId) ?? 0) + 1);
  }
  const sizeOf = (id: string) =>
    id === rootEntity.id ? 18 : Math.min(9, nodeSizeForDegree(degree.get(id) ?? 0));

  const sources = new Map(
    (await getSourcesByIds(scoped.edges.map((e) => e.sourceRecordId ?? "")).catch(() => [])).map((s) => [s.id, s]),
  );
  const links: NetworkLink[] = scoped.edges.map((e) => ({
    id: e.id,
    source: e.sourceEntityId,
    target: e.targetEntityId,
    relType: e.relType ?? "",
    label: e.label,
    role: e.role ?? "",
    validFrom: e.validFrom ?? "",
    validTo: e.validTo ?? "",
    sourced: Boolean(e.sourceRecordId),
    sourceTitle: e.sourceRecordId ? sources.get(e.sourceRecordId)?.title : undefined,
    sourceUrl: e.sourceRecordId ? sources.get(e.sourceRecordId)?.url || undefined : undefined,
    sourcePublisher: e.sourceRecordId ? sources.get(e.sourceRecordId)?.publisher || undefined : undefined,
    former: Boolean(e.validTo && e.validTo < new Date().toISOString().slice(0, 10)),
  }));
  const positions = computeRadialLayout(rootEntity.id, scoped.entities, links);
  const positionById = new Map(positions.map((p) => [p.id, p]));

  const nodes: NetworkNode[] = scoped.entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    description: e.description ?? "",
    x: positionById.get(e.id)?.x ?? 0,
    y: positionById.get(e.id)?.y ?? 0,
    size: sizeOf(e.id),
    degree: degree.get(e.id) ?? 0,
    family: familyOf(e),
  }));

  return (
    <div className="flex h-full flex-col">
      {!compactHeader ? <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <Link
            href="/people/administration"
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Administration →
          </Link>
          <Link
            href="/people/orgs"
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Organizations →
          </Link>
        </div>
      </div> : null}

      {allEntities.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            message="This graph is empty. Every page draws from the same shared entities and relationships. Add some in"
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        </div>
      ) : (
        <div className="mt-6 h-[calc(100dvh-7rem)] min-h-[640px]">
          <GraphView
            nodes={nodes}
            links={links}
            searchItems={allEntities.map((e) => ({ id: e.id, name: e.name, type: e.type }))}
            rootEntity={rootEntity ? { id: rootEntity.id, name: rootEntity.name } : null}
            depth={depth}
            includeHubs={includeHubs}
            typeFilter={typeFilter ? [...typeFilter] : []}
            relFilter={[...relFilter]}
            rows={[]}
            overview={null}
            relCategoryCounts={relCategoryCounts}
            searchPlaceholder="Change focus"
            hiddenNodeCount={hiddenNodeCount}
          />
        </div>
      )}
    </div>
  );
}
