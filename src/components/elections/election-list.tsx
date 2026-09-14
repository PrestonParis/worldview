import { listElections } from "@/lib/db/elections";
import { listElectionSummariesByElection } from "@/lib/db/candidacies";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { ElectionListView } from "./election-list-view";
import { DataSourceNote } from "./data-source-note";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function ElectionList({ content }: { content: PageContent }) {
  const [elections, summaryMap, entities] = await Promise.all([
    listElections(),
    listElectionSummariesByElection(),
    listEntities(),
  ]);
  // Plain object across the server/client boundary — same convention as the
  // rest of this app's list pages (Maps rebuilt client-side).
  const summaries = Object.fromEntries(summaryMap);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />

      <div className="mt-6">
        {elections.length === 0 ? (
          <EmptyStateFeatures
            content={content}
            message="No elections recorded yet. Add a race by hand, or import returns, in"
            cta={{ href: "/data/elections", label: "Manage Data" }}
          />
        ) : (
          <>
            <ElectionListView
              elections={elections}
              summaries={summaries}
              entities={entities}
              searchPlaceholder={`Search ${content.title}…`}
            />
            <DataSourceNote className="mt-6" />
          </>
        )}
      </div>
    </div>
  );
}
