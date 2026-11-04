import Link from "next/link";
import type { CycleSummary } from "@/lib/elections/overview";
import type { ChamberProjection, ChamberResult, Party } from "@/lib/elections/control";
import { daysUntilElection, federalGeneralElectionDate } from "@/lib/elections/dates";

const OFFICE_LABELS = { senate: "Senate seats", house: "House seats", governor: "governor races", president: "presidential races" } as const;
const TOTAL_OFFICES: Partial<Record<ChamberProjection["chamber"], number>> = { senate: 100, house: 435, governor: 50 };
const CHAMBER_LABEL: Record<ChamberResult["chamber"], string> = { senate: "Senate", house: "House", governor: "Governors" };
const PARTY_PLURAL: Record<Party, string> = { D: "Democrats", R: "Republicans", I: "Independents" };
// Independents take a lighter slate in the bar than their usual dot, so the
// segment stays distinct from the Democratic blue beside it.
const SEGMENT_FILL: Record<Party, string> = { D: "#2166AC", I: "#94A3B8", R: "#B2182B" };

// "Democrats won control of the Senate and House" once a party reaches the line.
function controlHeadline(results: ChamberResult[]): string | null {
  const chambers = results.filter((result) => result.chamber !== "governor" && result.control);
  if (!chambers.length) return null;
  const parties = new Set(chambers.map((result) => result.control));
  const names = chambers.map((result) => CHAMBER_LABEL[result.chamber]).join(" and ");
  if (parties.size === 1) return `${PARTY_PLURAL[chambers[0].control!]} won control of the ${names}`;
  return chambers.map((result) => `${PARTY_PLURAL[result.control!]} won the ${CHAMBER_LABEL[result.chamber]}`).join("; ");
}

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
}

function SeatBar({ result }: { result: ChamberResult }) {
  const total = TOTAL_OFFICES[result.chamber] ?? result.seats.D + result.seats.R + result.seats.I + result.uncalled;
  const segments = [
    { key: "D", seats: result.seats.D, fill: SEGMENT_FILL.D, label: "Democrats" },
    { key: "I", seats: result.seats.I, fill: SEGMENT_FILL.I, label: "Independents" },
    { key: "U", seats: result.uncalled, fill: "transparent", label: "Not yet called" },
    { key: "R", seats: result.seats.R, fill: SEGMENT_FILL.R, label: "Republicans" },
  ].filter((segment) => segment.seats > 0);
  return (
    <div className="relative mt-3">
      <div className="flex h-5 gap-0.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-800" role="img" aria-label={segments.map((segment) => `${segment.label} ${segment.seats}`).join(", ")}>
        {segments.map((segment) => (
          <div key={segment.key} title={`${segment.label}: ${segment.seats}`} style={{ width: `${(segment.seats / total) * 100}%`, background: segment.fill }} />
        ))}
      </div>
      <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-950 dark:bg-white" style={{ left: `${(result.majority / total) * 100}%` }} title={`${result.majority} seats`} aria-hidden />
    </div>
  );
}

function SeatCount({ party, seats }: { party: Party; seats: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="h-2.5 w-2.5 self-center rounded-sm" style={{ background: SEGMENT_FILL[party] }} aria-hidden />
      <strong className="text-2xl font-semibold tabular-nums">{seats}</strong>
      <span className="text-sm text-slate-600 dark:text-slate-400">{party}</span>
    </span>
  );
}

function ResultCard({ result, cycle }: { result: ChamberResult; cycle: number }) {
  const { seats, flips } = result;
  const flipParts = (["D", "R", "I"] as const).filter((party) => flips[party]).map((party) => `${flips[party]} to ${party}`);
  return (
    <Link href={`/elections?cycle=${cycle}&office=${result.chamber}#races`} className="group block border-t-2 border-slate-950 pt-3 dark:border-white">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-950 group-hover:underline dark:text-white">{CHAMBER_LABEL[result.chamber]}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{result.majority} for {result.chamber === "governor" ? "a majority" : "control"}</span>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-slate-950 dark:text-white">
        <SeatCount party="D" seats={seats.D} />
        {seats.I ? <SeatCount party="I" seats={seats.I} /> : null}
        <SeatCount party="R" seats={seats.R} />
      </p>
      <SeatBar result={result} />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {[result.uncalled ? `${result.uncalled} not yet called` : "All races called", flipParts.length ? `Flipped: ${flipParts.join(", ")}` : "No seats flipped"].join(" · ")}
      </p>
      {result.chamber === "senate" && seats.I ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The independents caucus with Democrats.</p> : null}
    </Link>
  );
}

