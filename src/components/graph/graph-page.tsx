import Link from "next/link";
import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { computeClusterLayout, computeRadialLayout } from "@/lib/graph/layout";
import {
  neighborhoodSubgraph,
  overviewSubgraph,
  filterByRelCategory,
  withoutStructuralEdges,
  ENTITY_TYPE_ORDER,
  HUB_ENTITY_NAMES,
} from "@/lib/graph/scope";
import { nodeSizeForDegree, type NetworkLink, type NetworkNode } from "@/lib/graph/network";
import { relationshipCategories, relationshipCategoryOf } from "@/lib/relationships";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { GraphView } from "./graph-view";
import type { PageContent } from "@/lib/pages-content";

export interface GraphPageParams {
  root?: string;
  depth?: string;
  type?: string;
  hubs?: string;
  rel?: string;
}

const MAX_DEPTH = 3;
// The canvas renderer stays smooth well past this; the cap is about
// legibility — beyond a few hundred nodes clusters stop reading as clusters.
const OVERVIEW_LIMIT = 500;

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"` —
// Next only reads that config from route segment files, not from an
// imported component like this one.
export async function GraphPage({
  content,
  params = {},
}: {
  content: PageContent;
  params?: GraphPageParams;
}) {
  const [allEntities, allEdges] = await Promise.all([listEntities(), listEdges()]);

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

  const rootEntity = params.root
    ? allEntities.find((e) => e.id === params.root)
    : undefined;

  // Overview: real ties only, unless the reader asked for specific
  // relationship categories (which may include "institutional").
  const overviewPool = relFilter.size
    ? filterByRelCategory({ entities: allEntities, edges: allEdges }, relFilter).edges
    : withoutStructuralEdges(allEdges);

  const base = rootEntity
    ? neighborhoodSubgraph(allEntities, allEdges, rootEntity.id, {
        depth,
        entityTypes: typeFilter,
        includeHubs,
      })
    : overviewSubgraph(allEntities, overviewPool, { entityTypes: typeFilter, limit: OVERVIEW_LIMIT });

  const scoped = filterByRelCategory(base, relFilter, rootEntity?.id);

  // Chip counts: what's in the focused neighbourhood, or — for the
  // overview — across the whole graph minus the four mega-hubs, so the
  // "institutional" chip is offered even though the default view hides it.
  const hubIds = new Set(allEntities.filter((e) => HUB_ENTITY_NAMES.has(e.name)).map((e) => e.id));
  const countEdges = rootEntity
    ? base.edges
    : allEdges.filter((e) => !hubIds.has(e.sourceEntityId) && !hubIds.has(e.targetEntityId));
  const relCategoryCounts: Record<string, number> = {};
  for (const e of countEdges) {
    const cat = relationshipCategoryOf(e.relType ?? "");
    if (cat) relCategoryCounts[cat] = (relCategoryCounts[cat] ?? 0) + 1;
  }

  const degree = new Map<string, number>();
  for (const e of scoped.edges) {
    degree.set(e.sourceEntityId, (degree.get(e.sourceEntityId) ?? 0) + 1);
    degree.set(e.targetEntityId, (degree.get(e.targetEntityId) ?? 0) + 1);
  }
  // Shrink every node as the view grows so a few hundred dots still have
  // whitespace between them.
  const density = Math.max(0.45, Math.min(1, Math.sqrt(200 / Math.max(1, scoped.entities.length))));
  const sizeOf = (id: string) =>
    id === rootEntity?.id ? 16 : nodeSizeForDegree(degree.get(id) ?? 0) * density;

  const links: NetworkLink[] = scoped.edges.map((e) => ({
    id: e.id,
    source: e.sourceEntityId,
    target: e.targetEntityId,
    relType: e.relType ?? "",
    label: e.label,
    role: e.role ?? "",
  }));
  const positions = rootEntity
    ? computeRadialLayout(rootEntity.id, scoped.entities, links)
    : computeClusterLayout(scoped.entities.map((e) => ({ id: e.id, size: sizeOf(e.id) })), links);
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
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
          <PageDescription content={content} />
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
      </div>

      {allEntities.length === 0 ? (
        <div className="mt-6">
          <EmptyStateFeatures
            content={content}
            message="This graph is empty. Every page draws from the same shared entities and relationships. Add some in"
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        </div>
      ) : (
        <div className="mt-6 h-[72vh] min-h-[520px]">
          <GraphView
            nodes={nodes}
            links={links}
            searchItems={allEntities.map((e) => ({ id: e.id, name: e.name, type: e.type }))}
            rootEntity={rootEntity ? { id: rootEntity.id, name: rootEntity.name } : null}
            depth={depth}
            includeHubs={includeHubs}
            typeFilter={typeFilter ? [...typeFilter] : []}
            relFilter={[...relFilter]}
            hidesStructural={!rootEntity && relFilter.size === 0}
            relCategoryCounts={relCategoryCounts}
            totalEntityCount={allEntities.length}
            searchPlaceholder={`Search ${content.title}…`}
          />
        </div>
      )}
    </div>
  );
}
