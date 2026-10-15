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
import { loadEnergy } from "@/lib/energy/data";
import { formatPeriod, formatSigned, pctChange } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Energy & Climate | Worldview",
  description:
    "Energy and climate in the United States with data: gasoline, electricity, oil, and natural gas prices, where U.S. electricity comes from, CO₂ emissions compared with China, the EU, and India, and U.S. and state temperatures since 1895.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["prices", "Prices"],
  ["electricity", "Electricity"],
  ["emissions", "Emissions"],
  ["temperature", "Temperature"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  prices: { label: "BLS and EIA via FRED", href: "/datasets/fred-energy-prices" },
  owid: { label: "Our World in Data (Ember, Energy Institute)", href: "/datasets/owid-energy" },
  gcp: { label: "Our World in Data (Global Carbon Project)", href: "/datasets/owid-energy" },
  noaa: { label: "NOAA National Centers for Environmental Information", href: "/datasets/noaa-climate" },
};

const USES: Record<string, string> = {
  "fred-energy-prices": "gasoline, electricity, crude oil, and natural gas prices",
  "owid-energy": "the electricity mix and CO₂ emissions by country",
  "noaa-climate": "average temperature for the contiguous U.S. and each state since 1895",
};

export default async function EnergyPage() {
  const d = await loadEnergy();
  if (!d) return <IssueEmpty title="Energy & Climate" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Energy & Climate">
        What Americans pay for gasoline and electricity, where the country&apos;s power comes from, how its carbon emissions compare with the rest of the
        world, and how temperatures have changed since 1895.
      </IssueHeader>

      <ChartCard title="U.S. electricity by source" subtitle="Share of generation, since 1985" source={SOURCES.owid} table={seriesTable(d.mix, "percent")}>
        <TimeSeriesChart series={d.mix} unit="percent" height={340} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Gasoline, per gallon"
            unit="usd_cents"
            value={h.gas.point?.value ?? null}
            period={h.gas.point ? formatPeriod(h.gas.point.period) : undefined}
            change={pctChange(h.gas.point?.value, h.gas.prior?.value)}
            compareLabel="vs a year earlier"
            spark={h.gas.spark}
          />
          <StatTile label="Low-carbon electricity" unit="percent" value={h.lowCarbon.point?.value ?? null} period={h.lowCarbon.point?.period} note="Nuclear and renewables, share of generation" spark={h.lowCarbon.spark} />
          <StatTile label="CO₂ emissions" unit="tonnes" value={h.co2.point?.value ?? null} period={h.co2.point?.period} note="Fossil fuels and industry, tonnes" spark={h.co2.spark} />
          <StatTile
            label="Average temperature"
            unit="deg_f"
            value={h.temp.point?.value ?? null}
            period={h.temp.point?.period}
            note={h.temp.anomaly !== null ? `${formatSigned(h.temp.anomaly, "deg_f")} vs 20th-century average` : "Contiguous U.S."}
            spark={h.temp.spark}
          />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="prices" title="Energy prices" question="What do Americans pay for gasoline and electricity, compared with the past?">
        <Prose>
          <p>Prices in today&apos;s dollars are adjusted for inflation with the Consumer Price Index, so a 1980 price can be compared with today&apos;s.</p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Gasoline" subtitle="Regular, per gallon, U.S. city average" source={SOURCES.prices} table={seriesTable(d.gas, "usd_cents")}>
            <TimeSeriesChart series={d.gas} unit="usd_cents" height={280} />
          </ChartCard>
          <ChartCard title="Electricity" subtitle="Per kilowatt-hour, U.S. city average" source={SOURCES.prices} table={seriesTable(d.electricity, "cents")}>
            <TimeSeriesChart series={d.electricity} unit="cents" height={280} />
          </ChartCard>
          <ChartCard title="Crude oil" subtitle="Monthly average spot price" source={SOURCES.prices} table={seriesTable(d.oil, "usd_cents")}>
            <TimeSeriesChart series={d.oil} unit="usd_cents" height={240} />
          </ChartCard>
          <ChartCard title="Natural gas" subtitle="Monthly average spot price" source={SOURCES.prices} table={seriesTable(d.natgas, "usd_cents")}>
            <TimeSeriesChart series={d.natgas} unit="usd_cents" height={240} />
          </ChartCard>
        </div>
      </Section>

      <Section id="electricity" title="Electricity" question="Where does American electricity come from?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Wind and solar" subtitle="Share of generation, since 2000" source={SOURCES.owid} table={seriesTable(d.windSolar, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.windSolar} unit="percent" height={280} />
          </ChartCard>
        </div>
      </Section>

      <Section id="emissions" title="Carbon emissions" question="How much CO₂ does the U.S. emit, and how does that compare with other countries?">
        <Prose>
          <p>Emissions are from burning fossil fuels and from industry (mainly cement), excluding land-use change.</p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="CO₂ emissions" subtitle="Tonnes per year, since 1950" source={SOURCES.gcp} table={seriesTable(d.emissions, "tonnes")}>
            <TimeSeriesChart series={d.emissions} unit="tonnes" height={280} />
          </ChartCard>
          <ChartCard title="CO₂ emissions per person" subtitle={`Tonnes, ${d.perCapitaYear ?? ""}`} source={SOURCES.gcp} table={rankedTable(d.perCapita, "Country", "tonnes_per_person")}>
            <RankedBars items={d.perCapita} unit="tonnes_per_person" limit={d.perCapita.length} />
          </ChartCard>
          <ChartCard title="U.S. share of global emissions" subtitle="Share of the world's CO₂ from fossil fuels and industry" source={SOURCES.gcp} table={seriesTable(d.share, "percent")} className="lg:col-span-2">
            <TimeSeriesChart series={d.share} unit="percent" height={240} />
          </ChartCard>
        </div>
      </Section>

      <Section id="temperature" title="Temperature" question="How have U.S. temperatures changed since records began?">
        <ChartCard title="Average temperature, contiguous U.S." subtitle="Annual, °F · dashed: 1901–2000 average" source={SOURCES.noaa} table={seriesTable(d.temperature, "deg_f")}>
          <TimeSeriesChart
            series={d.temperature}
            unit="deg_f"
            height={300}
            fromZero={false}
            reference={d.baseline !== null ? { value: d.baseline, label: "20th-century average" } : undefined}
          />
        </ChartCard>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <ChartCard title="Most warming" subtitle="States, last 10 years against the 20th-century average, °F" source={SOURCES.noaa} table={rankedTable(d.warmingHigh, "State", "deg_f")}>
          <RankedBars items={d.warmingHigh} unit="deg_f" slot={2} />
        </ChartCard>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Inflation and household budgets are on{" "}
          <Link href="/economy" className="underline underline-offset-2">
            Economy
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
