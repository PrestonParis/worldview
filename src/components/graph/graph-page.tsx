import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { computeForceLayout } from "@/lib/graph/layout";
import { entityColors } from "@/lib/entity-colors";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { GraphView } from "./graph-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"` —
// Next only reads that config from route segment files, not from an
// imported component like this one.
export async function GraphPage({ content }: { content: PageContent }) {
  const [entities, edges] = await Promise.all([listEntities(), listEdges()]);
  const positions = computeForceLayout(entities, edges);

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
            message="This graph is empty — every page draws from the same shared entities and relationships. Add some in"
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        </div>
      ) : (
        <div className="mt-6 h-[75vh] min-h-[480px]">
          <GraphView
            entities={entities}
            edges={edges}
            positions={positions}
            searchPlaceholder={`Search ${content.title}…`}
          />
        </div>
      )}
    </div>
  );
}
