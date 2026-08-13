import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { ClaimListView } from "./claim-list-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function ClaimList({
  content,
  mode,
}: {
  content: PageContent;
  mode: "timeline" | "workbench";
}) {
  const [claims, entities, sources] = await Promise.all([
    listClaims(),
    listEntities(),
    listSources(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />

      <div className="mt-6">
        {claims.length === 0 ? (
          <EmptyStateFeatures
            content={content}
            message="No claims recorded yet — add statements with a speaker, date, and quote in"
            cta={{ href: "/data/claims", label: "Manage Data" }}
          />
        ) : (
          <ClaimListView
            claims={claims}
            entities={entities}
            sources={sources}
            mode={mode}
            searchPlaceholder={`Search ${content.title}…`}
          />
        )}
      </div>
    </div>
  );
}
