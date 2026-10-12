"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartCard, type TableView } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { formatValue, pctChange } from "@/lib/format";
import type { Electorate, ElectorateYear, GroupStat } from "@/lib/db/electorate";

// Cells resting on fewer respondents than this are shown as "—"; state
// breakdowns of small groups get thin fast.
const MIN_SAMPLE = 50;

const SOURCE = { label: "U.S. Census Bureau, CPS Voting and Registration Supplement", href: "/datasets/cps-voting" };
// Voters take a non-party hue (blue and red mean parties on this page);
// eligible citizens are the neutral reference.
const VOTERS = "var(--viz-series-3)";
const ELIGIBLE = "var(--viz-muted)";

const pct = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`);
const isMidterm = (year: number) => year % 4 !== 0;

export function ElectorateSection({ data, initialYear }: { data: Electorate; initialYear?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(
    data.years.find((y) => y.year === initialYear)?.year ?? data.years[0].year,
  );
  const current = data.years.find((y) => y.year === year) ?? data.years[0];
  // The comparable election before this one: presidential to presidential,
  // midterm to midterm.
  const previous = data.years.find((y) => y.year < current.year && isMidterm(y.year) === isMidterm(current.year));

  const setGeo = (geoid: string) => {
    const next = new URLSearchParams(searchParams);
    if (geoid === "US") next.delete("electorate");
    else next.set("electorate", geoid);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}#electorate` : `${pathname}#electorate`, { scroll: false });
  };

  const turnout = (y: ElectorateYear) => (y.citizens ? (y.voted / y.citizens) * 100 : null);
  const registration = (y: ElectorateYear) => (y.citizens ? (y.registered / y.citizens) * 100 : null);
  const kind = isMidterm(current.year) ? "midterm" : "presidential";

  return (
    <section id="electorate" className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Who votes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          The people who actually cast a ballot in November, compared with every eligible citizen (U.S. citizens 18 and
          over), by age, race and ethnicity, sex, education, and family income. From the Census Bureau&rsquo;s survey of
          voting and registration, taken right after each federal election.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800" role="group" aria-label="Election year">
          {data.years.map((y) => {
            const on = y.year === current.year;
            return (
              <button
                key={y.year}
                type="button"
                aria-pressed={on}
                onClick={() => setYear(y.year)}
                className={`rounded-md px-3 py-1 font-mono font-medium tabular-nums transition-colors ${
                  on
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {y.year}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="sr-only">Place</span>
          <select
            value={data.geoid}
            onChange={(e) => setGeo(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="US">United States</option>
            {data.states.map((s) => (
              <option key={s.geoid} value={s.geoid}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={`Voted, ${current.year} ${kind} election`}
          value={current.voted}
          period={data.geoName}
          change={previous ? pctChange(current.voted, previous.voted) : null}
          compareLabel={previous ? `vs ${previous.year}` : undefined}
        />
        <StatTile
          label="Turnout among eligible citizens"
          unit="percent"
          value={turnout(current)}
          period={previous ? `${pct(turnout(previous))} in ${previous.year}` : `of ${formatValue(current.citizens, "people", { compact: true })} eligible`}
        />
        <StatTile
          label="Registered to vote"
          unit="percent"
          value={registration(current)}
          period={previous ? `${pct(registration(previous))} in ${previous.year}` : `${formatValue(current.registered, "people", { compact: true })} people`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {current.dimensions.map((d) => (
          <DimensionCard key={d.key} dimension={d} year={current} />
        ))}
      </div>
    </section>
  );
}

function DimensionCard({ dimension, year }: { dimension: ElectorateYear["dimensions"][number]; year: ElectorateYear }) {
  const rows = useMemo(() => {
    const shown = (g: GroupStat) => g.sample >= MIN_SAMPLE;
    // A group with no respondents at all (e.g. unreported income in a year
    // where Census imputed every value) is left out rather than shown blank.
    return dimension.groups.filter((g) => g.sample > 0).map((g) => ({
      ...g,
      ok: shown(g),
      voterShare: g.voted != null && year.voted ? (g.voted / year.voted) * 100 : null,
      eligibleShare: g.citizens != null && year.citizens ? (g.citizens / year.citizens) * 100 : null,
      turnout: g.voted != null && g.citizens ? (g.voted / g.citizens) * 100 : null,
    }));
  }, [dimension, year]);
  const max = Math.max(1, ...rows.flatMap((r) => (r.ok ? [r.voterShare ?? 0, r.eligibleShare ?? 0] : [])));
  const compare = !dimension.votersOnly;

  const table: TableView = compare
    ? {
        columns: ["Group", "Voters", "Share of voters", "Share of eligible", "Turnout"],
        rows: rows.map((r) =>
          r.ok
            ? [r.label, formatValue(r.voted, "people"), pct(r.voterShare), pct(r.eligibleShare), pct(r.turnout)]
            : [r.label, "—", "—", "—", "—"],
        ),
      }
    : {
        columns: ["Method", "Voters", "Share of voters"],
        rows: rows.map((r) => (r.ok ? [r.label, formatValue(r.voted, "people"), pct(r.voterShare)] : [r.label, "—", "—"])),
      };

  return (
    <ChartCard
      title={dimension.label}
      subtitle={compare ? "Share of voters compared with share of eligible citizens, and each group's turnout" : "Share of voters"}
      source={SOURCE}
      table={table}
    >
      {compare ? (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: VOTERS }} />
            Voters
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-2.5 rounded-sm" style={{ background: ELIGIBLE }} />
            Eligible citizens
          </span>
        </div>
      ) : null}
      <div
        className="grid items-center gap-x-3 text-sm"
        style={{
          gridTemplateColumns: compare
            ? "minmax(0, clamp(5.5rem, 28%, 9rem)) minmax(0, 1fr) 3.25rem"
            : "minmax(0, clamp(6.5rem, 34%, 11rem)) minmax(0, 1fr)",
        }}
      >
        {compare ? (
          <>
            <span />
            <span />
            <span className="pb-1 text-right text-[11px] text-slate-400">Turnout</span>
          </>
        ) : null}
        {rows.map((r) => (
          <Row key={r.key} row={r} max={max} compare={compare} />
        ))}
      </div>
    </ChartCard>
  );
}

function Row({
  row,
  max,
  compare,
}: {
  row: GroupStat & { ok: boolean; voterShare: number | null; eligibleShare: number | null; turnout: number | null };
  max: number;
  compare: boolean;
}) {
  const title = row.ok
    ? compare
      ? `${row.label}: ${pct(row.voterShare)} of voters, ${pct(row.eligibleShare)} of eligible citizens, ${pct(row.turnout)} turnout`
      : `${row.label}: ${pct(row.voterShare)} of voters`
    : `${row.label}: too few survey respondents to estimate`;
  const bar = (value: number | null, color: string, thick: boolean) => (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`${thick ? "h-3" : "h-1.5"} shrink-0 rounded-r`}
        style={{ width: `calc(${Math.max(0.5, ((value ?? 0) / max) * 100)}% - 2.75rem)`, minWidth: 2, background: color }}
      />
      <span className={`shrink-0 tabular-nums ${thick ? "text-xs font-medium text-slate-900 dark:text-white" : "text-[11px] text-slate-500 dark:text-slate-400"}`}>
        {pct(value)}
      </span>
    </span>
  );
  return (
    <>
      <span className="truncate py-1.5 text-slate-600 dark:text-slate-300" title={title}>
        {row.label}
      </span>
      {row.ok ? (
        <span className="flex min-w-0 flex-col gap-0.5 py-1.5" title={title}>
          {bar(row.voterShare, VOTERS, true)}
          {compare ? bar(row.eligibleShare, ELIGIBLE, false) : null}
        </span>
      ) : (
        <span className="py-1.5 text-xs text-slate-400" title={title}>
          —
        </span>
      )}
      {compare ? (
        <span className="py-1.5 text-right text-xs text-slate-700 tabular-nums dark:text-slate-200" title={title}>
          {row.ok ? pct(row.turnout) : "—"}
        </span>
      ) : null}
    </>
  );
}