export function ElectionCycleHero({ summary, projections, results = [], now = new Date() }: { summary: CycleSummary; projections: ChamberProjection[]; results?: ChamberResult[]; now?: Date }) {
  const date = federalGeneralElectionDate(summary.cycle);
  const days = daysUntilElection(date, now);
  const dateValue = new Date(`${date}T12:00:00Z`);
  const dateLabel = dateValue.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const shortDate = dateValue.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
  const title = summary.cycle % 4 === 2 ? `${summary.cycle} Midterm Elections` : `${summary.cycle} Elections`;
  const state = days > 1 ? `Election Day in ${days} days` : days === 1 ? "Election Day is tomorrow" : days === 0 ? "Election Day" : summary.upcoming ? "Election results and certification" : `${summary.cycle} Election Results`;
  const headline = controlHeadline(results);
  const asOf = results.find((result) => result.asOf)?.asOf;

  return (
    <section className="border-y border-slate-300 py-8 dark:border-slate-700">
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Election center</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl dark:text-white">{title}</h1>
          <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">{headline ?? state}</p>
          {results.length ? null : (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              {Object.entries(summary.offices).map(([office, count]) => (
                <span key={office}><strong className="text-slate-950 dark:text-white">{count}</strong> {OFFICE_LABELS[office as keyof typeof OFFICE_LABELS]}</span>
              ))}
            </div>
          )}
        </div>
        <div className="border-l-4 border-slate-950 pl-5 dark:border-white">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Election Day</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">{shortDate}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{dateLabel}</p>
          {asOf ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Results as of {asOfLabel(asOf)}</p>
          ) : (
            <a href="https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">Federal election calendar</a>
          )}
        </div>
      </div>

      {results.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => <ResultCard key={result.chamber} result={result} cycle={summary.cycle} />)}
        </div>
      ) : null}

      {projections.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projections.map((projection) => (
            <Link key={projection.chamber} href={`/elections?cycle=${summary.cycle}&office=${projection.chamber === "governor" ? "governor" : projection.chamber}`} className="border-t-2 border-slate-950 pt-3 dark:border-white">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold capitalize text-slate-950 dark:text-white">{projection.chamber}</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">{projection.majority} for control</span>
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Current: {projection.current.D} D, {projection.current.R} R{projection.current.I ? `, ${projection.current.I} I` : ""}
                {(() => { const missing = (TOTAL_OFFICES[projection.chamber] ?? 0) - projection.current.D - projection.current.R - projection.current.I; return missing > 0 ? `, ${missing} vacant or not identified` : ""; })()}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{projection.seatsUp} seats on the ballot</p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const ROW = "grid gap-2 py-4 sm:grid-cols-[10rem_1fr]";
const ROW_TEXT = "text-sm text-slate-600 dark:text-slate-400";

export function ElectionCalendar({ afterElection = false }: { afterElection?: boolean }) {
  if (afterElection) {
    return (
      <section id="voting" className="scroll-mt-24 border-t border-slate-300 pt-5 dark:border-slate-700">
        <div className="grid gap-5 md:grid-cols-[12rem_1fr]">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">What&apos;s next</h2>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">From the count to the swearing-in.</h3>
            <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              <div className={ROW}><strong>Now</strong><p className={ROW_TEXT}>States finish counting ballots. Canvass, recount, runoff, and certification dates are set by each state.</p></div>
              <div className={ROW}><strong>December 1</strong><p className={ROW_TEXT}>Georgia&apos;s general-election runoff, for any contest that needs one.</p></div>
              <div className={ROW}><strong>January 3, 2027</strong><p className={ROW_TEXT}>The terms of the new Congress begin. Governors take office on dates set by each state.</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium">
              <Link href="/writ/results" className="text-blue-700 hover:underline dark:text-blue-300">Every Georgia contest</Link>
              <a href="https://www.eac.gov/voters/register-and-vote-in-your-state" className="text-blue-700 hover:underline dark:text-blue-300">Official state election offices</a>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="voting" className="scroll-mt-24 border-t border-slate-300 pt-5 dark:border-slate-700">
      <div className="grid gap-5 md:grid-cols-[12rem_1fr]">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Voting calendar</h2>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Check dates where you vote.</h3>
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>Now</strong><p className={ROW_TEXT}>Registration, mail ballot, and early-voting deadlines vary by state.</p></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>November 3</strong><p className={ROW_TEXT}>Federal Election Day. State and local contests may appear on the same ballot.</p></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>After voting</strong><p className={ROW_TEXT}>Canvass, recount, runoff, and certification dates are set by each state.</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium">
            <a href="https://www.eac.gov/voters/register-and-vote-in-your-state" className="text-blue-700 hover:underline dark:text-blue-300">Official state voting information</a>
            <a href="https://vote.gov/register" className="text-blue-700 hover:underline dark:text-blue-300">Check registration deadlines</a>
          </div>
        </div>
      </div>
    </section>
  );
}
