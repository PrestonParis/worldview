import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LimitsMap } from "@/components/abortion/limits-map";
import { StateTravelPicker } from "@/components/abortion/state-travel";
import { ChartCard } from "@/components/charts/chart-card";
import { periodTags } from "@/components/charts/period-tag";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { SectionNav } from "@/components/data/section-nav";
import { loadAbortion } from "@/lib/abortion/data";
import { formatValue } from "@/lib/format";
import { loadStatePaths } from "@/lib/geo/state-paths";
import { FeatureList } from "@/components/ui/feature-list";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Abortion | Worldview",
  description:
    "Abortion in the United States with data: monthly and annual counts nationally and by state, travel between states, telehealth, state gestational limits, and long-run trends since 1973.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["trend", "Since 2023"],
  ["long-run", "Since 1973"],
  ["laws", "State limits"],
  ["travel", "Travel"],
  ["telehealth", "Telehealth & method"],
  ["patients", "Patients"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  monthly: { label: "Guttmacher Monthly Abortion Provision Study", href: "/datasets/guttmacher-monthly-abortions" },
  history: { label: "Guttmacher, Pregnancies, Births and Abortions 1973–2020", href: "/datasets/guttmacher-pregnancy-history" },
  cdc: { label: "CDC Abortion Surveillance", href: "/datasets/cdc-abortion-surveillance" },
  limits: { label: "Guttmacher state policy summaries", href: "/datasets/abortion-gestational-limits" },
};

const USES: Record<string, string> = {
  "guttmacher-monthly-abortions": "monthly and annual abortions by state since 2023, travel between states, and telehealth",
  "guttmacher-pregnancy-history": "abortions and abortion rates by state of residence, 1973–2020",
  "cdc-abortion-surveillance": "abortions reported by state health agencies, medication share, and patients' age, race and ethnicity, and weeks of gestation",
  "abortion-gestational-limits": "each state's gestational limit",
};

const DOBBS = { x: 2022 + 5 / 12, label: "Dobbs decision (June 2022)" };

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

