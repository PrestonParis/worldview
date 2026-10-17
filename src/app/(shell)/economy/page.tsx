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
import { loadEconomy } from "@/lib/economy/data";
import { formatPeriod, formatSigned, formatValue, pctChange } from "@/lib/format";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Economy | Worldview",
  description:
    "The U.S. economy with data: unemployment and jobs since 1948, inflation, wages against prices, household income, GDP growth, interest rates, consumer sentiment, the minimum wage, and every state.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["jobs", "Jobs"],
  ["prices", "Prices"],
  ["wages", "Wages & income"],
  ["growth", "Growth & rates"],
  ["minimum-wage", "Minimum wage"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  bls: { label: "BLS via FRED", href: "/datasets/fred-economy" },
  bea: { label: "BEA via FRED", href: "/datasets/fred-economy" },
  census: { label: "Census Bureau via FRED", href: "/datasets/fred-economy" },
  fed: { label: "Federal Reserve via FRED", href: "/datasets/fred-economy" },
  umich: { label: "University of Michigan via FRED", href: "/datasets/fred-economy" },
  dol: { label: "Department of Labor via FRED", href: "/datasets/fred-economy" },
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-social" },
};

const USES: Record<string, string> = {
  "fred-economy": "every national chart, plus state unemployment, per capita income, and minimum wages",
  "census-acs1-social": "median household income and poverty by state",
};

const TARGET = { value: 2, label: "Fed target (2%)" };

