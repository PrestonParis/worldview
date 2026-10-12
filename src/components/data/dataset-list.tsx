import Link from "next/link";
import type { Dataset, DatasetCoverage } from "@/lib/db/stats";
import { formatPeriod } from "@/lib/format";

export type DatasetWithCoverage = Dataset & { coverage: DatasetCoverage | null };

export function coverageLabel(c: DatasetCoverage | null): string {
  if (!c || !c.rows) return "Awaiting first import";
  const span = c.firstPeriod === c.lastPeriod ? formatPeriod(c.lastPeriod ?? "") : `${formatPeriod(c.firstPeriod ?? "")} – ${formatPeriod(c.lastPeriod ?? "")}`;
  const count = `${c.rows.toLocaleString("en-US")} ${c.kind}`;
  return span ? `${span} · ${count}` : count;
}

const refreshed = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;

// Cards for a set of catalog datasets: title, publisher, cadence, coverage.
// `uses` adds what the page uses each dataset for, keyed by slug.
export function DatasetList({ datasets, uses }: { datasets: DatasetWithCoverage[]; uses?: Record<string, string> }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {datasets.map((d) => (
        <li key={d.slug}>
          <Link
            href={`/datasets/${d.slug}`}
            className="flex h-full flex-col rounded-2xl border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
          >
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{d.partner ? "Partner dataset" : d.topic}</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{d.title}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{d.publisher}</p>
            {uses?.[d.slug] && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-800 dark:text-slate-100">Used here for:</span> {uses[d.slug]}
              </p>
            )}
            <p className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">
              {d.cadence && <span>{d.cadence} · </span>}
              {coverageLabel(d.coverage)}
            </p>
            {uses && refreshed(d.coverage?.lastUpdated ?? null) && (
              <p className="mt-0.5 text-xs text-slate-400">Last refreshed {refreshed(d.coverage!.lastUpdated)}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
