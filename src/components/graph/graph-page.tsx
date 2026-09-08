import Link from "next/link";
import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { computeForceLayout } from "@/lib/graph/layout";
import {
  neighborhoodSubgraph,
  overviewSubgraph,
  filterByRelCategory,
  ENTITY_TYPE_ORDER,
} from "@/lib/graph/scope";
import { relationshipCategories, relationshipCategoryOf } from "@/lib/relationships";
import { entityColors } from "@/lib/entity-colors";
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

  const base = rootEntity
    ? neighborhoodSubgraph(allEntities, allEdges, rootEntity.id, {
        depth,
        entityTypes: typeFilter,
        includeHubs,
      })
    : overviewSubgraph(allEntities, allEdges, { entityTypes: typeFilter });

  const scoped = filterByRelCategory(base, relFilter, rootEntity?.id);

  // Which relationship categories are present in the (pre-rel-filter)
  // scope, for the filter chips.
  const relCategoryCounts: Record<string, number> = {};
  for (const e of base.edges) {
    const cat = relationshipCategoryOf(e.relType ?? "");
    if (cat) relCategoryCounts[cat] = (relCategoryCounts[cat] ?? 0) + 1;
  }

  const positions = computeForceLayout(scoped.entities, scoped.edges);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
          <PageDescription content={content} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex gap-3 text-sm">
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
          <div className="flex flex-wrap justify-end gap-3 text-xs">
            {Object.entries(entityColors).map(([type, c]) => (
              <span key={type} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2"
                  style={{ background: c.bg, borderColor: c.border }}
                />
                {type.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {allEntities.length === 0 ? (
        <div className="mt-6">
          <EmptyStateFeatures
            content={content}
            message="This graph is empty — every page draws from the same shared entities and relationships. Add some in"
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col">
          <GraphView
            entities={scoped.entities}
            edges={scoped.edges}
            positions={positions}
            allEntities={allEntities}
            rootEntity={rootEntity ?? null}
            depth={depth}
            includeHubs={includeHubs}
            typeFilter={typeFilter ? [...typeFilter] : []}
            relFilter={[...relFilter]}
            relCategoryCounts={relCategoryCounts}
            totalEntityCount={allEntities.length}
            searchPlaceholder={`Search ${content.title}…`}
          />
        </div>
      )}
    </div>
  );
}
