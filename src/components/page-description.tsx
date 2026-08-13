import { ChevronDown } from "lucide-react";
import type { PageContent } from "@/lib/pages-content";

// A native <details>/<summary> disclosure — no client JS needed — so every
// major page can always surface its roadmap ideas from sampletools.md, not
// just when the section happens to be empty (that's EmptyStateFeatures).
export function PageDescription({ content }: { content: PageContent }) {
  return (
    <details className="group mt-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        What&rsquo;s planned for this page
      </summary>
      <ul className="mt-3 flex max-w-2xl flex-col gap-2">
        {content.features.map((feature) => (
          <li
            key={feature}
            className="rounded-md border border-slate-200 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300"
          >
            {feature}
          </li>
        ))}
      </ul>
    </details>
  );
}
