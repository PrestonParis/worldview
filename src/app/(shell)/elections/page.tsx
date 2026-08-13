import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { pagesContent } from "@/lib/pages-content";

export default function Page() {
  const content = pagesContent["elections"];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />
      <div className="mt-6">
        <EmptyStateFeatures
          content={content}
          message="Election tools are separate from the People & Power entity directory."
        />
      </div>
    </div>
  );
}
