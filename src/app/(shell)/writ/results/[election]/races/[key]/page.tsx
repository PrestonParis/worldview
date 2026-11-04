import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { DetailBody } from "@/components/tools/writ/close-races-client";
import { Fact, Flags, fmt, Party } from "@/components/tools/writ/close-races-view";
import { RaceMap } from "@/components/tools/writ/results-map";
import { ResultsTabs } from "@/components/tools/writ/results-tabs";
import { Surface } from "@/components/ui/surface";
import { loadRace } from "@/lib/db/closeRaces";
import { LEVEL_LABELS, STATUS_LABELS } from "@/lib/elections/close-races/filters";
import { writDocketHref } from "@/lib/tools/writ";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ election: string; key: string }> };

const decode = async (params: Props["params"]) => {
  const { election, key } = await params;
  return { id: decodeURIComponent(election), key: decodeURIComponent(key) };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, key } = await decode(params);
  const race = await loadRace(id, key);
  return { title: race ? `${race.row.name}: ${race.election.name} | Writ | Worldview` : "Race | Writ | Worldview" };
}

export default async function RacePage({ params }: Props) {
  const { id, key } = await decode(params);
  const race = await loadRace(id, key);
  if (!race) notFound();
  const { row, election, detail, otherRound } = race;
  const results = `/writ/results/${encodeURIComponent(id)}`;
  const place = row.county ?? (row.counties.length > 1 ? `${row.counties.length} counties` : null);
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Results", href: results }, { label: row.name }]} />
      <div className="space-y-6">
        <ResultsTabs election={id} active={null} />
        <Surface className="p-5 sm:p-6">
          <p className="text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">
            {LEVEL_LABELS[row.level]}
            {place ? ` · ${place}` : ""}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">{row.name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{election.name}</p>
          <p className="mt-4 text-lg text-slate-950 dark:text-white">
            <span className="font-bold">{row.outcome.label}</span>
            {row.outcome.kind === "advancing_to_runoff" ? (
              <>: {row.outcome.advancing.join(" and ")}</>
            ) : row.leaderName && ["elected", "unopposed"].includes(row.outcome.kind) && row.voteFor === 1 ? (
              <>
                : {row.leaderName}
                <Party party={row.leaderParty} />
              </>
            ) : null}
          </p>
          <div className="mt-2">
            <Flags row={row} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Fact label="Margin" value={row.marginVotes == null ? "—" : `${fmt(row.marginVotes)} votes`} note={row.marginPct != null ? `${row.marginPct.toFixed(2)} pts` : undefined} />
            <Fact label="Total votes" value={fmt(row.totalVotes)} />
            <Fact label="Count" value={STATUS_LABELS[row.resultStatus]} note={`${fmt(row.reportingUnits)} of ${fmt(row.totalUnits)} units reporting`} />
            {row.seat?.priorParty ? (
              <Fact label="Seat held by" value={`${row.seat.priorName ?? ""} (${row.seat.priorParty})`} note={row.seat.change === "gained" ? `Flip to ${row.leaderParty}` : row.seat.change === "held" ? "Party holds" : undefined} />
            ) : null}
          </dl>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-rose-600 dark:text-rose-400">
            {otherRound ? (
              <Link href={`/writ/results/${encodeURIComponent(otherRound.sourceElectionId)}/races/${encodeURIComponent(otherRound.key)}`} className="hover:underline">
                {election.kind === "runoff" ? "The general election" : "The runoff"}
              </Link>
            ) : null}
            {row.electionId ? (
              <Link href={writDocketHref("race", row.electionId)} className="hover:underline">
                Race docket
              </Link>
            ) : null}
          </div>
        </Surface>
        {detail.areas.length > 1 ? (
          <Surface className="p-4 sm:p-5">
            <RaceMap detail={detail} />
          </Surface>
        ) : null}
        <Surface className="space-y-4 p-4 text-xs text-slate-700 sm:p-5 dark:text-slate-300">
          <DetailBody detail={detail} />
        </Surface>
      </div>
    </>
  );
}
