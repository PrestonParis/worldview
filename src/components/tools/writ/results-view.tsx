import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import type { CountyStatusSummary, ResultsData } from "@/lib/db/closeRaces";
import { FLAG_LABELS, LEVEL_LABELS } from "@/lib/elections/close-races/filters";
import type { ReportRow } from "@/lib/elections/close-races/rows";
import type { ChamberSummary } from "@/lib/elections/close-races/seats";
import { partyColorFor } from "@/lib/party-colors";
import { AutoRefresh, ElectionPicker } from "./close-races-client";
import { Fact, fmt, Party, PARTY_NAMES, Section, et } from "./close-races-view";
import { StatewideMap } from "./results-map";
import { ResultsTabs } from "./results-tabs";

// The results hub's Overview: what the election decided, what is still open,
// and what changed.

const raceHref = (row: Pick<ReportRow, "sourceElectionId" | "key">) => `/writ/results/${encodeURIComponent(row.sourceElectionId)}/races/${encodeURIComponent(row.key)}`;

const margin = (row: ReportRow) => {
  if (row.marginVotes == null || row.outcome.kind === "no_votes") return "—";
  const votes = row.marginVotes === 0 ? "Tie" : `${fmt(row.marginVotes)} ${row.marginVotes === 1 ? "vote" : "votes"}`;
  return row.marginPct == null ? votes : `${votes} · ${row.marginPct.toFixed(2)} pts`;
};

const place = (row: ReportRow) => row.county ?? (row.counties.length > 1 ? `${row.counties.length} counties` : null);

const short = (name: string) => name.replace("State House of Representatives - District ", "House ").replace("State Senate - District ", "Senate ").replace("US House of Representatives - District ", "U.S. House ");

export function countyLine(c: CountyStatusSummary) {
  return [c.ballotsCast != null ? `${fmt(c.ballotsCast)} ballots cast` : null, c.registered ? `${((c.ballotsCast ?? 0) / c.registered * 100).toFixed(1)}% of ${fmt(c.registered)} registered` : null].filter(Boolean).join(" · ");
}

