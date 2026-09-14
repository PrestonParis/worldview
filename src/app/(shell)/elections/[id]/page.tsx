import Link from "next/link";
import { notFound } from "next/navigation";
import { getElection } from "@/lib/db/elections";
import { listCandidaciesForElection } from "@/lib/db/candidacies";
import {
  listResultsForElection,
  areaBreakdowns,
} from "@/lib/db/electionResults";
import { getEntityContributionSummary } from "@/lib/db/contributions";
import { listEntities } from "@/lib/neo4j/entities";
import { summarizeCandidacies } from "@/lib/validation/candidacy";
import { partyColorFor } from "@/lib/party-colors";
import { formatAmount } from "@/lib/money";
import { ElectionStatusPill } from "@/components/elections/election-status";
import { DataSourceNote } from "@/components/elections/data-source-note";
import { ResultsSection } from "@/components/elections/results-section";
import type { CurrencyTotal } from "@/lib/money";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ElectionDetailPage({
  params,
}: PageProps<"/elections/[id]">) {
  const { id } = await params;
  const [election, candidacies, entities, resultRows] = await Promise.all([
    getElection(id),
    listCandidaciesForElection(id),
    listEntities(),
    listResultsForElection(id),
  ]);
  if (!election) notFound();

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const summary = summarizeCandidacies(candidacies);
  const breakdowns = areaBreakdowns(resultRows).sort(
    (a, b) => a.areaName.localeCompare(b.areaName),
  );

  // Fundraising is a free reuse of the `contributions` table; total raised
  // per candidate entity, shown inline. Only rendered when some candidate
  // has recorded contributions.
  const raisedByCandidacy = new Map(
    await Promise.all(
      candidacies.map(
        async (c): Promise<[string, CurrencyTotal[]]> => [
          c.id,
          (await getEntityContributionSummary(c.candidateEntityId)).raised,
        ],
      ),
    ),
  );
  const anyFundraising = [...raisedByCandidacy.values()].some((r) => r.length > 0);

  const ranked = [...candidacies].sort((a, b) => {
    if (a.votes == null && b.votes == null) return 0;
    if (a.votes == null) return 1;
    if (b.votes == null) return -1;
    return b.votes - a.votes;
  });
  const maxVotes = ranked.reduce((m, c) => Math.max(m, c.votes ?? 0), 0);
  // Prefer the reported turnout as the percentage denominator; minor
  // candidates below the import threshold aren't stored, so the sum of
  // candidacy votes understates the true total.
  const denom = election.totalVotes ?? summary.totalVotes;
  const marginPct =
    summary.margin != null && denom > 0 ? (summary.margin / denom) * 100 : null;

  return (
    <div className="max-w-3xl">
      <Link
        href="/elections"
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ← Elections
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {election.office} · {election.jurisdiction}
        </span>
        <ElectionStatusPill status={election.status} />
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{election.name}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {election.electionType.replace(/^./, (c) => c.toUpperCase())} election ·{" "}
        {formatDate(election.electionDate)}
        {election.totalVotes != null
          ? ` · ${election.totalVotes.toLocaleString()} ballots cast`
          : ""}
      </p>

      <h2 className="mt-8 text-lg font-medium">Candidates</h2>
      {ranked.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No candidates recorded for this election yet.
        </p>
      ) : (
        <>
          {summary.margin != null ? (
            <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
              Margin: {summary.margin.toLocaleString()} votes
              {marginPct != null ? ` (${marginPct.toFixed(1)} pts)` : ""}
            </p>
          ) : null}
          <ul className="mt-4 flex flex-col gap-3">
            {ranked.map((c) => {
              const candidate = entityById.get(c.candidateEntityId);
              const color = partyColorFor(c.party);
              const pct =
                denom > 0 && c.votes != null ? (c.votes / denom) * 100 : null;
              const barWidth =
                maxVotes > 0 && c.votes != null ? (c.votes / maxVotes) * 100 : 0;
              const raised = raisedByCandidacy.get(c.id) ?? [];
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color.border }}
                        aria-hidden
                      />
                      {candidate ? (
                        <Link
                          href={`/data/entities/${candidate.id}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {candidate.name}
                        </Link>
                      ) : (
                        <span className="font-medium">Unknown</span>
                      )}
                      {c.party ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {c.party}
                        </span>
                      ) : null}
                      {c.incumbent ? (
                        <span className="text-xs text-slate-400">(incumbent)</span>
                      ) : null}
                      {c.won ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Winner
                        </span>
                      ) : null}
                      {c.withdrew ? (
                        <span className="text-xs text-slate-400">withdrew</span>
                      ) : null}
                    </div>
                    <div className="text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {c.votes != null ? c.votes.toLocaleString() : "N/A"}
                      {pct != null ? (
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                          {pct.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {c.votes != null ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barWidth}%`, background: color.border }}
                      />
                    </div>
                  ) : null}
                  {raised.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Raised{" "}
                      {raised
                        .map((r) => formatAmount(r.total, r.currency))
                        .join(" · ")}{" "}
                      ·{" "}
                      <Link href="/money" className="underline underline-offset-2">
                        Money
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {anyFundraising ? (
            <p className="mt-2 text-xs text-slate-400">
              Fundraising totals are aggregated from recorded contributions to
              each candidate, not campaign-committee filings for this race
              specifically.
            </p>
          ) : null}
        </>
      )}

      <h2 className="mt-8 text-lg font-medium">Results by county</h2>
      {breakdowns.length > 0 ? (
        <ResultsSection breakdowns={breakdowns} />
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          County-level results aren&rsquo;t loaded for this election.
        </p>
      )}

      {election.notes ? (
        <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">{election.notes}</p>
      ) : null}

      <DataSourceNote className="mt-8" />
    </div>
  );
}