function Explainers({ items }: { items: { title: ReactNode; body: ReactNode }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-950 dark:text-white">{it.title}</h3>
          <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{it.body}</div>
        </div>
      ))}
    </div>
  );
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
  const year = h.year ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">Abortion</h1>
        <FeatureList
          className="mt-4"
          items={[
            "Monthly counts since 2023",
            "Every state back to 1988",
            "National totals back to 1973",
            "Each state's current gestational limit",
          ]}
        />
      </header>

      <ChartCard
        title="Abortions per year since 1973"
        subtitle="Three sources · the line marks the Dobbs decision"
        source={SOURCES.history}
        table={seriesTable(d.longRun, "abortions")}
      >
        <TimeSeriesChart series={d.longRun} unit="abortions" height={340} markers={[DOBBS]} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      {/* ------------------------------------------------------------ Overview */}
      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
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
          <StatTile
            label="By telehealth (virtual-only)"
            unit="abortions"
            value={h.virtual.value}
            period={year}
            extra={h.virtual.share !== null ? ` · ${pct(h.virtual.share)}` : undefined}
            note="Pills mailed after an online consultation"
            spark={h.virtual.spark}
          />
          <StatTile
            label="Traveled to another state"
            unit="abortions"
            value={h.fromOther.value}
            period={year}
            extra={h.fromOther.share !== null ? ` · ${pct(h.fromOther.share)}` : undefined}
            note="Patients treated outside their home state"
          />
        </div>
        <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Key findings</h3>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {d.findings.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <Explainers
          items={[
            {
              title: "Two ways to count",
              body: (
                <>
                  Guttmacher surveys and models every provider, so its totals are complete. CDC compiles what state health agencies report;
                  California, Maryland, and New Hampshire don&apos;t report, so CDC&apos;s totals are lower.
                </>
              ),
            },
            {
              title: "Where an abortion is counted",
              body: (
                <>
                  Since 2023 counts are by <em>state of occurrence</em>: where the procedure happened or where pills were received. The 1973–2020
                  series counts by the patient&apos;s <em>state of residence</em>.
                </>
              ),
            },
            {
              title: "What isn't counted",
              body: (
                <>
                  Abortions under exceptions to total bans, and pills obtained outside the U.S. health system (for example from overseas
                  pharmacies or community networks), are not in Guttmacher&apos;s estimates.
                </>
              ),
            },
          ]}
        />
      </section>

      {/* ---------------------------------------------------------- Since 2023 */}
      <Section id="trend" title="Month by month since 2023" question="How many abortions are provided each month, and how does that split between states with and without total bans?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions per month" subtitle="United States · estimate" source={SOURCES.monthly} table={seriesTable(d.trend, "abortions")}>
            <TimeSeriesChart series={d.trend} unit="abortions" height={260} />
          </ChartCard>
          <ChartCard
            title="By state law"
            subtitle="Per month · states with total bans receive abortions mainly by telehealth"
            source={SOURCES.monthly}
            table={seriesTable(d.groups, "abortions")}
          >
            <TimeSeriesChart series={d.groups} unit="abortions" height={260} />
          </ChartCard>
        </div>
      </Section>

      {/* ---------------------------------------------------------- Since 1973 */}
      <Section id="long-run" title="Since 1973" question="How does today compare with the decades since Roe v. Wade?">
        <Prose>
          <p>
            Guttmacher&apos;s 1973–2020 series and its monthly study since 2023 both cover every state; there is no Guttmacher estimate
            for 2021–2022. CDC&apos;s count is lower because several states don&apos;t report to it.
          </p>
        </Prose>
        <ChartCard title="Abortion rate" subtitle="Per 1,000 women aged 15–44" source={SOURCES.history} table={seriesTable(d.rates, "per_1000")}>
          <TimeSeriesChart series={d.rates} unit="per_1000" height={280} />
        </ChartCard>
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
          Hover a state for the law&apos;s wording. Source:{" "}
          <Link href={SOURCES.limits.href} className="underline underline-offset-2">
            {SOURCES.limits.label}
          </Link>
        </p>
      </Section>

      {/* -------------------------------------------------------------- Travel */}
      {d.travel.year && (
        <Section id="travel" title="Travel between states" question="How many people cross state lines for an abortion, and where do they go?">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Residents who went to another state"
              subtitle={`${d.travel.year} · top 10 states`}
              source={SOURCES.monthly}
              table={rankedTable(d.travel.leftRanking, "State", "abortions")}
            >
              <RankedBars items={d.travel.leftRanking} unit="abortions" slot={2} />
            </ChartCard>
            <ChartCard title="Largest flows" subtitle={`${d.travel.year} · home state → state where provided`} source={SOURCES.monthly} table={rankedTable(d.travel.corridors, "Flow", "abortions")}>
              <RankedBars items={d.travel.corridors} unit="abortions" />
            </ChartCard>
          </div>
          <StateTravelPicker states={d.travel.states} year={d.travel.year} />
        </Section>
      )}

      {/* ---------------------------------------------------------- Telehealth */}
      <Section id="telehealth" title="Telehealth and method" question="How much abortion now happens by mail, and how common is medication abortion?">
        <Prose>
          <p>
            Medication abortion uses two drugs, mifepristone and misoprostol, which the FDA has approved through 10 weeks of pregnancy. Virtual-only providers
            prescribe them after an online consultation and mail them; in states with total bans, they do so under shield laws in the
            provider&apos;s own state.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions by virtual-only providers" subtitle="Per year · by state law where the pills were received" source={SOURCES.monthly} table={seriesTable(d.virtualSeries, "abortions")}>
            <TimeSeriesChart series={d.virtualSeries} type="column" unit="abortions" height={260} />
          </ChartCard>
          <ChartCard title="Medication abortions" subtitle="Share of abortions reported to CDC with a known method" source={SOURCES.cdc} table={seriesTable(d.medication, "percent")}>
            <TimeSeriesChart series={d.medication} type="column" unit="percent" height={260} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Patients */}
      {d.cdcYear && (
        <Section id="patients" title="Patients" question="Who obtains abortions, and how far along in pregnancy?">
          <Prose>
            <p>
              From CDC&apos;s {d.cdcYear} report, the latest published, among the reporting areas that record each characteristic.
              {d.later !== null && <> {formatValue(100 - d.later, "percent")} of abortions took place at 13 weeks of pregnancy or earlier; {formatValue(d.later, "percent")} after 13 weeks.</>}
            </p>
          </Prose>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="By age" subtitle={`${d.cdcYear} · share of abortions`} source={SOURCES.cdc} table={rankedTable(d.ages, "Age", "percent")}>
              <RankedBars items={d.ages} unit="percent" />
            </ChartCard>
            <ChartCard title="Abortion rate by race and ethnicity" subtitle={`${d.cdcYear} · per 1,000 women aged 15–44`} source={SOURCES.cdc} table={rankedTable(d.raceRates, "Group", "per_1000")}>
              <RankedBars items={d.raceRates} unit="per_1000" slot={2} />
            </ChartCard>
            <ChartCard title="Weeks of pregnancy" subtitle="Share of abortions, 13 weeks or earlier" source={SOURCES.cdc} table={seriesTable(d.weeks, "percent")} className="lg:col-span-2">
              <TimeSeriesChart series={d.weeks} unit="percent" height={240} />
            </ChartCard>
          </div>
        </Section>
      )}

      {/* -------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      {/* ------------------------------------------------------------- Sources */}
      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Open a dataset for its full methodology, coverage, and API access.{" "}
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>
        </p>
      </Section>
    </div>
  );
}
