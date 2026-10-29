import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadImmigration } from "@/lib/immigration/data";
import { loadCrime } from "@/lib/crime/data";
import { listDatasets } from "@/lib/db/stats";
import { getDemographicSeries } from "@/lib/demographics/forecast";
import { countEntities, listDossierProfiles } from "@/lib/db/entities";
import { countEdges } from "@/lib/db/edges";
import { countContributions, listContributionTotalsByCurrency } from "@/lib/db/contributions";
import { listCycles } from "@/lib/db/election-overview";
import { loadContributionSummary } from "@/lib/db/moneyOverview";
import { getNavPreviews } from "@/lib/nav-previews";
import { loadShowcase } from "@/lib/home/showcase";
import { formatPeriod } from "@/lib/format";
import { NET_MIGRATION_2026, VIOLENT_CRIME_2026 } from "@/lib/projections";
import { loadStatePaths } from "@/lib/geo/state-paths";
import { Hero, type SnapshotMetric } from "@/components/home/hero";
import type { StateMeasure } from "@/components/home/state-map";
import { ToolModules, type PlatformFacts, type TrendEvent } from "@/components/home/tool-modules";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

const settle = <T,>(promise: Promise<T>) => promise.then((value) => value, () => null);

async function loadStatePopulations() {
  const file = await readFile(path.join(process.cwd(), "public/data/demographics/states.json"), "utf8");
  const { regions } = JSON.parse(file) as { regions: { abbr: string; population: number }[] };
  return regions;
}

const numbers = (values: (number | null)[]) => values.filter((value): value is number => value !== null && Number.isFinite(value));

