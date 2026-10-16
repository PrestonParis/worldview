import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DemographicsForecast } from "@/components/demographics/demographics-forecast";
import { loadPopulationProfile } from "@/lib/demographics/profile";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Demographics | Worldview",
  description:
    "U.S., state, and city population composition by age, sex, race, religion, and sexual orientation, with projections to 2050; language spoken at home, education, income, poverty, and urban and rural population by state.",
};

const ACS = { label: "American Community Survey 1-year", href: "/datasets/census-acs1-social" };
const DECENNIAL = { label: "Decennial census", href: "/datasets/census-urban-rural" };

// Subjects with their own pages.
const RELATED = [
  { href: "/religion", title: "Religion", blurb: "Attendance, traditions and denominations, belief, and party lean by state" },
  { href: "/family", title: "Family", blurb: "Fertility, marriage and divorce, households, and the families children live in" },
  { href: "/immigration", title: "Immigration", blurb: "The foreign-born population, green cards, the border, and moves between states" },
];

export default async function DemographicsPage() {
  const profile = await loadPopulationProfile();
  const t = profile?.tiles;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl text-slate-950 dark:text-white">
          Demographic outlook
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-500 dark:text-slate-400">
          How America&apos;s population differs by place and how it may change. Past values are Census
          population estimates or survey estimates; values after the latest estimate are projections, shown as
          a range across scenarios. Each measure is published for different geographies: age, sex, and race go
          down to large cities, religion and sexual orientation to states.
        </p>
      </header>

      {/* The explorer reads ?state= / ?city= from the URL. */}
      <Suspense>
        <DemographicsForecast />
      </Suspense>

      {profile && t ? (
        <section id="characteristics" className="scroll-mt-28 space-y-6 pt-6">
          <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Language, education, and income</h2>
            <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">
              What languages Americans speak at home, how much schooling they have, what households earn, and how many live in cities.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Speak only English at home" unit="percent" value={t.englishOnly?.value ?? null} period={t.englishOnly?.period} note={t.limited ? `${t.limited.value.toFixed(1)}% speak English less than very well` : "People 5 and over"} />
            <StatTile label="Bachelor's degree or more" unit="percent" value={t.bachelors?.value ?? null} period={t.bachelors?.period} note="People 25 and over" />
            <StatTile label="Median household income" unit="usd" value={t.income?.value ?? null} period={t.income?.period} note={t.poverty ? `${t.poverty.value.toFixed(1)}% below the poverty line` : undefined} />
            <StatTile label="Living in urban areas" unit="percent" value={t.urban?.value ?? null} period={t.urban?.period} note="Decennial census" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Language spoken at home" subtitle="Share of people 5 and over" source={ACS} table={seriesTable(profile.language, "percent")}>
              <TimeSeriesChart series={profile.language} unit="percent" height={260} />
            </ChartCard>
            <ChartCard title="Educational attainment" subtitle="Share of people 25 and over" source={ACS} table={seriesTable(profile.education, "percent")}>
              <TimeSeriesChart series={profile.education} unit="percent" height={260} />
            </ChartCard>
            <ChartCard title="Median household income" subtitle="Nominal dollars of each year" source={ACS} table={seriesTable(profile.income, "usd")}>
              <TimeSeriesChart series={profile.income} unit="usd" height={260} />
            </ChartCard>
            <ChartCard title="Poverty" subtitle="Share of people below the poverty line" source={ACS} table={seriesTable(profile.poverty, "percent")}>
              <TimeSeriesChart series={profile.poverty} unit="percent" height={260} />
            </ChartCard>
            <ChartCard
              title="Urban and rural population"
              subtitle="People · 2000, 2010, 2020 censuses (urban definition changed in 2020)"
              source={DECENNIAL}
              table={seriesTable(profile.urbanRural, "people")}
              className="lg:col-span-2"
            >
              <TimeSeriesChart series={profile.urbanRural} type="column" unit="people" height={240} />
            </ChartCard>
          </div>
          <h3 className="pt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Across the states</h3>
          <StateExplorer metrics={profile.states.metrics} rows={profile.states.rows} />
        </section>
      ) : null}

      <section aria-labelledby="related" className="space-y-4 border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 id="related" className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          More about the population
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {RELATED.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="flex h-full flex-col rounded-2xl border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <span className="inline-flex items-center gap-1 font-semibold text-slate-950 dark:text-white">
                  {r.title}
                  <ArrowUpRight size={14} />
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{r.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
