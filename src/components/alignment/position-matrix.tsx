import { listClaims } from "@/lib/db/claims";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PositionMatrixView } from "./position-matrix-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function PositionMatrix({ content }: { content: PageContent }) {
  const [claims, entities] = await Promise.all([listClaims(), listEntities()]);
  const hasTopics = claims.some((c) => c.topic);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>

      <div className="mt-6">
        {!hasTopics ? (
          <EmptyStateFeatures
            content={content}
            message="This matrix is built from claims with a topic set — add some claims and topics in"
            cta={{ href: "/data/claims", label: "Manage Data" }}
          />
        ) : (
          <PositionMatrixView
            claims={claims}
            entities={entities}
            searchPlaceholder={`Search ${content.title}…`}
          />
        )}
      </div>
    </div>
  );
}
