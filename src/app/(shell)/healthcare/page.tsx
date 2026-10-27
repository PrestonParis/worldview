import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueEmpty, IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { formatPeriod, pctChange } from "@/lib/format";
import { loadHealth } from "@/lib/health/data";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Healthcare | Worldview",
  description:
    "Healthcare in the United States with data: the uninsured rate, Medicaid and Medicare coverage, drug overdose deaths by drug and state, and life expectancy and health spending compared with other countries.",
};

const SECTIONS = [
  ["coverage", "Coverage"],
  ["overdoses", "Overdoses"],
  ["world", "Other countries"],
  ["states", "States"],
] as const;

const SOURCE_SPECS = {
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-health" },
  cdc: { label: "CDC NCHS provisional overdose deaths", href: "/datasets/cdc-overdose-deaths" },
  wb: { label: "World Bank, from WHO and the UN", href: "/datasets/world-bank-health" },
} satisfies Record<string, SourceSpec>;

export default async function HealthCarePage() {
  const d = await loadHealth();
  if (!d) return <IssueEmpty title="Healthcare" />;
  const h = d.headline;

  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Healthcare" />

      <ChartCard title="Uninsured" subtitle="Share of the civilian noninstitutionalized population" source={SOURCES.acs} table={seriesTable(d.coverage, "percent")}>
        <TimeSeriesChart series={d.coverage} unit="percent" height={340} markers={[{ x: 2014, label: "ACA coverage begins" }]} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <Section id="coverage" title="Insurance coverage" question="How many Americans are uninsured, and how many rely on public programs?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Uninsured" unit="percent" value={h.uninsured.point?.value ?? null} period={h.uninsured.point?.period} note="Share of people with no health insurance" spark={h.uninsured.spark} />
        </div>
        <Prose>
          <p>
            Medicaid covers people with low incomes, and Medicare covers people 65 and over and some people with disabilities. People can hold more
            than one kind of coverage, so the shares overlap. The Affordable Care Act&apos;s marketplaces and Medicaid expansion took effect in 2014.
          </p>
        </Prose>
        <ChartCard title="Public coverage" subtitle="Share of the population covered" source={SOURCES.acs} table={seriesTable(d.publicCoverage, "percent")}>
          <TimeSeriesChart series={d.publicCoverage} unit="percent" height={260} />
        </ChartCard>
      </Section>

      <Section id="overdoses" title="Drug overdoses" question="How many Americans die of overdoses, and which drugs are involved?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Overdose deaths"
            unit="deaths"
            value={h.overdoses.point?.value ?? null}
            period={h.overdoses.point ? `12 months to ${formatPeriod(h.overdoses.point.period)}` : undefined}
            change={pctChange(h.overdoses.point?.value, h.overdoses.prior?.value)}
            compareLabel="vs a year earlier"
            spark={h.overdoses.spark}
          />
        </div>
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
        </div>
      </Section>

      <Section id="world" title="Compared with other countries" question="How do U.S. health outcomes and spending compare with other wealthy countries?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Life expectancy at birth" unit="years" value={h.life.point?.value ?? null} period={h.life.point?.period} note="Years" spark={h.life.spark} />
          <StatTile label="Health spending" unit="percent" value={h.spend.point?.value ?? null} period={h.spend.point?.period} note="Share of GDP, public and private" spark={h.spend.spark} />
        </div>
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

      <Section id="states" title="Across the states" question="How do the states compare?">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>
    </div>
  );
}
