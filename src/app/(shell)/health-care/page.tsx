import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { IssueEmpty, IssueHeader, KeyFindings, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { formatPeriod, pctChange } from "@/lib/format";
import { loadHealth } from "@/lib/health/data";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Health Care | Worldview",
  description:
    "Health care in the United States with data: the uninsured rate, Medicaid and Medicare coverage, drug overdose deaths by drug and state, and life expectancy and health spending compared with other countries.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["coverage", "Coverage"],
  ["overdoses", "Overdoses"],
  ["world", "Other countries"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-health" },
  cdc: { label: "CDC NCHS provisional overdose deaths", href: "/datasets/cdc-overdose-deaths" },
  wb: { label: "World Bank, from WHO and the UN", href: "/datasets/world-bank-health" },
};

const USES: Record<string, string> = {
  "census-acs1-health": "the uninsured rate and Medicaid and Medicare coverage, nationally and by state since 2009",
  "cdc-overdose-deaths": "overdose deaths by drug since 2015, and by state",
  "world-bank-health": "life expectancy, infant mortality, and health spending in the U.S. and other countries",
  "census-pep": "state populations for overdose death rates",
};

export default async function HealthCarePage() {
  const d = await loadHealth();
  if (!d) return <IssueEmpty title="Health care" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Health Care">
        Who has health insurance and through which programs, how many Americans die of drug overdoses, and how U.S. life expectancy and spending
        compare with other wealthy countries.
      </IssueHeader>

      <ChartCard title="Uninsured" subtitle="Share of the civilian noninstitutionalized population" source={SOURCES.acs} table={seriesTable(d.coverage, "percent")}>
        <TimeSeriesChart series={d.coverage} unit="percent" height={340} markers={[{ x: 2014, label: "ACA coverage begins" }]} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Uninsured" unit="percent" value={h.uninsured.point?.value ?? null} period={h.uninsured.point?.period} note="Share of people with no health insurance" spark={h.uninsured.spark} />
          <StatTile
            label="Overdose deaths"
            unit="deaths"
            value={h.overdoses.point?.value ?? null}
            period={h.overdoses.point ? `12 months to ${formatPeriod(h.overdoses.point.period)}` : undefined}
            change={pctChange(h.overdoses.point?.value, h.overdoses.prior?.value)}
            compareLabel="vs a year earlier"
            spark={h.overdoses.spark}
          />
          <StatTile label="Life expectancy at birth" unit="years" value={h.life.point?.value ?? null} period={h.life.point?.period} note="Years" spark={h.life.spark} />
          <StatTile label="Health spending" unit="percent" value={h.spend.point?.value ?? null} period={h.spend.point?.period} note="Share of GDP, public and private" spark={h.spend.spark} />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="coverage" title="Insurance coverage" question="How many Americans are uninsured, and how many rely on public programs?">
        <Prose>
          <p>
            Medicaid covers people with low incomes, and Medicare covers people 65 and over and some people with disabilities. People can hold more
            than one kind of coverage, so the shares overlap. The Affordable Care Act&apos;s marketplaces and Medicaid expansion took effect in 2014.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Public coverage" subtitle="Share of the population covered" source={SOURCES.acs} table={seriesTable(d.publicCoverage, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.publicCoverage} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Highest uninsured rates" subtitle="States" source={SOURCES.acs} table={rankedTable(d.uninsuredHigh, "State", "percent")} className="lg:col-span-2">
            <RankedBars items={d.uninsuredHigh} unit="percent" slot={2} />
          </ChartCard>
        </div>
      </Section>

      <Section id="overdoses" title="Drug overdoses" question="How many Americans die of overdoses, and which drugs are involved?">
        <Prose>
          <p>
            Each point counts deaths over the 12 months ending that month, which smooths out seasonal swings. Recent months use CDC&apos;s estimates
            for death records still under investigation. A death involving several drugs counts under each one.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Drug overdose deaths" subtitle="12 months ending each month" source={SOURCES.cdc} table={seriesTable(d.overdoses, "deaths")}>
            <TimeSeriesChart series={d.overdoses} unit="deaths" height={280} />
          </ChartCard>
          <ChartCard title="Deaths by drug involved" subtitle="12 months ending each month" source={SOURCES.cdc} table={seriesTable(d.byDrug, "deaths")}>
            <TimeSeriesChart series={d.byDrug} unit="deaths" height={280} />
          </ChartCard>
          <ChartCard title="Highest overdose death rates" subtitle="States, per 100,000 residents, latest 12 months" source={SOURCES.cdc} table={rankedTable(d.overdoseHigh, "State", "per_100k")} className="lg:col-span-2">
            <RankedBars items={d.overdoseHigh} unit="per_100k" slot={2} />
          </ChartCard>
        </div>
      </Section>

      <Section id="world" title="Compared with other countries" question="How do U.S. health outcomes and spending compare with other wealthy countries?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Life expectancy at birth" subtitle="Years, since 1980" source={SOURCES.wb} table={seriesTable(d.lifeCompare, "years")}>
            <TimeSeriesChart series={d.lifeCompare} unit="years" height={280} fromZero={false} />
          </ChartCard>
          <ChartCard title="Life expectancy by country" subtitle={d.lifeRank.period ?? ""} source={SOURCES.wb} table={rankedTable(d.lifeRank.items, "Country", "years")}>
            <RankedBars items={d.lifeRank.items} unit="years" limit={d.lifeRank.items.length} />
          </ChartCard>
          <ChartCard title="Health spending" subtitle="Share of GDP, since 2000" source={SOURCES.wb} table={seriesTable(d.spendCompare, "percent")}>
            <TimeSeriesChart series={d.spendCompare} unit="percent" height={280} />
          </ChartCard>
          <ChartCard title="Health spending per person" subtitle={`U.S. dollars, ${d.perPersonRank.period ?? ""}`} source={SOURCES.wb} table={rankedTable(d.perPersonRank.items, "Country", "usd")}>
            <RankedBars items={d.perPersonRank.items} unit="usd" limit={d.perPersonRank.items.length} />
          </ChartCard>
          <ChartCard title="Infant mortality" subtitle={`Deaths before age 1 per 1,000 live births, ${d.infantRank.period ?? ""}`} source={SOURCES.wb} table={rankedTable(d.infantRank.items, "Country", "per_1000")} className="lg:col-span-2">
            <RankedBars items={d.infantRank.items} unit="per_1000" slot={3} limit={d.infantRank.items.length} />
          </ChartCard>
        </div>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Medicare and Medicaid spending are on{" "}
          <Link href="/spending" className="underline underline-offset-2">
            Government Spending
          </Link>
          ; abortion on{" "}
          <Link href="/abortion" className="underline underline-offset-2">
            Abortion
          </Link>
          .{" "}
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>
        </p>
      </Section>
    </div>
  );
}
