import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueHeader } from "@/components/data/issue-layout";
import { DemographicsForecast } from "@/components/demographics/demographics-forecast";
import { loadPopulationProfile } from "@/lib/demographics/profile";
import { loadRaceProfile } from "@/lib/demographics/race";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Demographics | Worldview",
  description:
    "U.S., state, and city population composition by age, sex, race, religion, and sexual orientation, with projections to 2050; language spoken at home, education, income, poverty, and urban and rural population by state.",
};

const ACS = { label: "American Community Survey 1-year", href: "/datasets/census-acs1-social" };
const PEP_RACE = { label: "Census population estimates", href: "/datasets/census-pep-race" };
const PROJECTIONS = { label: "Census 2023 national projections", href: "/datasets/census-projections" };
const ANCESTRY = { label: "American Community Survey 1-year", href: "/datasets/census-acs1-ancestry" };
const GALLUP_LGBT = { label: "Gallup", href: "/datasets/gallup-lgbt" };

const rankedTable = (items: RankedItem[], unit = "Share of population (%)") => ({
  columns: ["Group", unit],
  rows: items.map((i) => [i.label, i.value]),
});

function SectionHeading({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="max-w-3xl scroll-mt-28 border-t border-slate-200 pt-10 dark:border-slate-800">
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">{children}</p>
    </div>
  );
}

function RaceSection({ race }: { race: NonNullable<Awaited<ReturnType<typeof loadRaceProfile>>> }) {
  const r = race.tiles;
  return (
    <section id="race" className="space-y-6 pt-6">
      <SectionHeading title="Race and ethnicity">
        How the population&apos;s racial and Hispanic makeup has changed since 1990, where the Census Bureau projects it to go, and how each state compares.
      </SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="White, non-Hispanic"
          unit="percent"
          value={r.whiteNh?.value ?? null}
          period={r.whiteNh?.period}
          note={r.whiteNh1990 ? `${r.whiteNh1990.value.toFixed(1)}% in ${r.whiteNh1990.period}` : undefined}
        />
        <StatTile label="Hispanic" unit="percent" value={r.hispanic?.value ?? null} period={r.hispanic?.period} note="Of any race" />
        <StatTile
          label="Projected year non-Hispanic whites fall under 50%"
          unit="year"
          value={r.crossover?.value ?? null}
          period="Census 2023 projections, main series"
          note={r.crossoverHigh && r.crossoverLow ? `${r.crossoverHigh.value} with high immigration, ${r.crossoverLow.value} with low` : undefined}
        />
        <StatTile
          label="Median age"
          unit="years"
          value={r.medianAge?.value ?? null}
          period={r.medianAge?.period}
          note={
            r.medianAgeWhiteNh && r.medianAgeHispanic
              ? `White non-Hispanic ${r.medianAgeWhiteNh.value.toFixed(1)}, Hispanic ${r.medianAgeHispanic.value.toFixed(1)}`
              : undefined
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Race and Hispanic origin"
          subtitle="Share of the population, July 1 · non-Hispanic black, Asian and multiracial shares start in 2000"
          source={PEP_RACE}
          table={seriesTable(race.composition, "percent")}
        >
          <TimeSeriesChart series={race.composition} unit="percent" height={280} />
        </ChartCard>
        <ChartCard title="Projected race and Hispanic origin" subtitle="Share of the population, main series" source={PROJECTIONS} table={seriesTable(race.projected, "percent")}>
          <TimeSeriesChart series={race.projected} unit="percent" height={280} reference={{ value: 50, label: "50%" }} />
        </ChartCard>
        <ChartCard
          title="Non-Hispanic white share under each immigration scenario"
          subtitle="Share of the population · scenarios differ only in net immigration"
          source={PROJECTIONS}
          table={seriesTable(race.scenarios, "percent")}
        >
          <TimeSeriesChart series={race.scenarios} unit="percent" height={260} fromZero={false} reference={{ value: 50, label: "50%" }} />
        </ChartCard>
        <ChartCard title="Median age by race and Hispanic origin" subtitle="Years" source={PEP_RACE} table={seriesTable(race.medianAge, "years")}>
          <TimeSeriesChart series={race.medianAge} unit="years" height={260} fromZero={false} />
        </ChartCard>
      </div>
      <h3 className="pt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Across the states</h3>
      <StateExplorer metrics={race.states.metrics} rows={race.states.rows} />

      {race.ancestry.items.length || race.hispanicOrigin.items.length ? (
        <>
          <h3 className="pt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Ancestry</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Largest ancestries"
              subtitle={`Share of the population reporting each ancestry · ${race.ancestry.period} · up to two per person`}
              source={ANCESTRY}
              table={rankedTable(race.ancestry.items)}
            >
              <RankedBars items={race.ancestry.items} unit="percent" limit={15} />
            </ChartCard>
            <ChartCard
              title="Hispanic origin"
              subtitle={`Share of the population · ${race.hispanicOrigin.period}`}
              source={ANCESTRY}
              table={rankedTable(race.hispanicOrigin.items)}
            >
              <RankedBars items={race.hispanicOrigin.items} unit="percent" slot={2} limit={15} />
            </ChartCard>
          </div>
        </>
      ) : null}

      {r.lgbtq ? (
        <>
          <h3 className="pt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">LGBTQ+ identification</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Adults identifying as LGBTQ+" subtitle="Share of U.S. adults · each identity from 2020" source={GALLUP_LGBT} table={seriesTable(race.lgbtTrend, "percent")}>
              <TimeSeriesChart series={race.lgbtTrend} unit="percent" height={260} />
            </ChartCard>
            <ChartCard
              title="LGBTQ+ identification by group"
              subtitle={`Share of each group · ${race.lgbtGroupsPeriod}`}
              source={GALLUP_LGBT}
              table={rankedTable(race.lgbtByGroup.flatMap((g) => g.items.map((i) => ({ ...i, label: `${g.section}: ${i.label}` }))), "Identify as LGBTQ+ (%)")}
            >
              <div className="space-y-5">
                {race.lgbtByGroup.map((g) => (
                  <div key={g.section}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.section}</p>
                    <RankedBars items={g.items} unit="percent" />
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      ) : null}
    </section>
  );
}
const DECENNIAL = { label: "Decennial census", href: "/datasets/census-urban-rural" };

// Subjects with their own pages.
const RELATED = [
  { href: "/religion", title: "Religion", blurb: "Attendance, traditions and denominations, belief, and party lean by state" },
  { href: "/family", title: "Family", blurb: "Fertility, marriage and divorce, households, and the families children live in" },
  { href: "/immigration", title: "Immigration", blurb: "The foreign-born population, green cards, the border, and moves between states" },
];

export default async function DemographicsPage() {
  const [profile, race] = await Promise.all([loadPopulationProfile(), loadRaceProfile()]);
  const t = profile?.tiles;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <IssueHeader title="Demographic Outlook" />

      {/* The explorer reads ?state= / ?city= from the URL. */}
      <Suspense>
        <DemographicsForecast />
      </Suspense>

      {race ? <RaceSection race={race} /> : null}

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
