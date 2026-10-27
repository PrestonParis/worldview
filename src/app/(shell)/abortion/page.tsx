import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LimitsMap } from "@/components/abortion/limits-map";
import { StateTravelPicker } from "@/components/abortion/state-travel";
import { ChartCard } from "@/components/charts/chart-card";
import { citeFrom } from "@/components/charts/citation";
import { periodTags } from "@/components/charts/period-tag";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { SectionNav } from "@/components/data/section-nav";
import { loadAbortion } from "@/lib/abortion/data";
import { formatValue } from "@/lib/format";
import { loadStatePaths } from "@/lib/geo/state-paths";
import { IssueHeader } from "@/components/data/issue-layout";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Abortion | Worldview",
  description:
    "Abortion in the United States with data: monthly and annual counts nationally and by state, travel between states, telehealth, state gestational limits, and long-run trends since 1973.",
};

const SECTIONS = [
  ["trend", "Since 1973"],
  ["laws", "State limits"],
  ["travel", "Travel"],
  ["telehealth", "Telehealth & method"],
  ["patients", "Patients"],
  ["states", "States"],
] as const;

const SOURCES = {
  monthly: "guttmacher-monthly-abortions",
  history: "guttmacher-pregnancy-history",
  cdc: "cdc-abortion-surveillance",
  limits: "abortion-gestational-limits",
};

// Court rulings and federal rules that changed abortion access. Charts only
// draw the ones inside their own date range.
const HISTORY = [
  { x: 1973 + 0 / 12, label: "Roe v. Wade (Jan 1973)" },
  { x: 1976 + 8 / 12, label: "Hyde Amendment (Sep 1976)" },
  { x: 1992 + 5 / 12, label: "Planned Parenthood v. Casey (Jun 1992)" },
  { x: 2000 + 8 / 12, label: "FDA approves mifepristone (Sep 2000)" },
  { x: 2021 + 11 / 12, label: "FDA allows pills by mail (Dec 2021)" },
  { x: 2022 + 5 / 12, label: "Dobbs decision (Jun 2022)" },
];
const SINCE_2023 = [
  { x: 2023 + 5 / 12, label: "New York telehealth shield law (Jun 2023)" },
  { x: 2024 + 4 / 12, label: "Florida 6-week ban (May 2024)" },
  { x: 2024 + 5 / 12, label: "Supreme Court mifepristone ruling (Jun 2024)" },
];

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

