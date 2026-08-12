import { listEntities } from "@/lib/neo4j/entities";
import { listEdges } from "@/lib/neo4j/edges";
import { EmptyStateFeatures } from "@/components/empty-state";
import { EntityTypeSection } from "./entity-type-section";
import type { PageContent } from "@/lib/pages-content";
import type { EntityType } from "@/lib/validation/entity";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function EntitySectionsPage({
  content,
  sections,
  emptyMessage,
}: {
  content: PageContent;
  sections: { type: EntityType; heading: string }[];
  emptyMessage: string;
}) {
  const [allEntities, allEdges] = await Promise.all([listEntities(), listEdges()]);
  const allEntitiesById = new Map(allEntities.map((e) => [e.id, e]));
  const totalCount = sections.reduce(
    (sum, s) => sum + allEntities.filter((e) => e.type === s.type).length,
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>

      <div className="mt-6">
        {totalCount === 0 ? (
          <EmptyStateFeatures
            content={content}
            message={emptyMessage}
            cta={{ href: "/data/entities", label: "Manage Data" }}
          />
        ) : (
          sections.map((section) => (
            <EntityTypeSection
              key={section.type}
              heading={section.heading}
              entities={allEntities.filter((e) => e.type === section.type)}
              allEntitiesById={allEntitiesById}
              edges={allEdges}
              searchPlaceholder={`Search ${section.heading}…`}
            />
          ))
        )}
      </div>
    </div>
  );
}
