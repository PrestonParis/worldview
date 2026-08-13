import { listSources } from "@/lib/db/sources";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { SourceLibraryView } from "./source-library-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function SourceLibrary({ content }: { content: PageContent }) {
  const sources = await listSources();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />

      <div className="mt-6">
        {sources.length === 0 ? (
          <EmptyStateFeatures
            content={content}
            message="No sources yet — add clips, transcripts, and articles in"
            cta={{ href: "/data/sources", label: "Manage Data" }}
          />
        ) : (
          <SourceLibraryView sources={sources} searchPlaceholder={`Search ${content.title}…`} />
        )}
      </div>
    </div>
  );
}
