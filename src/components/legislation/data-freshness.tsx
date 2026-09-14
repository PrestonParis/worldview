import { latestSyncRuns, type SyncRun } from "@/lib/db/syncRuns";

const LABELS: Record<string, string> = {
  "congress-bills": "Bills",
  "congress-votes": "Roll-call votes",
};

const STALE_AFTER_MS = 10 * 24 * 60 * 60 * 1000;

// Module-scope helpers so the reads of the clock stay out of the component
// body (react-hooks/purity).
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return "just now";
}

function describe(source: string, run: SyncRun): { text: string; tone: string } {
  const stamp = run.finishedAt ?? run.startedAt;
  const failed = run.status === "error";
  const stale = Date.now() - new Date(stamp).getTime() > STALE_AFTER_MS;
  const tone = failed
    ? "text-red-600 dark:text-red-400"
    : stale
      ? "text-amber-600 dark:text-amber-400"
      : "";
  return {
    tone,
    text: `${LABELS[source] ?? source} synced ${ago(stamp)}${failed ? " (last run failed)" : ""}`,
  };
}

// Renders "Bills synced 3 days ago · Roll-call votes synced 3 days ago",
// amber past the staleness threshold, red when the last run errored.
// Nothing at all until a sync has run. Async server component.
export async function DataFreshness({
  sources,
  className = "",
}: {
  sources: string[];
  className?: string;
}) {
  const runs = await latestSyncRuns(sources);
  const parts = sources
    .filter((s) => runs.has(s))
    .map((s) => ({ source: s, ...describe(s, runs.get(s)!) }));
  if (parts.length === 0) return null;

  return (
    <p className={`text-xs text-slate-400 dark:text-slate-500 ${className}`}>
      {parts.map((part, i) => (
        <span key={part.source}>
          {i > 0 ? " · " : ""}
          <span className={part.tone}>{part.text}</span>
        </span>
      ))}
    </p>
  );
}
