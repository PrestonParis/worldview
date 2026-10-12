import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadImmigration } from "@/lib/immigration/data";
import { loadCrime } from "@/lib/crime/data";
import { listDatasets } from "@/lib/db/stats";
import { getDemographicSeries } from "@/lib/demographics/forecast";
import { countEntities, listRecentEntities } from "@/lib/neo4j/entities";
import { countEdges } from "@/lib/neo4j/edges";
import { countContributions, listContributionTotalsByCurrency } from "@/lib/db/contributions";
import { countBills } from "@/lib/db/bills";
import { countRollCalls } from "@/lib/db/rollCalls";
import { listCycles } from "@/lib/db/election-overview";
import { formatPeriod } from "@/lib/format";
import { Hero, type SnapshotMetric } from "@/components/home/hero";
import { ToolModules, type PlatformFacts } from "@/components/home/tool-modules";

export const dynamic = "force-dynamic";

const settle = <T,>(promise: Promise<T>) => promise.then((value) => value, () => null);

async function loadUsPopulation() {
  const file = await readFile(path.join(process.cwd(), "public/data/demographics/states.json"), "utf8");
  const { regions } = JSON.parse(file) as { regions: { population: number }[] };
  return regions.reduce((sum, region) => sum + region.population, 0);
}

export default async function Home() {
  const [
    immigration,
    crime,
    datasets,
    population,
    entityCount,
    edgeCount,
    recentEntities,
    contributionCount,
    contributionTotals,
    billCount,
    rollCallCount,
    cycles,
  ] = await Promise.all([
    settle(loadImmigration()),
    settle(loadCrime()),
    settle(listDatasets()),
    settle(loadUsPopulation()),
    settle(countEntities()),
    settle(countEdges()),
    settle(listRecentEntities(4)),
    settle(countContributions()),
    settle(listContributionTotalsByCurrency()),
    settle(countBills()),
    settle(countRollCalls()),
    settle(listCycles()),
  ]);

  const race = getDemographicSeries("race");
  const observed = race.points.find((point) => point.year === race.observedThrough);
  const encounter = immigration?.stats.encounters;
  const violentCrime = crime?.headline.violent;

  const snapshot: SnapshotMetric[] = [
    ...(encounter ? [{
      label: "Border encounters",
      value: encounter.value,
      unit: "encounters",
      period: encounter.period ? formatPeriod(encounter.period) : undefined,
      change: encounter.change,
      href: "/immigration",
      source: "U.S. Customs and Border Protection",
    }] : []),
    ...(crime?.year ? [{
      label: "Violent crime rate",
      value: violentCrime?.value ?? null,
      unit: "per_100k",
      period: `${crime.year}, per 100,000 residents`,
      change: violentCrime?.change,
      href: "/crime",
      source: "FBI Crime Data Explorer",
    }] : []),
    ...(population ? [{
      label: "U.S. resident population",
      value: population,
      unit: "people",
      period: `${race.observedThrough} estimate`,
      href: "/demographics",
      source: "U.S. Census Bureau",
    }] : []),
    ...(immigration?.stats.netMigration ? [{
      label: "Net international migration",
      value: immigration.stats.netMigration.value,
      unit: "people",
      period: immigration.stats.netMigration.period ? formatPeriod(immigration.stats.netMigration.period) : undefined,
      change: immigration.stats.netMigration.change,
      href: "/immigration",
      source: "U.S. Census Bureau",
    }] : []),
  ];

  const latestCycle = cycles?.[0];
  const facts: PlatformFacts = {
    ...(entityCount != null && edgeCount != null ? {
      people: { entities: entityCount, relationships: edgeCount, recent: recentEntities?.map((entity) => entity.name) ?? [] },
    } : {}),
    ...(contributionCount != null ? {
      money: { contributions: contributionCount, usdTotal: contributionTotals?.find((total) => total.currency === "USD")?.total ?? 0 },
    } : {}),
    ...(billCount != null && rollCallCount != null ? { legislation: { bills: billCount, rollCalls: rollCallCount } } : {}),
    ...(latestCycle ? {
      elections: { cycle: latestCycle.cycle, races: Object.values(latestCycle.offices).reduce((sum, count) => sum + (count ?? 0), 0) },
    } : {}),
  };

  const publishers = new Set(datasets?.map((dataset) => dataset.publisher)).size;

  return (
    <div className="mx-auto max-w-7xl">
      <Hero datasetCount={datasets?.length ?? 0} publisherCount={publishers} snapshot={snapshot} />
      <ToolModules
        immigration={encounter ? {
          label: "Border encounters, monthly",
          value: encounter.value,
          unit: "encounters",
          period: encounter.period ? formatPeriod(encounter.period) : "Latest month",
          source: "CBP",
          values: encounter.spark ?? [],
          firstPeriod: "Prior 24 months",
        } : null}
        crime={crime?.year && violentCrime ? {
          label: "Violent crime rate",
          value: violentCrime.value,
          unit: "per_100k",
          period: `${crime.year}, per 100,000`,
          source: "FBI",
          values: violentCrime.spark ?? [],
          firstPeriod: crime.baseYear ?? undefined,
        } : null}
        demographics={observed ? {
          period: `${race.observedThrough} estimate`,
          source: "U.S. Census Bureau",
          categories: race.categories.map((category) => ({ label: category.label, value: observed.values[category.id] ?? 0, color: category.color })),
        } : null}
        facts={facts}
        datasetCount={datasets?.length ?? 0}
        publisherCount={publishers}
      />
    </div>
  );
}
