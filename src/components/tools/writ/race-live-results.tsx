import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { loadLiveResultsForElection } from "@/lib/db/closeRaces";
import { FLAG_LABELS, STATUS_LABELS } from "@/lib/elections/close-races/filters";
import type { ContestFlag } from "@/lib/elections/close-races/types";

// A race docket's live count, when the close-races tracker follows its
// contest in the state's results feed.
export async function RaceLiveResults({ electionId }: { electionId: string }) {
  const live = await loadLiveResultsForElection(electionId);
  if (!live) return null;
  const total = live.options.reduce((s, o) => s + o.votes, 0);
  return (
    <Surface className="mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">Results · Georgia Secretary of State</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{live.name}</h2>
          <p className="text-xs text-slate-500">
            {STATUS_LABELS[live.status]} · {live.reportingUnits}/{live.totalUnits} reporting units
            {live.marginVotes != null ? ` · margin ${live.marginVotes.toLocaleString("en-US")} votes (${live.marginPct?.toFixed(2)} pts)` : ""}
            {live.flags.length ? ` · ${live.flags.map((f) => FLAG_LABELS[f as ContestFlag] ?? f).join(", ")}` : ""}
          </p>
        </div>
        <Link href={`/writ/close-races/${encodeURIComponent(live.sourceElectionId)}`} className="text-sm font-bold text-rose-600 dark:text-rose-400">
          All close races →
        </Link>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {live.options.map((o) => (
          <li key={o.name} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {o.name}
              {o.party ? <span className="text-slate-500"> ({o.party})</span> : null}
              {o.incumbent ? <span className="text-slate-500"> · inc.</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              {o.votes.toLocaleString("en-US")}
              <span className="ml-2 text-slate-500">{total ? ((o.votes / total) * 100).toFixed(1) : "0.0"}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
