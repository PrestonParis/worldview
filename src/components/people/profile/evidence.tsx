import { FileText } from "lucide-react";
import { SourceLine } from "./source-line";
import type { SourceRecord } from "@/lib/people/profile-model";

// "Why we say this": the sources behind one record, folded under a count so
// the record reads first. Plain <details>, so it needs no client script.
export function Evidence({
  sources,
  sourcesByKey,
  label = "source",
}: {
  sources: SourceRecord[];
  sourcesByKey?: Map<string, SourceRecord>;
  label?: string;
}) {
  if (!sources.length) return null;
  return (
    <details className="wv-expand group mt-2 text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full text-slate-500 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-300">
        <FileText aria-hidden className="h-3.5 w-3.5" />
        {sources.length} {label}
        {sources.length === 1 ? "" : "s"}
        <span aria-hidden className="transition group-open:rotate-90">›</span>
      </summary>
      <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        {sources.map((source) => (
          <li key={source.id}>
            <SourceLine
              source={source}
              repeats={source.repeatsKey ? (sourcesByKey?.get(source.repeatsKey) ?? null) : null}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
