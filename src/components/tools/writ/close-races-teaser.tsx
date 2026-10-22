import Link from "next/link";
import { ArrowRight, ListOrdered } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { defaultElection, listTrackedElections, loadCloseRaces } from "@/lib/db/closeRaces";

// Writ home: the five closest contests in the default tracked election (latest general, else latest full slate).
export async function CloseRacesTeaser() {
  const latest = defaultElection(await listTrackedElections());
  if (!latest) return null;
  const data = await loadCloseRaces(latest.id, { sort: "votes" });
  if (!data) return null;
  const top = data.report.ranked.slice(0, 5);
  return (
    <Surface className="mt-7 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">
            <ListOrdered aria-hidden className="h-4 w-4" />
            Close races · Georgia
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{latest.name}</h2>
          <p className="text-sm text-slate-500">
            {data.totalContests.toLocaleString("en-US")} contests, federal to school board, ranked by vote margin.
          </p>
        </div>
        <Link href={`/writ/close-races/${encodeURIComponent(latest.id)}`} className="flex items-center gap-1.5 text-sm font-bold text-rose-600 dark:text-rose-400">
          Open the full report
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <ol className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {top.map((row) => (
          <li key={row.id} className="flex items-baseline gap-3 py-2">
            <span className="w-5 shrink-0 font-bold text-slate-400 tabular-nums">{row.rank}</span>
            <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-white">
              {row.name}
              {row.county ? <span className="text-slate-500"> · {row.county}</span> : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{row.marginVotes === 0 ? "Tie" : `${row.marginVotes?.toLocaleString("en-US")} ${row.marginVotes === 1 ? "vote" : "votes"}`}</span>
          </li>
        ))}
      </ol>
    </Surface>
  );
}
