import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { Fact, fmt, Party } from "@/components/tools/writ/close-races-view";
import { ResultsTabs } from "@/components/tools/writ/results-tabs";
import { Surface } from "@/components/ui/surface";
import { loadCounty, type CountyData } from "@/lib/db/closeRaces";
import { LEVEL_LABELS } from "@/lib/elections/close-races/filters";
import type { ReportRow } from "@/lib/elections/close-races/rows";
import { CONTEST_LEVELS } from "@/lib/elections/close-races/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ election: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { election, slug } = await params;
  const data = await loadCounty(decodeURIComponent(election), decodeURIComponent(slug));
  return { title: data ? `${data.county} results | Writ | Worldview` : "County results | Writ | Worldview" };
}

// A contest crossing county lines shows this county's own votes, so its outcome
// has to name who won overall: a county's leader can be the contest's loser.
function contestWide(row: ReportRow, showingCountyVotes: boolean) {
  if (!showingCountyVotes) return row.outcome.label;
  if (row.outcome.kind === "elected" && row.voteFor === 1 && row.leaderName) return `${row.outcome.label}: ${row.leaderName}`;
  if (row.outcome.kind === "passed" || row.outcome.kind === "failed") return `${row.outcome.label} overall`;
  return row.outcome.label;
}

function BallotRow({ row, votes, election }: { row: ReportRow; votes: CountyData["votes"][string] | undefined; election: string }) {
  const local = votes?.slice(0, 2);
  const shown = local?.length ? local : [row.leaderName ? { name: row.leaderName, party: row.leaderParty, votes: row.leaderVotes ?? 0 } : null, row.runnerUpName ? { name: row.runnerUpName, party: row.runnerUpParty, votes: row.runnerUpVotes ?? 0 } : null].filter((x) => x != null);
  return (
    <li className="grid gap-x-4 gap-y-1 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-baseline">
      <Link href={`/writ/results/${encodeURIComponent(election)}/races/${encodeURIComponent(row.key)}`} className="min-w-0 font-medium text-slate-950 hover:text-rose-600 dark:text-white">
        {row.name}
      </Link>
      <span className="min-w-0 text-xs text-slate-600 dark:text-slate-400">
        {shown.map((o, i) => (
          <span key={o.name}>
            {i ? ", " : ""}
            {o.name}
            <Party party={o.party} /> <span className="tabular-nums">{fmt(o.votes)}</span>
          </span>
        ))}
        {local?.length ? <span className="text-slate-500"> in this county</span> : null}
      </span>
      <span className="text-xs text-slate-500">{contestWide(row, Boolean(local?.length))}</span>
    </li>
  );
}

export default async function CountyPage({ params }: Props) {
  const { election, slug } = await params;
  const id = decodeURIComponent(election);
  const data = await loadCounty(id, decodeURIComponent(slug));
  if (!data) notFound();
  const results = `/writ/results/${encodeURIComponent(id)}`;
  const s = data.status;
  const units = s ? s.unitsFully + s.unitsNight + s.unitsPartial + s.unitsNotReported : 0;
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Results", href: results }, { label: "Counties", href: `${results}/counties` }, { label: data.county }]} />
      <div className="space-y-6">
        <ResultsTabs election={id} active="counties" />
        <Surface className="p-5 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">{data.county}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.election.name}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Fact label="Ballots cast" value={fmt(s?.ballotsCast)} />
            <Fact label="Turnout" value={s?.registered && s.ballotsCast != null ? `${((s.ballotsCast / s.registered) * 100).toFixed(1)}%` : "—"} note={s?.registered ? `${fmt(s.registered)} registered` : undefined} />
            <Fact label="Precincts fully reported" value={units ? `${fmt(s?.unitsFully)} of ${fmt(units)}` : "—"} />
            <Fact label="Certified" value={s?.isOfficial ? "Yes" : "Not yet"} />
          </dl>
        </Surface>
        {CONTEST_LEVELS.map((level) => {
          const rows = data.rows.filter((r) => r.level === level).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
          if (!rows.length) return null;
          return (
            <section key={level} aria-label={LEVEL_LABELS[level]}>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">{LEVEL_LABELS[level]}</h2>
              <Surface className="px-4 py-1 sm:px-5">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <BallotRow key={row.id} row={row} votes={data.votes[row.id]} election={id} />
                  ))}
                </ul>
              </Surface>
            </section>
          );
        })}
      </div>
    </>
  );
}
