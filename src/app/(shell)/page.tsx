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
import { loadAbortionLongRun, loadIsraelAid } from "@/lib/home/issues";
import { formatPeriod, formatValue } from "@/lib/format";
import { NET_MIGRATION_2026, VIOLENT_CRIME_2026 } from "@/lib/projections";
import { loadStatePaths } from "@/lib/geo/state-paths";
import { Hero } from "@/components/home/hero";
import { ExploreAmerica, type IssueFeatures } from "@/components/home/explore-america";
import type { StateMeasure } from "@/components/home/state-map";
import { ToolModules, type PlatformFacts } from "@/components/home/tool-modules";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

const settle = <T,>(promise: Promise<T>) => promise.then((value) => value, () => null);

async function loadStatePopulations() {
  const file = await readFile(path.join(process.cwd(), "public/data/demographics/states.json"), "utf8");
  const { regions } = JSON.parse(file) as { regions: { abbr: string; population: number }[] };
  return regions;
}

function shiftMonth(period: string, delta: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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
    israelAid,
    abortion,
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
    settle(loadIsraelAid()),
    settle(loadAbortionLongRun()),
    getNavPreviews(),
  ]);

  const race = getDemographicSeries("race");
  const observed = race.points.find((point) => point.year === race.observedThrough);
  const encounter = immigration?.stats.encounters;
  const violentCrime = crime?.headline.violent;
  const netMigration = immigration?.stats.netMigration;
  const projectMigration = Boolean(netMigration?.period && netMigration.period < NET_MIGRATION_2026.year);

  // ---- Issue grid: one headline figure and one chart per featured issue.
  const monthIndex = (period: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : NaN;
  };
  const encounterPoints = encounter?.period
    ? (encounter.spark ?? []).map((value, index, all) => {
        const period = shiftMonth(encounter.period, index - (all.length - 1));
        return { x: monthIndex(period), value, label: formatPeriod(period) };
      })
    : [];
  const administrationChange = monthIndex("2025-01");

  const migrationYears = netMigration?.periods
    .map((period, index) => ({ period, value: netMigration.spark[index] }))
    .filter((point) => /^\d{4}$/.test(point.period))
    .slice(-15) ?? [];
  const migrationColor = "var(--viz-series-7)";

  const violentRates = crime?.offenses.find((offense) => offense.key === "violent_crime")?.rates ?? [];
  const violentPoints = violentRates.map((point) => ({ x: Number(point.year), value: point.value, label: point.year }));
  const lastViolent = violentPoints.at(-1);
  const crimeColor = "var(--viz-series-2)";

  const OTHER_RACE = { id: "other", label: "Other", color: "var(--viz-axis)" };
  const leadRaces = race.categories.slice(0, 4);
  const raceYears = [...new Set([2000, 2010, 2020, race.observedThrough, 2050])];
  const raceRows = raceYears.flatMap((year) => {
    const point = race.points.find((p) => p.year === year);
    if (!point) return [];
    const segments = leadRaces.map((category) => ({ id: category.id, label: category.short ?? category.label, value: point.values[category.id] ?? 0, color: category.color }));
    return [{ year, projected: year > race.observedThrough, segments: [...segments, { ...OTHER_RACE, value: Math.max(0, 100 - segments.reduce((sum, s) => sum + s.value, 0)) }] }];
  });
  const raceFirst = raceRows[0];
  const leadRace = leadRaces[0];

  const AID_PARTS = [
    { key: "military", label: "Military", color: "var(--viz-series-1)" },
    { key: "missileDefense", label: "Missile defense", color: "var(--viz-series-7)" },
    { key: "economic", label: "Economic", color: "var(--viz-series-9)" },
  ] as const;
  const latestAid = israelAid?.at(-1);

  const abortionColor = "var(--viz-series-5)";
  const abortionStudy = abortion?.study ?? [];
  const latestAbortion = abortionStudy.at(-1);
  const priorAbortion = abortionStudy.at(-2);

  const features: IssueFeatures = {
    immigration: encounter?.period && encounterPoints.length > 1 ? {
      headline: {
        label: `Border encounters, ${formatPeriod(encounter.period)}`,
        value: encounter.value,
        unit: "encounters",
        change: encounter.change,
        compareLabel: encounter.compare,
      },
      trend: [{ id: "encounters", label: "Monthly encounters", kind: "observed", color: "var(--viz-series-1)", points: encounterPoints }],
      markers: administrationChange > encounterPoints[0].x && administrationChange <= encounterPoints.at(-1)!.x
        ? [{ x: administrationChange, label: "Administration change" }]
        : [],
      migration: netMigration && migrationYears.length > 1 ? {
        headline: projectMigration ? {
          label: `Net international migration, ${NET_MIGRATION_2026.year} projected`,
          value: NET_MIGRATION_2026.value,
          unit: "people",
          change: (NET_MIGRATION_2026.value / netMigration.value - 1) * 100,
          compareLabel: `vs ${netMigration.period}`,
        } : {
          label: `Net international migration, ${netMigration.period}`,
          value: netMigration.value,
          unit: "people",
          change: netMigration.change,
          compareLabel: netMigration.compare,
        },
        columns: [
          ...migrationYears.map((point) => ({ key: point.period, label: point.period, segments: [{ value: point.value, color: migrationColor, label: "Net migration" }] })),
          ...(projectMigration ? [{ key: NET_MIGRATION_2026.year, label: NET_MIGRATION_2026.year, projected: true, segments: [{ value: NET_MIGRATION_2026.value, color: migrationColor, label: "Net migration" }] }] : []),
        ],
        legend: [
          { label: "Census estimate, year to July 1", color: migrationColor, kind: "bar" },
          ...(projectMigration ? [{ label: `${NET_MIGRATION_2026.year} Census projection`, color: migrationColor, kind: "hatch" as const }] : []),
        ],
        source: "Census Bureau",
        coverage: `${migrationYears[0].period}–${projectMigration ? NET_MIGRATION_2026.year : migrationYears.at(-1)!.period}`,
      } : null,
      source: "U.S. Customs and Border Protection",
      coverage: `${encounterPoints[0].label} – ${encounterPoints.at(-1)!.label}`,
    } : null,
    crime: crime?.year && lastViolent && violentPoints.length > 1 ? {
      headline: {
        label: `Violent crime, ${crime.year}`,
        value: lastViolent.value,
        unit: "per_100k",
        unitLabel: "per 100,000 residents",
        change: violentCrime?.change,
        compareLabel: crime.priorYear ? `vs ${crime.priorYear}` : undefined,
      },
      trend: [
        { id: "fbi", label: "Reported to the FBI", kind: "observed", color: crimeColor, points: violentPoints },
        ...(crime.year < VIOLENT_CRIME_2026.year ? [{
          id: "projected",
          label: `${VIOLENT_CRIME_2026.year} projected from Crime Index, Jan–${VIOLENT_CRIME_2026.through}`,
          kind: "projected" as const,
          color: crimeColor,
          points: [lastViolent, { x: Number(VIOLENT_CRIME_2026.year), value: lastViolent.value * (1 + VIOLENT_CRIME_2026.ytdChange / 100), label: VIOLENT_CRIME_2026.year }],
        }] : []),
      ],
      source: "FBI",
      coverage: `${violentPoints[0].label}–${crime.year}`,
    } : null,
    demographics: observed && raceFirst && raceRows.length > 1 ? {
      headline: {
        label: `${leadRace.label} share of residents, ${race.observedThrough}`,
        value: observed.values[leadRace.id] ?? 0,
        unit: "percent",
        unitLabel: `from ${formatValue(raceFirst.segments[0].value, "percent")} in ${raceFirst.year}`,
      },
      rows: raceRows,
      legend: [
        ...raceRows[0].segments.map((segment) => ({ label: segment.label, color: segment.color, kind: "bar" as const })),
        ...(raceRows.some((row) => row.projected) ? [{ label: "Projected", color: "var(--viz-muted)", kind: "hatch" as const }] : []),
      ],
      source: "Census Bureau",
      coverage: raceRows.some((row) => row.projected) ? `${raceFirst.year}–${race.observedThrough}, 2050 projected` : `${raceFirst.year}–${race.observedThrough}`,
    } : null,
    israel: israelAid && latestAid && israelAid.length > 1 ? {
      headline: {
        label: `U.S. aid to Israel, FY${latestAid.fy}`,
        value: latestAid.total,
        unit: "usd",
        unitLabel: "current dollars",
      },
      columns: israelAid.map((year) => {
        const parts = AID_PARTS.map((part) => ({ value: year[part.key], color: part.color, label: part.label }));
        const rest = year.total - parts.reduce((sum, part) => sum + part.value, 0);
        return {
          key: String(year.fy),
          label: `FY${year.fy}`,
          segments: rest > 0 ? [...parts, { value: rest, color: "var(--viz-axis)", label: "Other" }] : parts,
        };
      }),
      legend: AID_PARTS.map((part) => ({ label: part.label, color: part.color, kind: "bar" as const })),
      source: "Congressional Research Service",
      coverage: `FY${israelAid[0].fy}–FY${latestAid.fy}`,
    } : null,
    abortion: abortion && latestAbortion ? {
      headline: {
        label: `Abortions, ${latestAbortion.year} estimate`,
        value: latestAbortion.value,
        unit: "people",
        change: priorAbortion ? (latestAbortion.value / priorAbortion.value - 1) * 100 : null,
        compareLabel: priorAbortion ? `vs ${priorAbortion.year}` : undefined,
      },
      trend: [
        ...(abortion.history.length ? [{
          id: "history",
          label: `Count, ${abortion.history[0].year}–${abortion.history.at(-1)!.year}`,
          kind: "observed" as const,
          color: abortionColor,
          points: abortion.history.map((point) => ({ x: point.year, value: point.value, label: String(point.year) })),
        }] : []),
        {
          id: "study",
          label: `Monthly-study estimate, ${abortionStudy[0].year}–${latestAbortion.year}`,
          kind: "estimate",
          color: abortionColor,
          points: abortionStudy.map((point) => ({ x: point.year, value: point.value, label: String(point.year) })),
        },
      ],
      source: "Guttmacher Institute",
      coverage: `${abortion.history[0]?.year ?? abortionStudy[0].year}–${latestAbortion.year}`,
    } : null,
  };

  const stateValue = <T extends { abbr: string }>(rows: T[] | undefined, pick: (row: T) => number | null | undefined) =>
    Object.fromEntries((rows ?? []).map((row) => [row.abbr, pick(row) ?? null]));
  const immigrationMetric = (key: string) => immigration?.states.metrics.find((metric) => metric.key === key);
  const crimeYear = crime?.year ? crime.states.years.indexOf(crime.year) : -1;
  const measures: StateMeasure[] = [
    ...(immigrationMetric("fb") ? [{
      key: "fb", label: "Foreign-born share", description: "Residents born outside the U.S., any legal status", unit: "percent", period: immigrationMetric("fb")!.period, source: "Census ACS", href: "/immigration?node=states&metric=fb", stateLinks: true,
      values: stateValue(immigration!.states.rows, (row) => row.values.fb),
    }] : []),
    ...(crime && crimeYear >= 0 ? [{
      key: "violent", label: "Violent crime rate", description: "Murder, rape, robbery, and aggravated assault reported to police, per 100,000 residents", unit: "per_100k", period: `${crime.year}, per 100,000`, source: "FBI", href: "/crime",
      values: stateValue(crime.states.rows, (row) => row.rates.violent_crime[crimeYear]),
    }] : []),
    ...(immigrationMetric("intlRate") ? [{
      key: "intlRate", label: "Migration per 1,000", description: "Arrivals from abroad minus departures, per 1,000 residents", unit: "per_1000", period: immigrationMetric("intlRate")!.period, source: "Census PEP", href: "/immigration?node=states&metric=intlRate", stateLinks: true,
      values: stateValue(immigration!.states.rows, (row) => row.values.intlRate),
    }] : []),
    ...(statePopulations ? [{
      key: "population", label: "Population", description: "Residents of each state, Census annual estimate", unit: "people", period: `${race.observedThrough} estimate`, source: "Census", href: "/demographics",
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

  return (
    <div className="mx-auto max-w-7xl">
      <Hero datasetCount={datasets?.length ?? 0} publisherCount={publishers} map={stateMap} measures={measures} />
      <ExploreAmerica features={features} />
      <ToolModules
        facts={facts}
        previews={previews}
        showcase={showcase}
        datasetCount={datasets?.length ?? 0}
        publisherCount={publishers}
      />
    </div>
  );
}
