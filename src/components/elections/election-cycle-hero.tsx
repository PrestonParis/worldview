import Link from "next/link";
import type { CycleSummary } from "@/lib/elections/overview";
import type { ChamberProjection } from "@/lib/elections/control";
import { daysUntilElection, federalGeneralElectionDate } from "@/lib/elections/dates";

const OFFICE_LABELS = { senate: "Senate seats", house: "House seats", governor: "governor races", president: "presidential races" } as const;
const TOTAL_OFFICES: Partial<Record<ChamberProjection["chamber"], number>> = { senate: 100, house: 435, governor: 50 };

export function ElectionCycleHero({ summary, projections, now = new Date() }: { summary: CycleSummary; projections: ChamberProjection[]; now?: Date }) {
  const date = federalGeneralElectionDate(summary.cycle);
  const days = daysUntilElection(date, now);
  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const title = summary.cycle % 4 === 2 ? `${summary.cycle} Midterm Elections` : `${summary.cycle} Elections`;
  const state = days > 1 ? `Election Day in ${days} days` : days === 1 ? "Election Day is tomorrow" : days === 0 ? "Election Day" : summary.upcoming ? "Election results and certification" : `${summary.cycle} Election Results`;

  return (
    <section className="border-y border-slate-300 py-8 dark:border-slate-700">
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Election center</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl dark:text-white">{title}</h1>
          <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">{state}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            {Object.entries(summary.offices).map(([office, count]) => (
              <span key={office}><strong className="text-slate-950 dark:text-white">{count}</strong> {OFFICE_LABELS[office as keyof typeof OFFICE_LABELS]}</span>
            ))}
          </div>
        </div>
        <div className="border-l-4 border-slate-950 pl-5 dark:border-white">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Election Day</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">NOV 3</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{dateLabel}</p>
          <a href="https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">Federal election calendar</a>
        </div>
      </div>

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

export function ElectionCalendar() {
  return (
    <section id="voting" className="scroll-mt-24 border-t border-slate-300 pt-5 dark:border-slate-700">
      <div className="grid gap-5 md:grid-cols-[12rem_1fr]">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Voting calendar</h2>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Check dates where you vote.</h3>
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>Now</strong><p className="text-sm text-slate-600 dark:text-slate-400">Registration, mail ballot, and early-voting deadlines vary by state.</p></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>November 3</strong><p className="text-sm text-slate-600 dark:text-slate-400">Federal Election Day. State and local contests may appear on the same ballot.</p></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><strong>After voting</strong><p className="text-sm text-slate-600 dark:text-slate-400">Canvass, recount, runoff, and certification dates are set by each state.</p></div>
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
