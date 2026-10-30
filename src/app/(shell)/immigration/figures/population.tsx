import { ChartCard } from "@/components/charts/chart-card";
import { PeriodTag, periodTags } from "@/components/charts/period-tag";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { StateFlows } from "@/components/immigration/state-flows";
import { Disclosure } from "@/components/ui/disclosure";
import { formatPeriod } from "@/lib/format";
import { compact, hasPoints, head, july, pct, recent, summed, type FigureContext, type StageFigures } from "./shared";

// Stage 5: citizenship and the measures of who lives here.
export function populationFigures({ d, SOURCES }: FigureContext): StageFigures {
  const s = d.stats;
  const longRun = d.population.longRun[0].points;
  const nowShare = longRun.at(-1);

  const stats: StageFigures["stats"] = {
    lprPopulation: hasPoints(d.lprPopulation.series) && (
      <ChapterExplorer
        metrics={[
          {
            label: "Green-card holders living in the U.S.",
            value: s.lprPopulation?.value,
            unit: "people",
            period: s.lprPopulation ? `Jan 1, ${s.lprPopulation.period}` : "",
          },
          {
            label: "Eligible to naturalize",
            value: s.lprPopulation?.eligible,
            unit: "people",
            period: s.lprPopulation ? `Jan 1, ${s.lprPopulation.period}` : "",
            note: "Meets the age and residence requirements",
          },
        ]}
        primary={[
          {
            key: "trend",
            label: "Over time",
            title: "Permanent residents living in the U.S.",
            subtitle: "January 1 · each year from DHS's latest estimate of it",
            kind: "time",
            series: d.lprPopulation.series,
            unit: "people",
            fromZero: false,
            source: SOURCES.lprPopulation,
          },
        ]}
        secondaryLabel="Composition"
        secondary={[
          {
            key: "country",
            label: "Country",
            title: "By country of birth",
            subtitle: `January 1, ${d.lprPopulation.byCountry.period}`,
            kind: "ranked",
            items: d.lprPopulation.byCountry.items,
            itemLabel: "Country",
            unit: "people",
            limit: 11,
            source: SOURCES.lprPopulation,
          },
          {
            key: "state",
            label: "State",
            title: "By state of residence",
            subtitle: `January 1, ${d.lprPopulation.byState.period}`,
            kind: "ranked",
            items: d.lprPopulation.byState.items,
            itemLabel: "State",
            unit: "people",
            limit: 11,
            slot: 3,
            source: SOURCES.lprPopulation,
          },
          {
            key: "class",
            label: "How they got it",
            title: "By class of admission",
            subtitle: `January 1, ${d.lprPopulation.byClass.period}`,
            kind: "ranked",
            items: d.lprPopulation.byClass.items,
            itemLabel: "Class",
            unit: "people",
            slot: 2,
            source: SOURCES.lprPopulation,
          },
        ]}
      />
    ),
    history: nowShare && (
      <ChartCard
        title="Foreign-born share of the U.S. population"
        subtitle={`Every census 1850–2000, then the yearly American Community Survey through ${nowShare.x}`}
        source={SOURCES.historical}
        table={seriesTable(d.population.longRun, "percent")}
      >
        <TimeSeriesChart
          series={d.population.longRun}
          unit="percent"
          height={300}
          xTickValues={[1850, 1875, 1900, 1925, 1950, 1975, 2000, 2025]}
          markers={[
            { x: 1924, label: "1924 quotas" },
            { x: 1965, label: "1965 quotas end" },
          ]}
        />
      </ChartCard>
    ),
    naturalization: (
      <ChapterExplorer
        metrics={[
          {
            label: "People naturalized",
            value: s.naturalizations?.value,
            unit: "people",
            period: s.naturalizations ? formatPeriod(s.naturalizations.period) : "",
            change: s.naturalizations?.change,
            compare: s.naturalizations?.compare,
          },
          {
            label: "Foreign-born residents who are citizens",
            value: s.foreignBorn?.naturalizedShare,
            unit: "percent",
            period: s.foreignBorn?.period,
          },
        ]}
        primaryLabel="Measure"
        primary={[
          {
            key: "trend",
            label: "Applications and citizens",
            title: "Naturalization applications and new citizens",
            subtitle: "Per fiscal year",
            kind: "time",
            series: d.legal.naturalizations,
            unit: "people",
            source: SOURCES.yearbook,
          },
          {
            key: "share",
            label: "Citizen share",
            title: "Naturalized share of the foreign-born",
            subtitle: "Per survey year",
            kind: "time",
            series: d.legal.naturalizedShare,
            unit: "percent",
            fromZero: false,
            source: SOURCES.acs,
          },
        ]}
        secondaryLabel="Origin"
        secondary={[
          {
            key: "country",
            label: "Country",
            title: "New citizens by country of birth",
            subtitle: `${formatPeriod(d.legal.natzByCountry.period)} · top 10`,
            kind: "ranked",
            items: d.legal.natzByCountry.items,
            itemLabel: "Country",
            unit: "people",
            source: SOURCES.yearbook,
          },
        ]}
      />
    ),
    unauthorized: (
      <ChapterExplorer
        metrics={[
          {
            label: "DHS estimate",
            value: s.unauthorized?.value,
            unit: "people",
            period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "",
          },
          {
            label: "Share of all residents",
            value: s.unauthorized?.shareOfPopulation,
            unit: "percent",
            period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "",
            note:
              s.unauthorized?.shareOfForeignBorn != null
                ? `${pct(s.unauthorized.shareOfForeignBorn)} of foreign-born residents`
                : undefined,
          },
          {
            label: "Pew estimate",
            value: 14_000_000,
            unit: "people",
            period: "Jul 2023",
            note: "Independent estimate; methodology and vintage differ from DHS",
          },
        ]}
        primary={[
          {
            key: "estimate",
            label: "Estimate",
            title: "Estimated unauthorized population",
            subtitle: "January 1 · gaps in 2001–2004 and 2021",
            kind: "time",
            series: d.unauthorized.series,
            unit: "people",
            markers: [
              { x: 2010, label: "2010 Census base" },
              { x: 2022, label: "2020 Census base" },
            ],
            source: SOURCES.unauthorized,
          },
        ]}
        secondaryLabel="Composition"
        secondary={[
          {
            key: "country",
            label: "Country",
            title: "By country of birth",
            subtitle: `January 1, ${d.unauthorized.byCountry.period}`,
            kind: "ranked",
            items: d.unauthorized.byCountry.items,
            itemLabel: "Country",
            unit: "people",
            limit: 11,
            source: SOURCES.unauthorized,
          },
          {
            key: "state",
            label: "State",
            title: "By state of residence",
            subtitle: `January 1, ${d.unauthorized.byState.period}`,
            kind: "ranked",
            items: [
              ...d.unauthorized.byState.items,
              ...(d.unauthorized.byState.other
                ? [{ label: "All other states", value: d.unauthorized.byState.other }]
                : []),
            ],
            itemLabel: "State",
            unit: "people",
            limit: 11,
            slot: 3,
            source: SOURCES.unauthorized,
          },
          {
            key: "arrival",
            label: "Arrival era",
            title: "When they arrived",
            subtitle: `January 1, ${d.unauthorized.byEntry.period}`,
            kind: "ranked",
            items: d.unauthorized.byEntry.items,
            itemLabel: "Period",
            unit: "people",
            slot: 2,
            source: SOURCES.unauthorized,
          },
        ]}
      />
    ),
    population: (
      <ChapterExplorer
        metrics={[
          {
            label: "Foreign-born residents",
            value: s.foreignBorn?.value,
            unit: "people",
            period: s.foreignBorn?.period,
            change: s.foreignBorn?.change,
            compare: s.foreignBorn?.compare,
          },
          {
            label: "Share of the population",
            value: s.foreignBorn?.share,
            unit: "percent",
            period: s.foreignBorn?.period,
            note:
              s.foreignBorn?.naturalizedShare != null
                ? `${pct(s.foreignBorn.naturalizedShare)} are naturalized citizens`
                : undefined,
          },
        ]}
        primaryLabel="Measure"
        primary={[
          {
            key: "citizenship",
            label: "Citizenship",
            title: "Foreign-born population by citizenship",
            subtitle: "Naturalized citizens and noncitizens",
            kind: "time",
            type: "column",
            series: d.population.foreignBorn,
            unit: "people",
            source: SOURCES.acs,
          },
          {
            key: "share",
            label: "Population share",
            title: "Foreign-born share of the population",
            subtitle: "Per survey year",
            kind: "time",
            series: d.population.foreignBornShare,
            unit: "percent",
            fromZero: false,
            source: SOURCES.acs,
          },
        ]}
        secondaryLabel="Origin"
        secondary={[
          {
            key: "country",
            label: "Country",
            title: "Foreign-born residents by country of birth",
            subtitle: `${d.population.byCountry.period} survey`,
            kind: "ranked",
            items: d.population.byCountry.items,
            itemLabel: "Country",
            unit: "people",
            source: SOURCES.acs,
          },
          {
            key: "region",
            label: "Region",
            title: "By world region of birth",
            subtitle: `${d.population.byRegion.period} survey`,
            kind: "ranked",
            items: d.population.byRegion.items,
            itemLabel: "Region",
            unit: "people",
            slot: 2,
            source: SOURCES.acs,
          },
        ]}
      />
    ),
    netMigration: (
      <ChapterExplorer
        metrics={[
          {
            label: "Net international migration",
            value: s.netMigration?.value,
            unit: "people",
            period: s.netMigration ? july(s.netMigration.period) : "",
            change: s.netMigration?.change,
            compare: s.netMigration?.compare,
          },
          {
            label: "Natural increase",
            value: s.naturalChange?.value,
            unit: "people",
            period: s.naturalChange ? july(s.naturalChange.period) : "",
            note: "Births minus deaths",
          },
        ]}
        primaryLabel="Measure"
        primary={[
          {
            key: "migration",
            label: "Net migration",
            title: "Net international migration",
            subtitle: "Everyone moving in from abroad minus everyone moving abroad",
            kind: "time",
            type: "column",
            series: d.population.netMigration,
            unit: "people",
            source: SOURCES.pep,
          },
          {
            key: "growth",
            label: "Population growth",
            title: "Where population growth comes from",
            subtitle: "Natural increase versus net international migration",
            kind: "time",
            type: "column",
            series: d.population.growth,
            unit: "people",
            source: SOURCES.pep,
          },
        ]}
        callout="Net international migration includes every status and U.S. citizens moving to or from abroad. It is not green cards minus deportations."
      />
    ),
    domestic: (
      <div className="space-y-4">
        <ChapterExplorer
          primaryLabel="Moving between states"
          primary={[
            {
              key: "trend",
              label: "Total moving",
              title: "People who moved between states",
              subtitle: "Per survey year, 50 states and DC",
              kind: "time",
              type: "column",
              series: d.domestic.interstate,
              unit: "people",
              source: SOURCES.flows,
            },
          ]}
          secondaryLabel="Routes"
          secondary={[
            {
              key: "corridors",
              label: "Largest",
              title: "Largest state-to-state moves",
              subtitle: `${d.domestic.flows.period} survey`,
              kind: "ranked",
              items: d.domestic.flows.corridors,
              itemLabel: "Move",
              unit: "people",
              source: SOURCES.flows,
            },
          ]}
        />
        {d.domestic.flows.states.some((st) => st.origins.length) && (
          <Disclosure summary="Explore every state's origins and destinations">
            <StateFlows states={d.domestic.flows.states} period={d.domestic.flows.period} />
          </Disclosure>
        )}
      </div>
    ),
    abroad: (
      <div className="space-y-4">
        {d.abroad.total && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {compact(d.abroad.total.value)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">U.S.-born people living abroad</p>
            <PeriodTag {...periodTags.midYear(d.abroad.total.period)} />
          </div>
        )}
        <ChapterExplorer
          primary={[
            {
              key: "trend",
              label: "Over time",
              title: "U.S.-born people living abroad",
              subtitle: "Mid-year estimate",
              kind: "time",
              type: "column",
              series: d.abroad.series,
              unit: "people",
              source: SOURCES.un,
            },
          ]}
          secondaryLabel="Where they live"
          secondary={[
            {
              key: "country",
              label: "Country",
              title: "Where they live, by country",
              subtitle: `Mid-${d.abroad.byCountry.period} · top 10`,
              kind: "ranked",
              items: d.abroad.byCountry.items,
              itemLabel: "Country",
              unit: "people",
              source: SOURCES.un,
            },
            {
              key: "region",
              label: "Region",
              title: "Where they live, by region",
              subtitle: `Mid-${d.abroad.byRegion.period}`,
              kind: "ranked",
              items: d.abroad.byRegion.items,
              itemLabel: "Region",
              unit: "people",
              slot: 2,
              source: SOURCES.un,
            },
          ]}
        />
      </div>
    ),
  };
  // The state map opens on the measure that fits the node it sits in.
  for (const m of d.states.metrics)
    stats[`states:${m.key}`] = <StateExplorer metrics={d.states.metrics} rows={d.states.rows} initial={m.key} />;

  const fbShare = d.states.metrics.find((m) => m.key === "fb");
  const topState = fbShare
    ? d.states.rows
        .filter((r) => r.values.fb != null)
        .sort((a, b) => (b.values.fb ?? 0) - (a.values.fb ?? 0))[0]
    : undefined;

  return {
    stats,
    headlines: {
      lprPopulation: head(
        s.lprPopulation?.value,
        `green-card holders living in the U.S., Jan ${s.lprPopulation?.period ?? ""}`,
        recent(d.lprPopulation.series[0].points),
      ),
      history: head(nowShare?.value, `foreign-born share, ${nowShare?.x ?? ""}`, recent(longRun, 40), "percent"),
      naturalization: head(
        s.naturalizations?.value,
        `naturalized, ${s.naturalizations ? formatPeriod(s.naturalizations.period) : ""}`,
        recent(d.legal.naturalizations.find((x) => x.id === "natz")?.points),
      ),
      unauthorized: head(
        s.unauthorized?.value,
        `unauthorized residents, Jan ${s.unauthorized?.period ?? ""}`,
        recent(d.unauthorized.series[0].points),
      ),
      population: head(
        s.foreignBorn?.value,
        `foreign-born residents, ${s.foreignBorn?.period ?? ""}`,
        recent(summed(d.population.foreignBorn)),
      ),
      netMigration: head(
        s.netMigration?.value,
        `net international migration, ${s.netMigration ? july(s.netMigration.period) : ""}`,
        recent(d.population.netMigration[0].points),
      ),
      "states:fb": topState && {
        value: `${(topState.values.fb ?? 0).toFixed(1)}%`,
        label: `foreign-born in ${topState.name}, the highest share, ${fbShare?.period ?? ""}`,
      },
      domestic: head(
        d.domestic.interstate[0].points.at(-1)?.value,
        `moved between states, ${d.domestic.interstate[0].points.at(-1)?.label ?? ""}`,
        recent(d.domestic.interstate[0].points),
      ),
    },
  };
}