export function ResultsView({ data }: { data: ResultsData }) {
  const { election, summary, counties } = data;
  const base = "/writ/results";
  const open = summary.runoffs.length + summary.recountRange.length + summary.tied.length + summary.ruleUnverified.length + summary.noVotes.length;
  const certified = counties.rows.filter((c) => c.isOfficial).length;
  const owing = counties.rows.filter((c) => c.groupsUnreported.includes("Provisional")).length;

  return (
    <div className="space-y-6">
      {election.isOfficial ? null : <AutoRefresh />}
      <ResultsTabs election={election.id} active="overview" />
      <Surface className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">
              <BarChart3 aria-hidden className="h-4 w-4" />
              Results · Georgia
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">{election.name}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{fmt(data.totalContests)} contests from the Georgia Secretary of State&apos;s results system.</p>
          </div>
          <div className="w-full lg:w-96">
            <ElectionPicker current={election.id} elections={data.elections.map((e) => ({ id: e.id, label: `${e.date} · ${e.name}` }))} query="" base={base} />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Fact
            label="Turnout"
            value={counties.registered && counties.ballotsCast != null ? `${((counties.ballotsCast / counties.registered) * 100).toFixed(1)}%` : "—"}
            note={counties.ballotsCast != null ? `${fmt(counties.ballotsCast)} of ${fmt(counties.registered)} registered` : undefined}
          />
          <Fact
            label="Precincts fully reported"
            value={counties.unitsTotal ? `${fmt(counties.unitsFully)} of ${fmt(counties.unitsTotal)}` : "—"}
            note={[counties.unitsNight ? `${fmt(counties.unitsNight)} complete on election night, later ballots can still post` : null, owing ? `${owing} ${owing === 1 ? "county hasn't" : "counties haven't"} reported provisionals` : null].filter(Boolean).join(". ") || undefined}
          />
          <Fact label="Counties certified" value={counties.rows.length ? `${certified} of ${counties.rows.length}` : "—"} note={election.isOfficial ? "State certified" : undefined} href={`${base}/${encodeURIComponent(election.id)}/counties`} />
          <Fact label="Source updated" value={et(election.sourceUpdatedAt)} note={`Worldview ${et(election.lastWriteAt)}`} />
        </dl>
      </Surface>

      <ResultsTimeline
        steps={data.calendar}
        today={data.today}
        signals={{ counties_certified: counties.rows.length > 0 && certified === counties.rows.length, state_certified: election.isOfficial }}
      />

      {summary.chambers.length ? (
        <section aria-labelledby="chambers" className="space-y-3">
          <h2 id="chambers" className="text-lg font-bold text-slate-950 dark:text-white">
            Seats
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {summary.chambers.map((c) => (
              <ChamberCard key={c.id} chamber={c} />
            ))}
          </div>
        </section>
      ) : null}

      {summary.statewide.length || summary.statewideQuestions.length ? (
        <section aria-labelledby="statewide" className="space-y-3">
          <h2 id="statewide" className="text-lg font-bold text-slate-950 dark:text-white">
            Statewide
          </h2>
          <Surface className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {summary.statewide.map((row) => (
              <TwoWayRow key={row.id} row={row} />
            ))}
            {summary.statewideQuestions.map((row) => (
              <TwoWayRow key={row.id} row={row} />
            ))}
          </Surface>
          {data.mapContests.length ? (
            <Surface className="p-4 sm:p-5">
              <StatewideMap contests={data.mapContests} />
            </Surface>
          ) : null}
        </section>
      ) : null}

      {open ? (
        <section aria-labelledby="open" className="space-y-3">
          <h2 id="open" className="text-lg font-bold text-slate-950 dark:text-white">
            Still open
          </h2>
          {summary.runoffs.length ? (
            <OpenGroup title={`${summary.runoffs.length} heading to a runoff`} detail={data.runoffDate ? `Runoff ${data.runoffDate}` : null}>
              {summary.runoffs.map(({ row, pair }) => (
                <OpenRow key={row.id} row={row}>
                  <span className="text-slate-700 dark:text-slate-300">
                    {row.outcome.advancing.join(" vs ")}
                    {row.outcome.secondSlotTied ? " vs tied for second" : ""}
                  </span>
                  {data.moves[row.id] ? <span className="ml-2 text-slate-500 tabular-nums">{data.moves[row.id] > 0 ? "+" : ""}{fmt(data.moves[row.id])} since election night</span> : null}
                  {pair ? (
                    <Link href={raceHref(pair)} className="ml-2 font-semibold whitespace-nowrap text-rose-600 hover:underline dark:text-rose-400">
                      {pair.leaderName ? `Runoff: ${pair.outcome.label}, ${pair.leaderName}` : "Runoff"}
                    </Link>
                  ) : null}
                </OpenRow>
              ))}
            </OpenGroup>
          ) : null}
          {summary.recountRange.length ? (
            <OpenGroup title={`${summary.recountRange.length} ${FLAG_LABELS.recount_request_range.toLowerCase()}`}>
              {summary.recountRange.map((row) => (
                <OpenRow key={row.id} row={row}>
                  <span className="text-slate-700 dark:text-slate-300">
                    {row.leaderName} leads {row.runnerUpName}
                  </span>
                  {data.moves[row.id] ? <span className="ml-2 text-slate-500 tabular-nums">{data.moves[row.id] > 0 ? "+" : ""}{fmt(data.moves[row.id])} since election night</span> : null}
                </OpenRow>
              ))}
            </OpenGroup>
          ) : null}
          {summary.tied.length ? (
            <OpenGroup title={`${summary.tied.length} tied`}>
              {summary.tied.map((row) => (
                <OpenRow key={row.id} row={row}>
                  <span className="text-slate-700 dark:text-slate-300">
                    {row.leaderName} and {row.runnerUpName}
                  </span>
                </OpenRow>
              ))}
            </OpenGroup>
          ) : null}
          {summary.ruleUnverified.length ? (
            <OpenGroup title={`${summary.ruleUnverified.length} below 50%, city runoff rule unverified`}>
              {summary.ruleUnverified.map((row) => (
                <OpenRow key={row.id} row={row}>
                  <span className="text-slate-700 dark:text-slate-300">
                    {row.leaderName} {row.leaderShare != null ? `${(row.leaderShare * 100).toFixed(1)}%` : ""}
                  </span>
                </OpenRow>
              ))}
            </OpenGroup>
          ) : null}
          {summary.noVotes.length ? (
            <OpenGroup title={`${summary.noVotes.length} with no votes posted`}>
              {summary.noVotes.map((row) => (
                <OpenRow key={row.id} row={row} />
              ))}
            </OpenGroup>
          ) : null}
        </section>
      ) : null}

      {summary.flips.length || summary.defeatedIncumbents.length ? (
        <section aria-labelledby="changed" className="space-y-3">
          <h2 id="changed" className="text-lg font-bold text-slate-950 dark:text-white">
            What changed
          </h2>
          {summary.flips.length ? (
            <Section title={`${summary.flips.length} seats changed party`} open>
              <FlipList rows={summary.flips} />
            </Section>
          ) : null}
          {summary.defeatedIncumbents.length ? (
            <Section title={`${summary.defeatedIncumbents.length} incumbents trailing, every level`}>
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {summary.defeatedIncumbents.map((row) => (
                  <li key={row.id} className="min-w-0 truncate">
                    <Link href={raceHref(row)} className="hover:text-rose-600">
                      {row.trailingIncumbent?.name}
                    </Link>
                    <span className="text-slate-500"> · {short(row.name)}{row.county ? `, ${row.county}` : ""}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </section>
      ) : null}

      {summary.usHouse.length ? (
        <Section title="U.S. House, all 14 districts">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {summary.usHouse.map((row) => (
              <TwoWayRow key={row.id} row={row} />
            ))}
          </div>
        </Section>
      ) : null}

      <section aria-labelledby="levels" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="levels" className="text-lg font-bold text-slate-950 dark:text-white">
            Every contest
          </h2>
          <Link href={`/writ/close-races/${encodeURIComponent(election.id)}`} className="flex items-center gap-1.5 text-sm font-bold text-rose-600 dark:text-rose-400">
            Closest races and CSV
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] tracking-[0.1em] text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2.5 font-bold">Level</th>
                <th className="px-4 py-2.5 text-right font-bold">Contests</th>
                <th className="px-4 py-2.5 text-right font-bold">Decided</th>
                <th className="px-4 py-2.5 text-right font-bold">of which unopposed</th>
                <th className="px-4 py-2.5 text-right font-bold">Open</th>
              </tr>
            </thead>
            <tbody>
              {summary.levels.map((l) => (
                <tr key={l.level} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <Link href={`/writ/close-races/${encodeURIComponent(election.id)}?level=${l.level}`} className="font-medium text-slate-900 hover:text-rose-600 dark:text-white">
                      {LEVEL_LABELS[l.level]}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(l.contests)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(l.decided)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(l.uncontested)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(l.open)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.questions.passed + summary.questions.failed + summary.questions.tied ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ballot questions: {fmt(summary.questions.passed)} passing, {fmt(summary.questions.failed)} failing
            {summary.questions.tied ? `, ${fmt(summary.questions.tied)} tied` : ""}.
          </p>
        ) : null}
      </section>
    </div>
  );
}

// The path to final numbers. A step tied to a feed signal reads as done when the
// feed says so; one without a signal reads as passed once its date has.
function ResultsTimeline({ steps, today, signals }: { steps: ResultsData["calendar"]; today: string; signals: Record<string, boolean> }) {
  if (!steps.length) return null;
  const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  const source = steps.find((s) => s.source.startsWith("http"))?.source;
  return (
    <section aria-labelledby="timeline" className="space-y-3">
      <h2 id="timeline" className="text-lg font-bold text-slate-950 dark:text-white">
        Path to final results
      </h2>
      <Surface className="p-4 sm:p-5">
        <ol className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {steps.map((step) => {
            const signalled = step.signal ? signals[step.signal] : null;
            const passed = step.date < today;
            const state = signalled ? "Done" : step.signal ? (passed ? "Past deadline, not yet in the feed" : "Ahead") : passed ? "Passed" : "Ahead";
            return (
              <li key={`${step.date}-${step.label}`} className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-baseline">
                <span className="font-semibold text-slate-950 tabular-nums dark:text-white">{label(step.date)}</span>
                <span className="min-w-0 text-slate-700 dark:text-slate-300">
                  {step.label}
                  {step.meaning ? <span className="text-slate-500"> · {step.meaning}</span> : null}
                </span>
                <span className={`text-xs ${signalled ? "font-semibold text-slate-950 dark:text-white" : "text-slate-500"}`}>{state}</span>
              </li>
            );
          })}
        </ol>
        {source ? (
          <p className="mt-2 text-xs text-slate-500">
            Deadlines from the{" "}
            <a href={source} className="underline" rel="noreferrer" target="_blank">
              Brennan Center
            </a>{" "}
            and the Georgia Secretary of State&apos;s calendar.
          </p>
        ) : null}
      </Surface>
    </section>
  );
}

function partyColor(party: string) {
  return partyColorFor(PARTY_NAMES[party] ?? party);
}

function ChamberCard({ chamber }: { chamber: ChamberSummary }) {
  const undecided = chamber.undecided + chamber.missing;
  return (
    <Surface className="p-4 sm:p-5">
      <h3 className="text-sm font-bold text-slate-950 dark:text-white">{chamber.label}</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        {chamber.seats} seats{chamber.majority ? ` · ${chamber.majority} for a majority` : ""}
      </p>
      <div
        role="img"
        aria-label={`${chamber.label}: ${chamber.parties.map((p) => `${p.party} ${p.seats}`).join(", ")}${undecided ? `, ${undecided} undecided` : ""}`}
        className="relative mt-3 flex h-4 gap-0.5"
      >
        {chamber.parties.map((p) => (
          <span key={p.party} title={`${p.party}: ${p.seats} seats`} className="first:rounded-l-sm last:rounded-r-sm" style={{ flexGrow: p.seats, flexBasis: 0, background: partyColor(p.party).border }} />
        ))}
        {undecided ? <span title={`Undecided: ${undecided}`} className="rounded-r-sm bg-slate-300 dark:bg-slate-600" style={{ flexGrow: undecided, flexBasis: 0 }} /> : null}
        {chamber.majority ? (
          <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 bg-slate-950 dark:bg-white" style={{ left: `${(chamber.majority / chamber.seats) * 100}%` }} />
        ) : null}
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        {chamber.parties.map((p) => (
          <div key={p.party} className="flex items-baseline justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: partyColor(p.party).border }} />
              {partyLabel(p.party)}
            </dt>
            <dd className="text-right tabular-nums">
              <span className="font-bold text-slate-950 dark:text-white">{p.seats}</span>
              {p.net ? <span className="ml-2 text-xs text-slate-500">{p.net > 0 ? "+" : "−"}{Math.abs(p.net)}</span> : null}
              {p.recountRange ? <span className="ml-2 text-xs text-slate-500">{p.recountRange} in recount range</span> : null}
            </dd>
          </div>
        ))}
        {undecided ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{chamber.runoffs && chamber.runoffs === undecided ? (chamber.runoffs === 1 ? "Runoff" : "Runoffs") : "Undecided"}</dt>
            <dd className="font-bold tabular-nums">{undecided}</dd>
          </div>
        ) : null}
      </dl>
    </Surface>
  );
}

function partyLabel(code: string) {
  const name = PARTY_NAMES[code];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
}

function TwoWayRow({ row }: { row: ReportRow }) {
  const total = row.totalVotes || 1;
  const leaderPct = row.leaderVotes != null ? ((row.leaderVotes / total) * 100).toFixed(1) : null;
  const runnerPct = row.runnerUpVotes != null ? ((row.runnerUpVotes / total) * 100).toFixed(1) : null;
  return (
    <div className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-baseline sm:px-5">
      <Link href={raceHref(row)} className="min-w-0 font-semibold text-slate-950 hover:text-rose-600 dark:text-white">
        {short(row.name)}
      </Link>
      <span className="min-w-0 text-slate-700 dark:text-slate-300">
        <span className="font-medium text-slate-950 dark:text-white">{row.leaderName ?? "—"}</span>
        <Party party={row.leaderParty} />
        {leaderPct ? <span className="ml-1 tabular-nums">{leaderPct}%</span> : null}
        {row.runnerUpName ? (
          <span className="text-slate-500">
            {" "}
            over {row.runnerUpName}
            {runnerPct ? <span className="ml-1 tabular-nums">{runnerPct}%</span> : null}
          </span>
        ) : null}
        {row.seat?.change === "gained" ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">Flip from {row.seat.priorParty}</span> : null}
      </span>
      <span className="text-xs text-slate-500">{row.outcome.label}</span>
    </div>
  );
}

function OpenGroup({ title, detail, children }: { title: string; detail?: string | null; children: React.ReactNode }) {
  return (
    <Surface className="p-4 sm:p-5">
      <h3 className="text-sm font-bold text-slate-950 dark:text-white">
        {title}
        {detail ? <span className="ml-2 font-normal text-slate-500">{detail}</span> : null}
      </h3>
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
    </Surface>
  );
}

function OpenRow({ row, children }: { row: ReportRow; children?: React.ReactNode }) {
  return (
    <li className="grid gap-x-4 gap-y-0.5 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-baseline">
      <span className="min-w-0">
        <Link href={raceHref(row)} className="font-semibold text-slate-950 hover:text-rose-600 dark:text-white">
          {short(row.name)}
        </Link>
        {place(row) ? <span className="text-xs text-slate-500"> · {place(row)}</span> : null}
        {row.votedIn?.length ? <span className="text-xs text-slate-500"> · {row.votedIn.join(", ")}</span> : null}
      </span>
      <span className="min-w-0 text-xs">{children}</span>
      <span className="text-xs text-slate-500 tabular-nums">{margin(row)}</span>
    </li>
  );
}

function FlipList({ rows }: { rows: ReportRow[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
      {rows.map((row) => (
        <li key={row.id} className="flex min-w-0 items-baseline gap-2">
          <Link href={raceHref(row)} className="shrink-0 font-semibold text-slate-950 hover:text-rose-600 dark:text-white">
            {short(row.name)}
          </Link>
          <span className="min-w-0 truncate text-slate-600 dark:text-slate-400">
            {row.seat?.priorParty} → {row.leaderParty}: {row.leaderName}
          </span>
          <span className="ml-auto shrink-0 text-xs text-slate-500 tabular-nums">{row.marginPct != null ? `${row.marginPct.toFixed(1)} pts` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
