import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard, type TableView } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { formatValue } from "@/lib/format";
import { loadImmigration } from "@/lib/immigration/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Immigration | Worldview",
  description:
    "U.S. immigration in numbers: border encounters, green cards, naturalizations, refugees and asylum, net international migration, and ICE detention — nationally and by state.",
};

const SECTIONS = [
  ["border", "Border"],
  ["legal", "Legal immigration"],
  ["humanitarian", "Refugees & asylum"],
  ["population", "Population"],
  ["detention", "Detention"],
  ["states", "By state"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  ice: { label: "ICE Detention Statistics", href: "/datasets/ice-detention" },
};

function seriesTable(series: Series[], unit: string): TableView {
  const xs = [...new Map(series.flatMap((s) => s.points.map((p) => [p.x, p.label] as const))).entries()].sort((a, b) => b[0] - a[0]);
  const maps = series.map((s) => new Map(s.points.map((p) => [p.x, p.value])));
  return {
    columns: ["Period", ...series.map((s) => s.label)],
    rows: xs.map(([x, label]) => [label, ...maps.map((m) => formatValue(m.get(x), unit))]),
  };
}

function rankedTable(items: RankedItem[], label: string, unit: string): TableView {
  return { columns: [label, "Value"], rows: items.map((i) => [i.label, formatValue(i.value, unit)]) };
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export default async function ImmigrationPage() {
  const d = await loadImmigration();
  const { stats } = d;
  const single = (id: string, label: string, points: Series["points"], slot: 1 | 2 | 3 = 1): Series[] => [{ id, label, slot, points }];

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">United States</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Immigration</h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          Who arrives, how, and where they settle — border encounters, green cards, naturalizations, refugees and asylum,
          population change, and detention, from the agencies that count them.
        </p>
      </header>

      <nav aria-label="Sections" className="sticky top-14 z-10 -mx-8 overflow-x-auto border-y border-slate-100 bg-white/90 px-8 py-2 backdrop-blur dark:border-slate-900 dark:bg-slate-950/90">
        <ul className="flex gap-1 text-sm whitespace-nowrap">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="rounded-md px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.encounters && (
          <StatTile label="Border encounters, latest month" unit="encounters" value={stats.encounters.value} period={stats.encounters.period}
            change={stats.encounters.change} compareLabel={stats.encounters.compare} spark={stats.encounters.spark} />
        )}
        {stats.encounters12 && (
          <StatTile label="Border encounters, last 12 months" unit="encounters" value={stats.encounters12.value} period={stats.encounters12.period}
            change={stats.encounters12.change} compareLabel={stats.encounters12.compare} />
        )}
        {stats.netMigration && (
          <StatTile label="Net international migration" unit="people" value={stats.netMigration.value} period={stats.netMigration.period}
            change={stats.netMigration.change} compareLabel={stats.netMigration.compare} spark={stats.netMigration.spark} />
        )}
        {stats.lpr && (
          <StatTile label="New lawful permanent residents" unit="people" value={stats.lpr.value} period={stats.lpr.period}
            change={stats.lpr.change} compareLabel={stats.lpr.compare} spark={stats.lpr.spark} />
        )}
        {stats.naturalizations && (
          <StatTile label="New U.S. citizens (naturalized)" unit="people" value={stats.naturalizations.value} period={stats.naturalizations.period}
            change={stats.naturalizations.change} compareLabel={stats.naturalizations.compare} spark={stats.naturalizations.spark} />
        )}
        {stats.detention && (
          <StatTile label="Held in ICE detention, daily average" unit="people" value={stats.detention.value} period={stats.detention.period}
            change={stats.detention.change} compareLabel={stats.detention.compare} spark={stats.detention.spark} />
        )}
      </div>

      <Section
        id="border"
        title="At the border"
        intro="CBP encounters combine Border Patrol apprehensions between ports of entry with people deemed inadmissible at ports. They count events, not people — someone stopped twice counts twice. From March 2020 to May 2023, many encounters ended in Title 42 public-health expulsions instead of processing under immigration law."
      >
        <ChartCard
          title="Monthly border encounters"
          subtitle="Nationwide, by legal authority"
          source={SOURCES.cbp}
          table={seriesTable(d.border.monthly, "encounters")}
        >
          <TimeSeriesChart
            series={d.border.monthly}
            type="column"
            unit="encounters"
            height={300}
            markers={[
              { x: 2021.0, label: "Biden term" },
              { x: 2023 + 4 / 12, label: "Title 42 ends" },
              { x: 2025.0, label: "Trump term" },
            ]}
          />
        </ChartCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Encounters by citizenship" subtitle={d.border.window} source={SOURCES.cbp} table={rankedTable(d.border.byCitizenship, "Citizenship", "encounters")}>
            <RankedBars items={d.border.byCitizenship} unit="encounters" />
          </ChartCard>
          <ChartCard title="Encounters by state" subtitle={`${d.border.window} · state of the encountering office`} source={SOURCES.cbp} table={rankedTable(d.border.byState, "State", "encounters")}>
            <RankedBars items={d.border.byState} unit="encounters" />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="legal"
        title="Legal immigration"
        intro="A lawful permanent resident (green card holder) can live and work in the U.S. indefinitely and, usually after five years, apply to naturalize. Most new green cards go to people already in the country who adjust their status — often through a U.S.-citizen spouse or parent — rather than to new arrivals."
      >
        <ChartCard title="New lawful permanent residents since 1820" subtitle="Per fiscal year" source={SOURCES.yearbook} table={seriesTable(single("lpr", "New LPRs", d.legal.lprHistory), "people")}>
          <TimeSeriesChart series={single("lpr", "New lawful permanent residents", d.legal.lprHistory)} unit="people" height={280} />
        </ChartCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Where new green-card holders were" subtitle="Already in the U.S. vs. arriving from abroad, per fiscal year" source={SOURCES.yearbook} table={seriesTable(d.legal.lprSplit, "people")}>
            <TimeSeriesChart series={d.legal.lprSplit} type="column" unit="people" />
          </ChartCard>
          <ChartCard title="Naturalizations since 1907" subtitle="Persons naturalized per fiscal year" source={SOURCES.yearbook} table={seriesTable(single("n", "Naturalized", d.legal.naturalizations), "people")}>
            <TimeSeriesChart series={single("natz", "Persons naturalized", d.legal.naturalizations)} unit="people" />
          </ChartCard>
          <ChartCard title="Green cards by class of admission" subtitle={d.legal.byClass.period} source={SOURCES.yearbook} table={rankedTable(d.legal.byClass.items, "Class", "people")}>
            <RankedBars items={d.legal.byClass.items} unit="people" />
          </ChartCard>
          <ChartCard title="Green cards by country of birth" subtitle={`${d.legal.byCountry.period} · top 10`} source={SOURCES.yearbook} table={rankedTable(d.legal.byCountry.items, "Country", "people")}>
            <RankedBars items={d.legal.byCountry.items} unit="people" />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="humanitarian"
        title="Refugees and asylum"
        intro="Refugees are vetted and approved abroad, then resettled under an annual ceiling set by the president. Asylum is sought from inside the U.S. or at the border — granted affirmatively by USCIS, or defensively by an immigration judge during removal proceedings."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Refugee arrivals and asylum grants" subtitle="Per fiscal year" source={SOURCES.yearbook} table={seriesTable(d.humanitarian.series, "people")}>
            <TimeSeriesChart series={d.humanitarian.series} unit="people" />
          </ChartCard>
          <ChartCard title="Refugee arrivals by nationality" subtitle={`${d.humanitarian.refugeesByCountry.period} · top 10`} source={SOURCES.yearbook} table={rankedTable(d.humanitarian.refugeesByCountry.items, "Nationality", "people")}>
            <RankedBars items={d.humanitarian.refugeesByCountry.items} unit="people" slot={1} />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="population"
        title="Population change"
        intro="The Census Bureau's net international migration counts everyone who moves across the U.S. border in either direction — citizens and noncitizens, regardless of legal status — over the 12 months ending July 1."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Net international migration" subtitle="Year ending July 1" source={SOURCES.pep} table={seriesTable(single("m", "Net international migration", d.population.netMigration), "people")}>
            <TimeSeriesChart series={single("mig", "Net international migration", d.population.netMigration)} type="column" unit="people" />
          </ChartCard>
          <ChartCard title="Foreign-born share of the population" subtitle="Annual estimate" source={SOURCES.acs} table={seriesTable(single("fb", "Foreign-born share", d.population.foreignBornShare), "percent")}>
            {d.population.foreignBornShare.length ? (
              <TimeSeriesChart series={single("fb", "Foreign-born share", d.population.foreignBornShare)} unit="percent" />
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">ACS foreign-born series is waiting on its import.</p>
            )}
          </ChartCard>
        </div>
      </Section>

      <Section
        id="detention"
        title="Immigration detention"
        intro="Average daily population in ICE detention facilities over each fiscal year (the current year is the average so far). Conviction status follows ICE's threat levels, which are assigned only to people with a criminal conviction on record."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Average daily detained population" subtitle="By criminal conviction, per fiscal year" source={SOURCES.ice} table={seriesTable(d.detention.series, "people")}>
            <TimeSeriesChart series={d.detention.series} type="column" unit="people" />
          </ChartCard>
          <ChartCard title="Largest detention facilities" subtitle={`${d.detention.facilities.period} · average daily population`} source={SOURCES.ice} table={rankedTable(d.detention.facilities.items, "Facility", "people")}>
            <RankedBars items={d.detention.facilities.items} unit="people" />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="states"
        title="Across the states"
        intro="Every measure above, state by state. Pick a measure to map it; sort the table by any column."
      >
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section
        id="sources"
        title="Sources"
        intro="Every figure on this page comes from the datasets below, refreshed automatically from each publisher. Institutions can publish their own datasets here with permission."
      >
        <DatasetList datasets={d.datasets} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>{" "}
          · <Link href="/datasets/publish" className="underline underline-offset-2">Publish your institution&apos;s data</Link>
        </p>
      </Section>
    </div>
  );
}
