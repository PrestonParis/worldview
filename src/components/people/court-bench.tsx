import Link from "next/link";
import { PortraitImage } from "@/components/people/portrait-image";
import { benchOrder } from "@/lib/people/bench";
import type { AppointingParty, CourtComposition, CourtJustice } from "@/lib/people/court";
import { initials } from "@/lib/format";

// The Supreme Court in three views: the bench as it sits, who appointed
// whom, and each justice's voting record on a shared axis.

const PARTY_COLOR: Record<AppointingParty | "none", string> = {
  R: "var(--viz-rep)",
  D: "var(--viz-dem)",
  none: "var(--viz-muted)",
};
const PARTY_NAME: Record<AppointingParty, string> = { R: "Republican", D: "Democratic" };

const color = (party: AppointingParty | null) => PARTY_COLOR[party ?? "none"];
const lastName = (name: string) => name.split(" ").at(-1) ?? name;
const year = (date: string) => date.slice(0, 4);

function Seat({ justice }: { justice: CourtJustice }) {
  const chief = justice.seat === "chief";
  return (
    <li className="min-w-0">
      <Link href={justice.href} className="group flex flex-col items-center text-center">
        <span
          className={`relative flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-[3px] ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ${chief ? "h-16 w-16 text-base" : "h-14 w-14 text-sm"}`}
          style={{ background: color(justice.appointingParty), ["--tw-ring-color" as string]: color(justice.appointingParty) }}
          aria-hidden
        >
          {initials(justice.name)}
          {justice.imageUrl ? <PortraitImage src={justice.imageUrl} /> : null}
        </span>
        <span className="mt-2 text-sm leading-tight font-semibold text-slate-900 group-hover:underline dark:text-white">{justice.name}</span>
        <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {chief ? "Chief Justice · " : ""}since {year(justice.seated)}
        </span>
        <span className="text-[11px] leading-snug text-slate-400">{justice.appointedBy}</span>
      </Link>
    </li>
  );
}

function Appointments({ data }: { data: CourtComposition }) {
  const total = data.justices.length;
  const byParty = (party: AppointingParty) => data.justices.filter((j) => j.appointingParty === party).length;
  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {(["R", "D"] as const)
          .filter((p) => byParty(p))
          .map((p) => (
            <span key={p} className="mr-4 inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PARTY_COLOR[p] }} />
              <span>
                <span className="font-semibold tabular-nums">{byParty(p)}</span> appointed by {PARTY_NAME[p]} presidents
              </span>
            </span>
          ))}
      </p>
      <div className="mt-3 flex h-8 w-full gap-0.5 overflow-hidden rounded-lg">
        {data.byPresident.map((p) => (
          <span
            key={p.president}
            className="flex min-w-0 items-center justify-center px-1 text-[11px] font-medium text-white"
            style={{ width: `${(p.count / total) * 100}%`, background: color(p.party) }}
            title={`${p.president}: ${p.count}`}
          >
            <span className="truncate">{p.count}</span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex w-full gap-0.5">
        {data.byPresident.map((p) => (
          <span key={p.president} className="min-w-0 truncate px-0.5 text-[11px] text-slate-500 dark:text-slate-400" style={{ width: `${(p.count / total) * 100}%` }} title={p.president}>
            {p.president}
          </span>
        ))}
      </div>
    </div>
  );
}

// One row per justice, most liberal record to most conservative: the dot
// is the recent record, the ring the whole career.
function VotingRecord({ data }: { data: CourtComposition }) {
  const placed = data.justices
    .filter((j) => j.record?.recentShare != null)
    .sort((a, b) => a.record!.recentShare! - b.record!.recentShare!);
  if (!placed.length) return null;
  const values = placed.flatMap((j) => [j.record!.recentShare!, j.record!.careerShare ?? j.record!.recentShare!]);
  let lo = Math.floor(Math.min(...values) / 10) * 10;
  let hi = Math.ceil(Math.max(...values) / 10) * 10;
  if (hi - lo < 30) {
    lo = Math.max(0, lo - 10);
    hi = Math.min(100, hi + 10);
  }
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10);

  return (
    <div>
      <div className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-x-3 sm:grid-cols-[9rem_1fr_3.5rem]">
        {placed.map((j) => {
          const median = j.id === data.medianId;
          return (
            <div key={j.id} className={`contents ${median ? "font-semibold" : ""}`}>
              <Link href={j.href} className="truncate py-1.5 text-sm text-slate-800 hover:underline dark:text-slate-200">
                {lastName(j.name)}
                {median ? <span className="ml-1.5 hidden rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:inline dark:bg-slate-800 dark:text-slate-400">Median</span> : null}
              </Link>
              <div className={`relative h-7 ${median ? "rounded bg-slate-100 dark:bg-slate-900" : ""}`}>
                {ticks.map((t) => (
                  <span key={t} className={`absolute inset-y-0 w-px ${t === 50 ? "bg-slate-300 dark:bg-slate-600" : "bg-slate-100 dark:bg-slate-800"}`} style={{ left: x(t) }} aria-hidden />
                ))}
                {j.record!.careerShare != null ? (
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-transparent"
                    style={{ left: x(j.record!.careerShare), borderColor: color(j.appointingParty), opacity: 0.45 }}
                    aria-hidden
                  />
                ) : null}
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-slate-950"
                  style={{ left: x(j.record!.recentShare!), background: color(j.appointingParty) }}
                  title={`${j.name}: ${j.record!.recentShare}% conservative, ${data.recentFrom}–${data.latestTerm} terms; ${j.record!.careerShare}% career`}
                />
              </div>
              <span className="text-right text-sm text-slate-600 tabular-nums dark:text-slate-300">{j.record!.recentShare!.toFixed(1)}%</span>
            </div>
          );
        })}
        <span />
        <div className="relative mt-1 h-4 text-[11px] text-slate-400 tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>{t}%</span>
          ))}
        </div>
        <span />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-500" /> {data.recentFrom}–{data.latestTerm} terms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-slate-400" /> Whole career
        </span>
      </div>
    </div>
  );
}

export function CourtBench({ data }: { data: CourtComposition }) {
  return (
    <div className="space-y-8">
      <ol className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5 lg:grid-cols-9" aria-label="The bench, as seated from the audience">
        {benchOrder(data.justices).map((j) => <Seat key={j.id} justice={j} />)}
      </ol>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Who appointed the Court</h3>
        <Appointments data={data} />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">How each justice votes</h3>
        <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
          Share of votes cast on the conservative side of a case, as the Supreme Court Database codes each decision&apos;s direction.
        </p>
        <VotingRecord data={data} />
      </section>
    </div>
  );
}
