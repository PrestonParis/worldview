import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { computeHierarchicalLayout } from "@/lib/graph/layout";
import { isDonorEdge } from "@/lib/graph/money";
import { entityColors } from "@/lib/entity-colors";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { MoneyGraphView } from "./money-graph-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"` —
// Next only reads that config from route segment files, not from an
// imported component like this one.
export async function MoneyGraphPage({ content }: { content: PageContent }) {
  const [allEntities, allEdges] = await Promise.all([listEntities(), listEdges()]);

  // The money graph only shows donor/funding relationships — the shared
  // entity graph carries every relationship type, so it's filtered down
  // here rather than at the query layer.
  const donorEdges = allEdges.filter((e) => isDonorEdge(e.label));
  const connectedIds = new Set(donorEdges.flatMap((e) => [e.sourceEntityId, e.targetEntityId]));
  const entities = allEntities.filter((e) => connectedIds.has(e.id));
  const positions = computeHierarchicalLayout(entities, donorEdges);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
          <PageDescription content={content} />
        </div>
        <div className="flex shrink-0 gap-3 text-xs">
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

      {entities.length === 0 ? (
        <div className="mt-6">
          <EmptyStateFeatures
            content={content}
            message="This graph tracks donation and funding relationships specifically — add a relationship labeled “donated to” (or similar) between two entities in"
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        </div>
      ) : (
        <div className="mt-6 h-[75vh] min-h-[480px]">
          <MoneyGraphView
            entities={entities}
            edges={donorEdges}
            positions={positions}
            searchPlaceholder={`Search ${content.title}…`}
          />
        </div>
      )}
    </div>
  );
}