function Section({ id, title, question, children }: { id: string; title: string; question: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">{question}</p>
      </div>
      {children}
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-3 text-base leading-7 text-slate-600 dark:text-slate-300">{children}</div>;
}

export default async function AbortionPage() {
  const [d, map] = await Promise.all([loadAbortion(), loadStatePaths()]);
  if (!d) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Abortion</h1>
        <p className="mt-4 text-slate-500">No abortion data is loaded yet.</p>
      </div>
    );
  }
  const h = d.headline;
  const cite = (slug: string) => citeFrom(d.datasets, slug)[0];
  const year = h.year ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Abortion" />

      <ChartCard
        title="Abortions per year since 1973"
        subtitle="Three sources · lines mark major rulings and federal rules"
        source={[cite(SOURCES.history), cite(SOURCES.monthly), cite(SOURCES.cdc)].filter(Boolean)}
        table={seriesTable(d.longRun, "abortions")}
      >
        <TimeSeriesChart series={d.longRun} unit="abortions" height={340} markers={HISTORY} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      {/* ---------------------------------------------------------- Since 1973 */}
      <Section id="trend" title="Since 1973" question="How does today compare with the decades since Roe v. Wade, and how has each month gone since 2023?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Abortions per year"
            unit="abortions"
            value={h.total.value}
            period={year}
            note="Provided by U.S. clinicians, including telehealth"
            change={h.total.change}
            compareLabel={h.priorYear ? `vs ${h.priorYear}` : undefined}
            spark={h.total.spark}
          />
          <StatTile
            label="Latest month"
            unit="abortions"
            value={h.month.value}
            tag={periodTags.month(h.month.period)}
            note="Monthly estimate"
            change={h.month.change}
            compareLabel={h.month.compare ? `vs ${h.month.compare}` : undefined}
            spark={h.month.spark}
          />
        </div>
        <Prose>
          <p>
            Guttmacher counts every provider; there is no Guttmacher estimate for 2021–2022. CDC&apos;s totals are lower because California,
            Maryland, and New Hampshire don&apos;t report. Counts since 2023 are by the state where the abortion happened, earlier ones by the
            patient&apos;s home state. Abortions under ban exceptions and pills from outside the U.S. health system aren&apos;t included.
          </p>
        </Prose>
        <ChartCard title="Abortion rate" subtitle="Per 1,000 women aged 15–44" source={cite(SOURCES.history)} table={seriesTable(d.rates, "per_1000")}>
          <TimeSeriesChart series={d.rates} unit="per_1000" height={280} markers={HISTORY} />
        </ChartCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions per month" subtitle="United States · estimate" source={cite(SOURCES.monthly)} table={seriesTable(d.trend, "abortions")}>
            <TimeSeriesChart series={d.trend} unit="abortions" height={260} markers={SINCE_2023} />
          </ChartCard>
          <ChartCard
            title="By state law"
            subtitle="Per month · states with total bans receive abortions mainly by telehealth"
            source={cite(SOURCES.monthly)}
            table={seriesTable(d.groups, "abortions")}
          >
            <TimeSeriesChart series={d.groups} unit="abortions" height={260} markers={SINCE_2023} />
          </ChartCard>
        </div>
      </Section>

      {/* --------------------------------------------------------- State limits */}
      <Section
        id="laws"
        title="State gestational limits"
        question="After how many weeks of pregnancy does each state ban abortion?"
      >
        <Prose>
          <p>
            Since the Supreme Court&apos;s June 2022 Dobbs v. Jackson Women&apos;s Health Organization decision, each state sets its own limit.
            Limits below are as in effect in{" "}
            {d.limitsPeriod ? new Date(`${d.limitsPeriod}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "the latest month"}.
            Most laws include exceptions, such as to save the patient&apos;s life, which vary by state.
          </p>
        </Prose>
        <LimitsMap
          width={map.width}
          height={map.height}
          states={map.states}
          limits={Object.fromEntries(d.limits.flatMap((c) => c.states.map((st) => [st.abbr, { category: c.value, detail: st.detail }])))}
          categories={d.limits.map((c) => ({ value: c.value, label: c.label, count: c.states.length }))}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {d.limits.map((c) => (
            <div key={c.value} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="flex items-center gap-2.5 text-3xl font-semibold text-slate-950 tabular-nums dark:text-white">
                <span className="size-4 rounded ring-1 ring-slate-300 dark:ring-slate-700" style={{ background: `var(--limit-${c.value})` }} aria-hidden />
                {c.states.length}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{c.label}</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {c.states.map((s) => (
                  <li
                    key={s.abbr}
                    title={s.detail ? `${s.name}: ${s.detail}` : s.name}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {s.abbr}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Hover a state for the law&apos;s wording.
          {cite(SOURCES.limits) && (
            <>
              {" "}Source:{" "}
              <Link href={cite(SOURCES.limits).href!} className="underline underline-offset-2">
                {cite(SOURCES.limits).label}
              </Link>
            </>
          )}
        </p>
      </Section>

      {/* -------------------------------------------------------------- Travel */}
      {d.travel.year && (
        <Section id="travel" title="Travel between states" question="How many people cross state lines for an abortion, and where do they go?">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Traveled to another state"
              unit="abortions"
              value={h.fromOther.value}
              period={year}
              extra={h.fromOther.share !== null ? ` · ${pct(h.fromOther.share)}` : undefined}
              note="Patients treated outside their home state"
            />
          </div>
          <ChartCard title="Largest flows" subtitle={`${d.travel.year} · home state → state where provided`} source={cite(SOURCES.monthly)} table={rankedTable(d.travel.corridors, "Flow", "abortions")}>
            <RankedBars items={d.travel.corridors} unit="abortions" />
          </ChartCard>
          <StateTravelPicker states={d.travel.states} year={d.travel.year} />
        </Section>
      )}

      {/* ---------------------------------------------------------- Telehealth */}
      <Section id="telehealth" title="Telehealth and method" question="How much abortion now happens by mail, and how common is medication abortion?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="By telehealth (virtual-only)"
            unit="abortions"
            value={h.virtual.value}
            period={year}
            extra={h.virtual.share !== null ? ` · ${pct(h.virtual.share)}` : undefined}
            note="Pills mailed after an online consultation"
            spark={h.virtual.spark}
          />
        </div>
        <Prose>
          <p>
            Medication abortion uses two drugs, mifepristone and misoprostol, which the FDA has approved through 10 weeks of pregnancy. Virtual-only providers
            prescribe them after an online consultation and mail them; in states with total bans, they do so under shield laws in the
            provider&apos;s own state.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions by virtual-only providers" subtitle="Per year · by state law where the pills were received" source={cite(SOURCES.monthly)} table={seriesTable(d.virtualSeries, "abortions")}>
            <TimeSeriesChart series={d.virtualSeries} type="column" unit="abortions" height={260} />
          </ChartCard>
          <ChartCard title="Medication abortions" subtitle="Share of abortions reported to CDC with a known method" source={cite(SOURCES.cdc)} table={seriesTable(d.medication, "percent")}>
            <TimeSeriesChart series={d.medication} type="column" unit="percent" height={260} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Patients */}
      {d.cdcYear && (
        <Section id="patients" title="Patients" question="Who obtains abortions, and how far along in pregnancy?">
          <ChartCard
            title="Who obtains abortions"
            subtitle={`${d.cdcYear} · CDC reporting areas that record each characteristic`}
            source={cite(SOURCES.cdc)}
            table={{
              columns: ["Group", "Value"],
              rows: [
                ...d.ages.map((i) => [`Age ${i.label}`, formatValue(i.value, "percent")]),
                ...d.weeks.map((i) => [i.label, formatValue(i.value, "percent")]),
                ...d.raceRates.map((i) => [i.label, `${formatValue(i.value, "per_1000")} per 1,000`]),
              ],
            }}
          >
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
              {[
                { title: "Age", note: "Share of abortions", items: d.ages, unit: "percent", slot: 1 as const },
                { title: "Weeks of pregnancy", note: "Share of abortions", items: d.weeks, unit: "percent", slot: 3 as const },
                { title: "Race and ethnicity", note: "Abortions per 1,000 women aged 15–44", items: d.raceRates, unit: "per_1000", slot: 2 as const },
              ].map((g) => (
                <div key={g.title}>
                  <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{g.title}</h4>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{g.note}</p>
                  <RankedBars items={g.items} unit={g.unit} slot={g.slot} />
                </div>
              ))}
            </div>
          </ChartCard>
        </Section>
      )}

      {/* -------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare?">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>
    </div>
  );
}