export default async function EconomyPage() {
  const d = await loadEconomy();
  if (!d) return <IssueEmpty title="Economy" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Economy">
        Jobs, prices, paychecks, and growth — the official numbers from the Bureau of Labor Statistics, the Bureau of Economic Analysis, the
        Census Bureau, and the Federal Reserve, nationally since the 1940s and by state.
      </IssueHeader>

      <ChartCard title="Unemployment rate since 1948" subtitle="Monthly, seasonally adjusted · shaded: recessions" source={SOURCES.bls} table={seriesTable(d.unemployment, "percent")}>
        <TimeSeriesChart series={d.unemployment} unit="percent" height={340} markers={d.recessions(1948)} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Unemployment rate"
            unit="percent"
            value={h.unemployment.point?.value ?? null}
            period={h.unemployment.point ? formatPeriod(h.unemployment.point.period) : undefined}
            note="Seasonally adjusted"
            spark={h.unemployment.spark}
          />
          <StatTile
            label="Inflation"
            unit="percent"
            value={h.inflation.point?.value ?? null}
            period={h.inflation.point ? formatPeriod(h.inflation.point.period) : undefined}
            note="Consumer prices, past 12 months"
            spark={h.inflation.spark}
          />
          <StatTile
            label="Payroll jobs"
            unit="jobs"
            value={h.jobs.point?.value ?? null}
            period={h.jobs.point ? formatPeriod(h.jobs.point.period) : undefined}
            note={h.jobs.added !== null ? `${formatSigned(h.jobs.added, "jobs", { compact: true })} over 12 months` : undefined}
            spark={h.jobs.spark}
          />
          <StatTile
            label="Median household income"
            unit="usd"
            value={h.income.point?.value ?? null}
            period={h.income.point?.period}
            note="Adjusted for inflation"
            change={pctChange(h.income.point?.value, h.income.prior?.value)}
            compareLabel={h.income.prior ? `vs ${h.income.prior.period}` : undefined}
            spark={h.income.spark}
          />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="jobs" title="Jobs" question="How many Americans are working, and how many want work but can't find it?">
        <Prose>
          <p>
            The unemployment rate counts people without a job who looked for one in the past four weeks, as a share of everyone working or looking.
            People who have stopped looking are not counted as unemployed, so the share of prime-age adults (25–54) with a job is a useful second
            measure. Shaded bands are recessions as dated by the National Bureau of Economic Research.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Nonfarm payroll jobs" subtitle="Seasonally adjusted, since 1970" source={SOURCES.bls} table={seriesTable(d.payrolls, "jobs")}>
            <TimeSeriesChart series={d.payrolls} unit="jobs" height={280} markers={d.recessions(1970)} endLabels={false} />
          </ChartCard>
          <ChartCard title="Who is working" subtitle="Share of the population" source={SOURCES.bls} table={seriesTable(d.participation, "percent")}>
            <TimeSeriesChart series={d.participation} unit="percent" height={280} fromZero={false} />
          </ChartCard>
        </div>
      </Section>

      <Section id="prices" title="Prices" question="How fast are prices rising?">
        <Prose>
          <p>
            Inflation here is the change in the Consumer Price Index over the previous 12 months. Core inflation leaves out food and energy, whose
            prices swing more. The Federal Reserve targets 2% inflation, measured with a related index (PCE).
          </p>
        </Prose>
        <ChartCard title="Inflation since 1960" subtitle="12-month change in consumer prices" source={SOURCES.bls} table={seriesTable(d.inflation, "percent")}>
          <TimeSeriesChart series={d.inflation} unit="percent" height={300} reference={TARGET} markers={d.recessions(1960)} />
        </ChartCard>
      </Section>

      <Section id="wages" title="Wages and income" question="Are paychecks keeping up with prices?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Wage growth against inflation" subtitle="12-month change, private-sector hourly pay and consumer prices" source={SOURCES.bls} table={seriesTable(d.wagesVsPrices, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.wagesVsPrices} unit="percent" height={280} />
          </ChartCard>
          <ChartCard title="Real median weekly earnings" subtitle="Full-time workers, in 1982–84 dollars" source={SOURCES.bls} table={seriesTable(d.weekly, "usd")}>
            <TimeSeriesChart series={d.weekly} unit="usd" height={260} fromZero={false} />
          </ChartCard>
          <ChartCard title="Real median household income" subtitle="Adjusted for inflation to latest-year dollars" source={SOURCES.census} table={seriesTable(d.householdIncome, "usd")}>
            <TimeSeriesChart series={d.householdIncome} unit="usd" height={260} fromZero={false} />
          </ChartCard>
        </div>
      </Section>

      <Section id="growth" title="Growth, interest rates, and confidence" question="How fast is the economy growing, what does borrowing cost, and how do consumers feel?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Real GDP growth" subtitle="Quarterly, at an annual rate, since 2000" source={SOURCES.bea} table={seriesTable(d.gdpGrowth, "percent")}>
            <TimeSeriesChart series={d.gdpGrowth} type="column" unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Real GDP per person" subtitle="Chained 2017 dollars" source={SOURCES.bea} table={seriesTable(d.gdpPerPerson, "usd")}>
            <TimeSeriesChart series={d.gdpPerPerson} unit="usd" height={260} markers={d.recessions(1947)} />
          </ChartCard>
          <ChartCard title="Federal funds rate" subtitle="The Fed's policy rate, monthly average" source={SOURCES.fed} table={seriesTable(d.rates, "percent")}>
            <TimeSeriesChart series={d.rates} unit="percent" height={260} markers={d.recessions(1954)} />
          </ChartCard>
          <ChartCard title="Consumer sentiment" subtitle="University of Michigan index, 1966 = 100" source={SOURCES.umich} table={seriesTable(d.sentiment, "index")}>
            <TimeSeriesChart series={d.sentiment} unit="index" height={260} fromZero={false} markers={d.recessions(1978)} />
          </ChartCard>
        </div>
      </Section>

      <Section id="minimum-wage" title="Minimum wage" question="What is the minimum wage worth, and how much higher do states set it?">
        <Prose>
          <p>
            The federal minimum applies everywhere; states and some cities set higher ones. Five states (Alabama, Louisiana, Mississippi, South
            Carolina, and Tennessee) have no minimum wage law of their own, and a few set rates below the federal level, so the federal{" "}
            {formatValue(d.minimumWage[0].points.at(-1)?.value, "usd_cents")} applies there.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Federal minimum wage" subtitle="Per hour, nominal and adjusted for inflation" source={SOURCES.dol} table={seriesTable(d.minimumWage, "usd_cents")}>
            <TimeSeriesChart series={d.minimumWage} unit="usd_cents" height={280} />
          </ChartCard>
          <ChartCard title="Highest minimum wages" subtitle="States, per hour, January 1" source={SOURCES.dol} table={rankedTable(d.minWageHigh, "State", "usd_cents")}>
            <RankedBars items={d.minWageHigh} unit="usd_cents" />
          </ChartCard>
        </div>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Highest unemployment" subtitle="States, latest month" source={SOURCES.bls} table={rankedTable(d.unemploymentHigh, "State", "percent")}>
            <RankedBars items={d.unemploymentHigh} unit="percent" slot={2} />
          </ChartCard>
          <ChartCard title="Highest median household income" subtitle="States" source={SOURCES.acs} table={rankedTable(d.incomeHigh, "State", "usd")}>
            <RankedBars items={d.incomeHigh} unit="usd" />
          </ChartCard>
        </div>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Federal taxes, spending, and debt are on{" "}
          <Link href="/spending" className="underline underline-offset-2">
            Government Spending
          </Link>
          ; home prices and rents on{" "}
          <Link href="/housing" className="underline underline-offset-2">
            Housing
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
