import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { NewsFeedView } from "./news-feed-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function NewsFeed({ content }: { content: PageContent }) {
  const [claims, sources, entities] = await Promise.all([
    listClaims(),
    listSources(),
    listEntities(),
  ]);
  const hasDatedSources = sources.some((s) => s.publishedAt);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />

      <div className="mt-6">
        {claims.length === 0 && !hasDatedSources ? (
          <EmptyStateFeatures
            content={content}
            message="No dated claims or sources yet — add statements or sources with a publish date in"
            cta={{ href: "/data", label: "Manage Data" }}
          />
        ) : (
          <NewsFeedView
            claims={claims}
            sources={sources}
            entities={entities}
            searchPlaceholder={`Search ${content.title}…`}
          />
        )}
      </div>
    </div>
  );
}
