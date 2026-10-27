import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadImmigration } from "@/lib/immigration/data";
import { loadCrime } from "@/lib/crime/data";
import { listDatasets } from "@/lib/db/stats";
import { getDemographicSeries } from "@/lib/demographics/forecast";
import { countEntities, listRecentEntities } from "@/lib/db/entities";
import { countEdges } from "@/lib/db/edges";
import { countContributions, listContributionTotalsByCurrency } from "@/lib/db/contributions";
import { countBills } from "@/lib/db/bills";
import { countRollCalls } from "@/lib/db/rollCalls";
import { listCycles } from "@/lib/db/election-overview";
import { loadContributionSummary } from "@/lib/db/moneyOverview";
import { getNavPreviews } from "@/lib/nav-previews";
import { formatPeriod } from "@/lib/format";
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
    recentEntities,
    contributionCount,
    contributionTotals,
    billCount,
    rollCallCount,
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
    settle(listRecentEntities(4)),
    settle(countContributions()),
    settle(listContributionTotalsByCurrency()),
    settle(countBills()),
    settle(countRollCalls()),
    settle(listCycles()),
    settle(loadContributionSummary(null)),
    getNavPreviews(),
  ]);

  const race = getDemographicSeries("race");
  const observed = race.points.find((point) => point.year === race.observedThrough);
  const encounter = immigration?.stats.encounters;
  const violentCrime = crime?.headline.violent;
  const population = statePopulations?.reduce((sum, region) => sum + region.population, 0);
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
    ...(crime?.year ? [{
      label: "Violent crime per 100,000",
      value: violentCrime?.value ?? null,
      unit: "per_100k",
      period: `FBI · ${crime.year}`,
      change: violentCrime?.change,
      compareLabel: crime.priorYear ? `vs ${crime.priorYear}` : undefined,
      spark: numbers(violentCrime?.spark ?? []),
      href: "/crime",
    }] : []),
    ...(immigration?.stats.netMigration ? [{
      label: "Net international migration",
      value: immigration.stats.netMigration.value,
      unit: "people",
      period: `Census · ${immigration.stats.netMigration.period ? formatPeriod(immigration.stats.netMigration.period) : "latest year"}`,
      change: immigration.stats.netMigration.change,
      compareLabel: immigration.stats.netMigration.compare,
      spark: immigration.stats.netMigration.spark,
      href: "/immigration",
    }] : []),
    ...(population ? [{
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
      key: "fb", label: "Foreign-born share", unit: "percent", period: immigrationMetric("fb")!.period, source: "Census ACS", href: "/immigration",
      values: stateValue(immigration!.states.rows, (row) => row.values.fb),
    }] : []),
    ...(crime && crimeYear >= 0 ? [{
      key: "violent", label: "Violent crime rate", unit: "per_100k", period: `${crime.year}, per 100,000`, source: "FBI", href: "/crime",
      values: stateValue(crime.states.rows, (row) => row.rates.violent_crime[crimeYear]),
    }] : []),
    ...(immigrationMetric("intlRate") ? [{
      key: "intlRate", label: "Migration per 1,000", unit: "per_1000", period: immigrationMetric("intlRate")!.period, source: "Census PEP", href: "/immigration",
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
      people: { entities: entityCount, relationships: edgeCount, recent: recentEntities?.map((entity) => entity.name) ?? [] },
    } : {}),
    ...(contributionCount != null ? {
      money: {
        contributions: contributionCount,
        usdTotal: contributionTotals?.find((total) => total.currency === "USD")?.total ?? 0,
        topRecipients: moneySummary?.topRecipients.slice(0, 3).map((recipient) => ({ name: recipient.name, total: recipient.total })) ?? [],
        coverage: moneySummary?.totals.lastDate,
      },
    } : {}),
    ...(billCount != null && rollCallCount != null ? { legislation: { bills: billCount, rollCalls: rollCallCount } } : {}),
    ...(latestCycle ? {
      elections: { cycle: latestCycle.cycle, races: Object.values(latestCycle.offices).reduce((sum, count) => sum + (count ?? 0), 0) },
    } : {}),
  };

  const publishers = new Set(datasets?.map((dataset) => dataset.publisher)).size;

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
        datasetCount={datasets?.length ?? 0}
        publisherCount={publishers}
      />
    </div>
  );
}
