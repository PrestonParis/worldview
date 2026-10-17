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
import { loadHousing } from "@/lib/housing/data";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Housing | Worldview",
  description:
    "Housing in the United States with data: home prices against incomes, mortgage rates and monthly payments, housing starts, rents and rent burden, homeownership, and every state.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["prices", "Prices"],
  ["affordability", "Affordability"],
  ["building", "Building"],
  ["renting", "Renting"],
  ["owning", "Owning"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  census: { label: "Census and HUD via FRED", href: "/datasets/fred-housing" },
  cs: { label: "S&P CoreLogic Case-Shiller and BLS via FRED", href: "/datasets/fred-housing" },
  freddie: { label: "Freddie Mac via FRED", href: "/datasets/fred-housing" },
  derived: { label: "Census, Freddie Mac via FRED", href: "/datasets/fred-housing" },
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-housing" },
};

const USES: Record<string, string> = {
  "fred-housing": "home prices, mortgage rates, housing starts, vacancy, rent inflation, and homeownership, plus state home prices and homeownership",
  "census-acs1-housing": "rents, rent burden, and home values, nationally and by state since 2008",
  "fred-economy": "median household income for price-to-income, and overall inflation",
  "census-acs1-social": "median household income by state",
};

export default async function HousingPage() {
  const d = await loadHousing();
  if (!d) return <IssueEmpty title="Housing" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Housing">
        What homes cost to buy and rent, what a mortgage costs each month, how many homes are being built, and who owns — nationally since the 1960s
        and by state.
      </IssueHeader>

      <ChartCard title="Median sales price of houses sold" subtitle="Quarterly, new and existing, since 1975" source={SOURCES.census} table={seriesTable(d.prices, "usd")}>
        <TimeSeriesChart series={d.prices} unit="usd" height={340} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Median house price"
            unit="usd"
            value={h.price.point?.value ?? null}
            period={h.price.point ? formatPeriod(h.price.point.period) : undefined}
            change={pctChange(h.price.point?.value, h.price.prior?.value)}
            compareLabel="vs a year earlier"
            spark={h.price.spark}
          />
          <StatTile label="30-year mortgage rate" unit="percent" value={h.rate.point?.value ?? null} period={h.rate.point ? formatPeriod(h.rate.point.period) : undefined} note="Monthly average" spark={h.rate.spark} />
          <StatTile label="Rent-burdened renters" unit="percent" value={h.burden.point?.value ?? null} period={h.burden.point?.period} note="Paying 30%+ of income on rent" spark={h.burden.spark} />
          <StatTile label="Homeownership rate" unit="percent" value={h.own.point?.value ?? null} period={h.own.point ? formatPeriod(h.own.point.period) : undefined} note="Share of households" spark={h.own.spark} />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="prices" title="Home prices" question="How much do homes cost, and how fast are prices rising?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Home prices, rents, and all prices" subtitle="12-month change" source={SOURCES.cs} table={seriesTable(d.priceGrowth, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.priceGrowth} unit="percent" height={280} />
          </ChartCard>
        </div>
      </Section>

      <Section id="affordability" title="Affordability" question="How do home prices and mortgage costs compare with what households earn?">
        <Prose>
          <p>
            The monthly payment is principal and interest on a 30-year fixed loan for 80% of the median sales price, at that quarter&apos;s average
            Freddie Mac rate. It leaves out taxes, insurance, and the down payment.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Home prices against incomes" subtitle="Median house price ÷ median household income" source={SOURCES.census} table={seriesTable(d.ratio, "times")}>
            <TimeSeriesChart series={d.ratio} unit="times" height={260} fromZero={false} />
          </ChartCard>
          <ChartCard title="Monthly payment on the median house" subtitle="Principal and interest, 20% down, nominal dollars" source={SOURCES.derived} table={seriesTable(d.paymentSeries, "usd")}>
            <TimeSeriesChart series={d.paymentSeries} unit="usd" height={260} />
          </ChartCard>
          <ChartCard title="30-year fixed mortgage rate" subtitle="Monthly average since 1971" source={SOURCES.freddie} table={seriesTable(d.mortgage, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.mortgage} unit="percent" height={260} />
          </ChartCard>
        </div>
      </Section>

      <Section id="building" title="Building" question="How many new homes are being built, and how many rentals sit empty?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Housing starts" subtitle="New privately owned units, seasonally adjusted annual rate" source={SOURCES.census} table={seriesTable(d.starts, "units")}>
            <TimeSeriesChart series={d.starts} unit="units" height={260} endLabels={false} />
          </ChartCard>
          <ChartCard title="Rental vacancy rate" subtitle="Share of rental units vacant and for rent" source={SOURCES.census} table={seriesTable(d.vacancy, "percent")}>
            <TimeSeriesChart series={d.vacancy} unit="percent" height={260} fromZero={false} />
          </ChartCard>
        </div>
      </Section>

      <Section id="renting" title="Renting" question="What does rent cost, and how many renters are stretched?">
        <Prose>
          <p>
            Gross rent is rent plus utilities. Housing is conventionally called unaffordable when it takes 30% or more of household income, and
            severely so at 50%.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Rent burden" subtitle="Share of renter households" source={SOURCES.acs} table={seriesTable(d.rentBurden, "percent")}>
            <TimeSeriesChart series={d.rentBurden} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Median gross rent" subtitle="Monthly, nominal dollars" source={SOURCES.acs} table={seriesTable(d.rent, "usd")}>
            <TimeSeriesChart series={d.rent} unit="usd" height={260} />
          </ChartCard>
        </div>
      </Section>

      <Section id="owning" title="Owning" question="What share of households own their home?">
        <ChartCard title="Homeownership rate" subtitle="Quarterly, share of occupied homes owned by the people living in them" source={SOURCES.census} table={seriesTable(d.ownership, "percent")}>
          <TimeSeriesChart series={d.ownership} unit="percent" height={260} fromZero={false} />
        </ChartCard>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Highest home values relative to income" subtitle="States, median home value ÷ median household income" source={SOURCES.acs} table={rankedTable(d.valueHigh, "State", "times")}>
            <RankedBars items={d.valueHigh} unit="times" />
          </ChartCard>
          <ChartCard title="Most rent-burdened renters" subtitle="States, share paying 30%+ of income" source={SOURCES.acs} table={rankedTable(d.burdenHigh, "State", "percent")}>
            <RankedBars items={d.burdenHigh} unit="percent" slot={2} />
          </ChartCard>
        </div>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Incomes, jobs, and inflation are on{" "}
          <Link href="/economy" className="underline underline-offset-2">
            Economy
          </Link>
          ; households and family types on{" "}
          <Link href="/family" className="underline underline-offset-2">
            Family
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
