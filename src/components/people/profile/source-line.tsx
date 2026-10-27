import { ExternalLink } from "lucide-react";
import { formatPartialDate, primaryKinds, sourceKindLabels, type SourceRecord } from "@/lib/people/profile-model";

export function SourceKindBadge({ source }: { source: SourceRecord }) {
  const primary = primaryKinds.has(source.kind);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        primary
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
      title={sourceKindLabels[source.kind]}
    >
      {primary ? "Primary" : "Secondary"}
    </span>
  );
}

// One source, readable: title (linked when there is a URL), then who
// published it and when, and whether it only repeats another outlet.
export function SourceLine({
  source,
  repeats,
  compact = false,
}: {
  source: SourceRecord;
  repeats?: SourceRecord | null;
  compact?: boolean;
}) {
  const meta = [
    source.author && source.author !== source.publisher ? source.author : "",
    source.publisher,
    source.publishedAt ? formatPartialDate(source.publishedAt) : "",
  ].filter(Boolean);
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex min-w-0 items-start gap-1 font-medium text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300"
          >
            <span className="underline decoration-slate-300 underline-offset-2 group-hover:decoration-indigo-400 dark:decoration-slate-600">
              {source.title}
            </span>
            <ExternalLink aria-hidden className="mt-1 h-3 w-3 shrink-0 opacity-60" />
          </a>
        ) : (
          <span className="font-medium text-slate-900 dark:text-slate-100">{source.title}</span>
        )}
        {!compact ? <SourceKindBadge source={source} /> : null}
      </div>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {meta.join(" · ")}
        {!source.url && source.documentId ? <> · {source.documentId}</> : null}
      </p>
      {repeats ? (
        <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
          Repeats {repeats.publisher}&rsquo;s reporting; not independent confirmation.
        </p>
      ) : null}
      {!compact && source.notes ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{source.notes}</p> : null}
    </div>
  );
}