function shiftMonth(period: string, delta: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function timelineEvent(start: string | undefined, end: string | undefined, at: string, label: string): TrendEvent[] {
  const value = (period: string) => {
    const match = /^(\d{4})(?:-(\d{2}))?/.exec(period);
    return match ? Number(match[1]) * 12 + Number(match[2] ?? 1) - 1 : NaN;
  };
  if (!start || !end) return [];
  const [a, b, x] = [value(start), value(end), value(at)];
  if (![a, b, x].every(Number.isFinite) || x < a || x > b || a === b) return [];
  return [{ position: (x - a) / (b - a), label }];
}

export default async function Home() {
  const [
    immigration,
    crime,
    datasets,
    statePopulations,
    stateMap,
    entityCount,
    edgeCount,
    dossiers,
    contributionCount,
    contributionTotals,
    cycles,
    moneySummary,
    previews,
  ] = await Promise.all([
    settle(loadImmigration()),
    settle(loadCrime()),
    settle(listDatasets()),
    settle(loadStatePopulations()),
    settle(loadStatePaths()),
    settle(countEntities()),
    settle(countEdges()),
    settle(listDossierProfiles(6)),
    settle(countContributions()),
    settle(listContributionTotalsByCurrency()),
    settle(listCycles()),
    settle(loadContributionSummary(null)),
    getNavPreviews(),
  ]);

  const race = getDemographicSeries("race");
  const observed = race.points.find((point) => point.year === race.observedThrough);
  const encounter = immigration?.stats.encounters;
  const violentCrime = crime?.headline.violent;
  const population = statePopulations?.reduce((sum, region) => sum + region.population, 0);
  const netMigration = immigration?.stats.netMigration;
  const projectMigration = Boolean(netMigration?.period && netMigration.period < NET_MIGRATION_2026.year);
  // Next year's population from its components: the latest natural increase
  // plus the projected net international migration.
  const naturalChange = immigration?.stats.naturalChange;
  const projectedPopulation = population && projectMigration && naturalChange && String(race.observedThrough) < NET_MIGRATION_2026.year
    ? population + naturalChange.value + NET_MIGRATION_2026.value
    : null;
  const encounterStart = encounter?.period && encounter.spark?.length
    ? shiftMonth(encounter.period, -(encounter.spark.length - 1))
    : undefined;

  const snapshot: SnapshotMetric[] = [
    ...(encounter ? [{
      label: "Border encounters",
      value: encounter.value,
      unit: "encounters",
      period: `CBP · ${encounter.period ? formatPeriod(encounter.period) : "latest month"}`,
      change: encounter.change,
      compareLabel: encounter.compare,
      spark: encounter.spark,
      href: "/immigration",
    }] : []),
    ...(crime?.year && violentCrime?.value != null ? [crime.year < VIOLENT_CRIME_2026.year ? {
      label: "Violent crime per 100,000",
      value: violentCrime.value * (1 + VIOLENT_CRIME_2026.ytdChange / 100),
      unit: "per_100k",
      period: `${VIOLENT_CRIME_2026.year} projected · Crime Index thru ${VIOLENT_CRIME_2026.through}`,
      change: VIOLENT_CRIME_2026.ytdChange,
      compareLabel: `vs ${crime.year}`,
      spark: [...numbers(violentCrime.spark ?? []), violentCrime.value * (1 + VIOLENT_CRIME_2026.ytdChange / 100)],
      href: "/crime",
    } : {
      label: "Violent crime per 100,000",
      value: violentCrime.value,
      unit: "per_100k",
      period: `FBI · ${crime.year}`,
      change: violentCrime.change,
      compareLabel: crime.priorYear ? `vs ${crime.priorYear}` : undefined,
      spark: numbers(violentCrime.spark ?? []),
      href: "/crime",
    }] : []),
    ...(netMigration ? [projectMigration ? {
      label: "Net international migration",
      value: NET_MIGRATION_2026.value,
      unit: "people",
      period: `Census · ${NET_MIGRATION_2026.year} projected`,
      change: (NET_MIGRATION_2026.value / netMigration.value - 1) * 100,
      compareLabel: `vs ${netMigration.period}`,
      spark: [...(netMigration.spark ?? []), NET_MIGRATION_2026.value],
      href: "/immigration",
    } : {
      label: "Net international migration",
      value: netMigration.value,
      unit: "people",
      period: `Census · ${netMigration.period ? formatPeriod(netMigration.period) : "latest year"}`,
      change: netMigration.change,
      compareLabel: netMigration.compare,
      spark: netMigration.spark,
      href: "/immigration",
    }] : []),
    ...(population ? [projectedPopulation ? {
      label: "U.S. resident population",
      value: projectedPopulation,
      unit: "people",
      period: `Census · ${NET_MIGRATION_2026.year} projected`,
      change: (projectedPopulation / population - 1) * 100,
      compareLabel: `vs ${race.observedThrough}`,
      href: "/demographics",
    } : {
      label: "U.S. resident population",
      value: population,
      unit: "people",
      period: `Census · ${race.observedThrough} estimate`,
      href: "/demographics",
    }] : []),
  ];

  const stateValue = <T extends { abbr: string }>(rows: T[] | undefined, pick: (row: T) => number | null | undefined) =>
    Object.fromEntries((rows ?? []).map((row) => [row.abbr, pick(row) ?? null]));
  const immigrationMetric = (key: string) => immigration?.states.metrics.find((metric) => metric.key === key);
  const crimeYear = crime?.year ? crime.states.years.indexOf(crime.year) : -1;
  const measures: StateMeasure[] = [
    ...(immigrationMetric("fb") ? [{
      key: "fb", label: "Foreign-born share", unit: "percent", period: immigrationMetric("fb")!.period, source: "Census ACS", href: "/immigration?node=states&metric=fb", stateLinks: true,
      values: stateValue(immigration!.states.rows, (row) => row.values.fb),
    }] : []),
    ...(crime && crimeYear >= 0 ? [{
      key: "violent", label: "Violent crime rate", unit: "per_100k", period: `${crime.year}, per 100,000`, source: "FBI", href: "/crime",
      values: stateValue(crime.states.rows, (row) => row.rates.violent_crime[crimeYear]),
    }] : []),
    ...(immigrationMetric("intlRate") ? [{
      key: "intlRate", label: "Migration per 1,000", unit: "per_1000", period: immigrationMetric("intlRate")!.period, source: "Census PEP", href: "/immigration?node=states&metric=intlRate", stateLinks: true,
      values: stateValue(immigration!.states.rows, (row) => row.values.intlRate),
    }] : []),
    ...(statePopulations ? [{
      key: "population", label: "Population", unit: "people", period: `${race.observedThrough} estimate`, source: "Census", href: "/demographics",
      values: stateValue(statePopulations, (row) => row.population),
    }] : []),
  ].filter((measure) => Object.values(measure.values).some((value) => value !== null));

  const latestCycle = cycles?.[0];
  const facts: PlatformFacts = {
    ...(entityCount != null && edgeCount != null ? {
      people: { entities: entityCount, relationships: edgeCount, dossiers: dossiers ?? [] },
    } : {}),
    ...(contributionCount != null ? {
      money: {
        contributions: contributionCount,
        usdTotal: contributionTotals?.find((total) => total.currency === "USD")?.total ?? 0,
        topRecipients: moneySummary?.topRecipients.slice(0, 3).map((recipient) => ({ name: recipient.name, total: recipient.total })) ?? [],
        coverage: moneySummary?.totals.lastDate,
      },
    } : {}),
    ...(latestCycle ? {
      elections: { cycle: latestCycle.cycle, races: Object.values(latestCycle.offices).reduce((sum, count) => sum + (count ?? 0), 0) },
    } : {}),
  };

  const publishers = new Set(datasets?.map((dataset) => dataset.publisher)).size;
  const showcase = await loadShowcase(datasets ?? []);
  // IssueView's sample compares states on the Census measures the showcase
  // loads plus the map's own, leaving out raw population.
  const showcaseMeasures = [...showcase.issueMeasures, ...measures.filter((measure) => measure.key !== "population")];

  return (
    <div className="mx-auto max-w-7xl">
      <Hero datasetCount={datasets?.length ?? 0} publisherCount={publishers} snapshot={snapshot} map={stateMap} measures={measures} />
      <ToolModules
        immigration={encounter ? {
          label: "Border encounters, monthly",
          value: encounter.value,
          unit: "encounters",
          period: encounter.period ? formatPeriod(encounter.period) : "Latest month",
          source: "CBP",
          values: encounter.spark ?? [],
          firstPeriod: encounterStart ? formatPeriod(encounterStart) : undefined,
          events: timelineEvent(encounterStart, encounter.period, "2025-01", "Administration change"),
        } : null}
        crime={crime?.year && violentCrime ? {
          label: "Violent crime rate",
          value: violentCrime.value,
          unit: "per_100k",
          period: `${crime.year}, per 100,000`,
          source: "FBI",
          values: violentCrime.spark ?? [],
          firstPeriod: crime.baseYear ?? undefined,
          lastPeriod: crime.year,
          events: timelineEvent(crime.baseYear ?? undefined, crime.year, "2020", "COVID-19 pandemic"),
        } : null}
        demographics={observed ? {
          period: `${race.observedThrough} estimate`,
          source: "U.S. Census Bureau",
          categories: race.categories.map((category) => ({ label: category.label, value: observed.values[category.id] ?? 0, color: category.color })),
        } : null}
        facts={facts}
        previews={previews}
        showcase={showcase}
        showcaseMeasures={showcaseMeasures}
        datasetCount={datasets?.length ?? 0}
        publisherCount={publishers}
      />
    </div>
  );
}
