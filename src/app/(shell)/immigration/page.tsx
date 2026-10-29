import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { PeriodTag, periodTags } from "@/components/charts/period-tag";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueHeader } from "@/components/data/issue-layout";
import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { EncounterExplorer } from "@/components/immigration/encounter-explorer";
import { GreenCardChapter, ImmigrationExplorerProvider } from "@/components/immigration/green-card-explorer";
import { StateFlows } from "@/components/immigration/state-flows";
import { ImmigrationLawGuide } from "@/components/immigration/law-guide";
import { ImmigrationSystemExplorer, type Faq, type Headline } from "@/components/immigration/system/system-explorer";
import { Disclosure } from "@/components/ui/disclosure";
import { Term } from "@/components/ui/term";
import { formatPeriod, formatValue } from "@/lib/format";
import { loadImmigration } from "@/lib/immigration/data";
import { loadCrimeCitizenship } from "@/lib/immigration/crime";
import { CrimeCitizenshipSection } from "@/components/immigration/crime-citizenship";
import type { StatKey } from "@/lib/immigration/system";
import type { ChartPoint } from "@/lib/stats/series";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Immigration | Worldview",
  description:
    "An interactive map of the U.S. immigration system: entry, permanent and temporary pathways, humanitarian protection, enforcement and due process, outcomes, and the foreign-born population — with data from CBP, DHS, ICE, and the Census Bureau.",
};

const SOURCE_SPECS = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  unauthorized: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/dhs-unauthorized" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
  historical: {
    label: "Census Bureau decennial census and American Community Survey",
    href: "/datasets/census-historical-nativity",
  },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  ice: { label: "ICE Detention Statistics", href: "/datasets/ice-detention" },
  flows: { label: "Census Bureau State-to-State Migration Flows", href: "/datasets/census-state-migration" },
  un: { label: "UN DESA International Migrant Stock", href: "/datasets/un-migrant-stock" },
} satisfies Record<string, SourceSpec>;

const NUMBER_WORDS: Record<number, string> = {
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};
const compact = (v: number | null | undefined, unit = "people") => formatValue(v, unit, { compact: true });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const year = (period: string) => period.replace(/\D/g, "");

export default async function ImmigrationPage() {
  const [d, crime] = await Promise.all([loadImmigration(), loadCrimeCitizenship()]);
  const { stats: s } = d;
  const lastMonth = d.border.lastMonth;
  const trailing = lastMonth ? periodTags.trailing12(lastMonth).label : "";
  const yearbookYear = s.lpr ? year(s.lpr.period) : "";
  const removalsYear = s.removals ? year(s.removals.period) : "";
  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  const longRun = d.population.longRun[0].points;
  const nowShare = longRun.at(-1);
  const since = nowShare ? longRun.findLast((p) => p.x < nowShare.x && p.value >= nowShare.value) : undefined;

  // ------------------------------------------------- Chart panels by key
  const stats: Partial<Record<StatKey, ReactNode>> = {
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
    border: (
      <EncounterExplorer
        regions={d.border.regions}
        breakdowns={[
          {
            key: "authority",
            label: "Legal authority",
            note: "Title 42 expulsions ran March 2020 – May 2023 (shaded). Everything else is processed under Title 8.",
          },
          {
            key: "agency",
            label: "Agency",
            note: "Border Patrol apprehends people between ports of entry; the Office of Field Operations records people found inadmissible at ports, including airports.",
          },
          {
            key: "group",
            label: "Who",
            note: "Single adults; members of family units and other accompanied children; and unaccompanied children, who are transferred to HHS custody.",
          },
        ]}
        series={d.border.series}
        markers={[
          { x: 2020 + 2 / 12, to: 2023 + 5 / 12, label: "Title 42 in effect" },
          { x: 2021, label: "Biden term" },
          { x: 2024 + 5 / 12, label: "Jun 2024 asylum limits" },
          { x: 2025, label: "Trump term" },
        ]}
        source={SOURCES.cbp}
      />
    ),
    borderWhere: (
      <ChapterExplorer
        primaryLabel="Where and who"
        metrics={[
          {
            label: "Latest month",
            value: s.encounters?.value,
            unit: "encounters",
            period: s.encounters ? formatPeriod(s.encounters.period) : "",
            change: s.encounters?.change,
            compare: s.encounters?.compare,
          },
          {
            label: "Last 12 months",
            value: s.encounters12?.value,
            unit: "encounters",
            period: trailing,
            note: s.encounters12
              ? `${pct(s.encounters12.usbpShare)} Border Patrol · ${pct(s.encounters12.ofoShare)} at ports`
              : undefined,
          },
          {
            label: "Peak month since FY 2020",
            value: s.peakMonth?.value,
            unit: "encounters",
            period: s.peakMonth ? formatPeriod(s.peakMonth.period) : "",
          },
        ]}
        primary={[
          {
            key: "states",
            label: "States",
            title: "Where CBP encounters were recorded",
            subtitle: `${trailing} · office location, not where the person settled`,
            kind: "ranked",
            items: d.border.byState,
            itemLabel: "State",
            unit: "encounters",
            source: SOURCES.cbp,
          },
          {
            key: "offices",
            label: "Offices",
            title: "Border sectors and port field offices",
            subtitle: trailing,
            kind: "ranked",
            items: d.border.byOffice,
            itemLabel: "Sector or field office",
            unit: "encounters",
            slot: 3,
            source: SOURCES.cbp,
          },
          {
            key: "citizenship",
            label: "Citizenship",
            title: "Encounters by citizenship",
            subtitle: trailing,
            kind: "ranked",
            items: d.border.byCitizenship,
            itemLabel: "Citizenship",
            unit: "encounters",
            source: SOURCES.cbp,
          },
        ]}
      />
    ),
    temporary: (
      <ChapterExplorer
        metrics={[
          {
            label: "Recorded on Form I-94",
            value: s.temporary?.value,
            unit: "admissions",
            period: s.temporary ? formatPeriod(s.temporary.period) : "",
            change: s.temporary?.change,
            compare: s.temporary?.compare,
          },
          {
            label: "All temporary admissions",
            value: s.temporary?.all,
            unit: "admissions",
            period: s.temporary ? formatPeriod(s.temporary.period) : "",
            note: "Includes estimated short land-border visits",
          },
        ]}
        primary={[
          {
            key: "trend",
            label: "Over time",
            title: "Workers, students, and exchange visitors",
            subtitle: "I-94 admissions; repeat entries count again",
            kind: "time",
            type: "column",
            series: d.temporary.purpose,
            unit: "admissions",
            markers: [{ x: 2020, label: "COVID-19 travel limits" }],
            source: SOURCES.yearbook,
          },
          {
            key: "purpose",
            label: "Latest mix",
            title: "Temporary admissions by purpose",
            subtitle: `${formatPeriod(d.temporary.period)} · I-94 admissions`,
            kind: "ranked",
            items: d.temporary.groups,
            itemLabel: "Purpose",
            unit: "admissions",
            source: SOURCES.yearbook,
          },
        ]}
        secondaryLabel="Detail"
        secondary={[
          {
            key: "work",
            label: "Work classes",
            title: "Largest temporary work classes",
            subtitle: `${formatPeriod(d.temporary.period)} · repeat entries count again`,
            kind: "ranked",
            items: d.temporary.workVisas,
            itemLabel: "Class",
            unit: "admissions",
            slot: 3,
            source: SOURCES.yearbook,
          },
        ]}
      />
    ),
    refugees: (
      <ChapterExplorer
        primaryLabel="Trend"
        secondaryLabel="Nationality"
        metrics={[
          {
            label: "Refugee arrivals",
            value: s.refugees?.value,
            unit: "people",
            period: s.refugees ? formatPeriod(s.refugees.period) : "",
            change: s.refugees?.change,
            compare: s.refugees?.compare,
          },
        ]}
        primary={[
          {
            key: "refugees",
            label: "Arrivals",
            title: "Refugee arrivals",
            subtitle: "Approved abroad and counted when they arrive",
            kind: "time",
            series: d.humanitarian.refugees,
            unit: "people",
            markers: [
              { x: 2002, label: "Post-9/11 changes" },
              { x: 2020, label: "COVID-19" },
            ],
            source: SOURCES.yearbook,
          },
        ]}
        secondary={[
          {
            key: "refugee-origin",
            label: "Top 10",
            title: "Refugee arrivals by nationality",
            subtitle: `${formatPeriod(d.humanitarian.refugeesByCountry.period)} · top 10`,
            kind: "ranked",
            items: d.humanitarian.refugeesByCountry.items,
            itemLabel: "Nationality",
            unit: "people",
            source: SOURCES.yearbook,
          },
        ]}
      />
    ),
    asylum: (
      <ChapterExplorer
        primaryLabel="Trend"
        secondaryLabel="Nationality"
        metrics={[
          {
            label: "People granted asylum",
            value: s.asylum?.value,
            unit: "people",
            period: s.asylum ? formatPeriod(s.asylum.period) : "",
            change: s.asylum?.change,
            compare: s.asylum?.compare,
          },
        ]}
        primary={[
          {
            key: "asylum",
            label: "By route",
            title: "Asylum grants: affirmative and defensive",
            subtitle: "Counted when protection is granted, often years after arrival",
            kind: "time",
            type: "column",
            series: d.humanitarian.asylum,
            unit: "people",
            source: SOURCES.yearbook,
          },
        ]}
        secondary={[
          {
            key: "asylum-origin",
            label: "Top 10",
            title: "Affirmative asylum grants by nationality",
            subtitle: `${formatPeriod(d.humanitarian.asylumByCountry.period)} · top 10`,
            kind: "ranked",
            items: d.humanitarian.asylumByCountry.items,
            itemLabel: "Nationality",
            unit: "people",
            slot: 2,
            source: SOURCES.yearbook,
          },
        ]}
      />
    ),
    greenCards: (
      <GreenCardChapter
        omit={["citizenship"]}
        data={{
          total: s.lpr?.value ?? null,
          period: s.lpr ? formatPeriod(s.lpr.period) : "",
          change: s.lpr?.change,
          compare: s.lpr?.compare,
          adjustmentShare: s.lpr?.adjustmentShare ?? null,
          history: d.legal.lprHistory,
          split: d.legal.lprSplit,
          pathways: d.legal.pathways,
          countries: d.legal.byCountry,
          naturalizations: d.legal.naturalizations,
          naturalizedShare: d.legal.naturalizedShare,
          naturalizationCountries: d.legal.natzByCountry,
        }}
      />
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
    removals: (
      <ChapterExplorer
        metrics={[
          {
            label: "Removals",
            value: s.removals?.value,
            unit: "events",
            period: s.removals ? formatPeriod(s.removals.period) : "",
            change: s.removals?.change,
            compare: s.removals?.compare,
          },
        ]}
        primaryLabel="History"
        primary={[
          {
            key: "history",
            label: "1892–present",
            title: "Removals, returns, and expulsions since 1892",
            subtitle: "DHS repatriations per fiscal year · events, not unique people",
            kind: "time",
            type: "column",
            series: d.enforcement.repatriations,
            unit: "events",
            markers: [
              { x: 1924, label: "1924 quotas" },
              { x: 1996, label: "IIRIRA" },
              { x: 2020, to: 2023.4, label: "Title 42" },
            ],
            source: SOURCES.yearbook,
            note: "After the 1996 law created expedited removal, formal removals—with re-entry penalties—replaced many returns.",
          },
        ]}
        secondaryLabel="Explain by"
        secondary={[
          {
            key: "status",
            label: "Criminal status",
            title: "Removals by criminal status",
            subtitle: "Known conviction at the time of removal",
            kind: "time",
            type: "column",
            series: d.enforcement.removalsByStatus,
            unit: "events",
            source: SOURCES.yearbook,
          },
          {
            key: "country",
            label: "Nationality",
            title: "Removals by nationality",
            subtitle: `${formatPeriod(d.enforcement.removalsByCountry.period)} · top 10`,
            kind: "ranked",
            items: d.enforcement.removalsByCountry.items,
            itemLabel: "Nationality",
            unit: "events",
            source: SOURCES.yearbook,
          },
        ]}
      />
    ),
    detention: (
      <ChapterExplorer
        metrics={[
          {
            label: "Average daily population",
            value: s.detention?.value,
            unit: "people",
            period: s.detention ? `${formatPeriod(s.detention.period)} to date` : "",
            change: s.detention?.change,
            compare: s.detention?.compare,
          },
          {
            label: "No criminal conviction",
            value: s.detention?.noConvictionShare,
            unit: "percent",
            period: s.detention ? `${formatPeriod(s.detention.period)} to date` : "",
            note:
              s.detention?.mandatoryShare != null
                ? `${pct(s.detention.mandatoryShare)} in mandatory detention`
                : undefined,
          },
        ]}
        primaryLabel="Population"
        primary={[
          {
            key: "population",
            label: "By conviction",
            title: "Average daily detained population",
            subtitle: "By criminal conviction; current year is year to date",
            kind: "time",
            type: "column",
            series: d.enforcement.detention,
            unit: "people",
            source: SOURCES.ice,
          },
        ]}
        secondaryLabel="Facilities"
        secondary={[
          {
            key: "facilities",
            label: "Largest",
            title: "Largest detention facilities",
            subtitle: `${formatPeriod(d.enforcement.facilities.period)} · hover for location and average stay`,
            kind: "ranked",
            items: d.enforcement.facilities.items,
            itemLabel: "Facility",
            unit: "people",
            source: SOURCES.ice,
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
            period: s.netMigration ? periodTags.july(s.netMigration.period).label : "",
            change: s.netMigration?.change,
            compare: s.netMigration?.compare,
          },
          {
            label: "Natural increase",
            value: s.naturalChange?.value,
            unit: "people",
            period: s.naturalChange ? periodTags.july(s.naturalChange.period).label : "",
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

  // ------------------------------------------- Headline numbers on cards
  const recent = (points: { value: number }[] | undefined, n = 24) =>
    points && points.length > 1 ? points.slice(-n).map((p) => p.value) : undefined;
  const summed = (series: { points: ChartPoint[] }[]) => {
    const byX = new Map<number, ChartPoint>();
    for (const p of series.flatMap((x) => x.points))
      byX.set(p.x, { ...p, value: (byX.get(p.x)?.value ?? 0) + p.value });
    return [...byX.values()].sort((a, b) => a.x - b.x);
  };
  const head = (
    value: number | null | undefined,
    label: string,
    spark?: number[],
    unit?: string,
  ): Headline | undefined =>
    value === null || value === undefined
      ? undefined
      : { value: unit === "percent" ? `${value.toFixed(1)}%` : compact(value), label, spark };
  const headlines: Partial<Record<StatKey, Headline>> = {
    history: head(nowShare?.value, `foreign-born share, ${nowShare?.x ?? ""}`, recent(longRun, 40), "percent"),
    border: head(
      s.encounters12?.value,
      `encounters, ${trailing}`,
      recent(summed(d.border.series.nation?.authority ?? []), 36),
    ),
    greenCards: head(
      s.lpr?.value,
      `new green cards, ${s.lpr ? formatPeriod(s.lpr.period) : ""}`,
      recent(d.legal.lprHistory[0].points),
    ),
    naturalization: head(
      s.naturalizations?.value,
      `naturalized, ${s.naturalizations ? formatPeriod(s.naturalizations.period) : ""}`,
      recent(d.legal.naturalizations.find((x) => x.id === "natz")?.points),
    ),
    temporary: head(
      s.temporary?.value,
      `temporary admissions, ${s.temporary ? formatPeriod(s.temporary.period) : ""}`,
      recent(d.temporary.i94[0].points),
    ),
    refugees: head(
      s.refugees?.value,
      `refugee arrivals, ${s.refugees ? formatPeriod(s.refugees.period) : ""}`,
      recent(d.humanitarian.refugees[0].points),
    ),
    asylum: head(
      s.asylum?.value,
      `granted asylum, ${s.asylum ? formatPeriod(s.asylum.period) : ""}`,
      recent(summed(d.humanitarian.asylum)),
    ),
    removals: head(
      s.removals?.value,
      `removals, ${s.removals ? formatPeriod(s.removals.period) : ""}`,
      recent(d.enforcement.repatriations[0].points),
    ),
    detention: head(
      s.detention?.value,
      `in ICE detention on an average day, ${s.detention ? formatPeriod(s.detention.period) : ""}`,
      recent(summed(d.enforcement.detention)),
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
      `net international migration, ${s.netMigration ? periodTags.july(s.netMigration.period).label : ""}`,
      recent(d.population.netMigration[0].points),
    ),
  };

  // --------------------------------------------- Questions, by node
  const faq: Faq[] = [
    {
      q: "What are Title 8 and Title 42?",
      a: "Title 8 is ordinary federal immigration law; almost every encounter is processed under it. Title 42 was a public-health authority used from March 2020 to May 2023 to expel people quickly without immigration processing.",
      nodes: ["border-encounter", "out-other-departure", "entry-between"],
    },
    {
      q: "Is a border encounter the same as an illegal immigrant? Is each encounter a different person?",
      a: "No to both. An encounter is an event: someone stopped twice counts twice, and people who arrive at an airport without valid papers are encounters too. Encounters also don't count people who crossed without being stopped.",
      nodes: ["border-encounter", "unauthorized-population"],
    },
    {
      q: "What's the difference between an encounter and an apprehension?",
      a: (
        <>
          An apprehension is one kind of encounter: Border Patrol taking someone into custody between ports of entry.
          The other kind is a person found inadmissible at a port of entry.
          {s.encounters12?.usbpShare != null && (
            <>
              {" "}
              In the last 12 months, {pct(s.encounters12.usbpShare)} of encounters were Border Patrol apprehensions or
              expulsions.
            </>
          )}
        </>
      ),
      nodes: ["border-encounter", "entry-between", "entry-port"],
    },
    {
      q: "Why do Florida and New York have border encounters? Does “Texas encounters” mean people settled in Texas?",
      a: "Encounters are filed under the state of the CBP office that recorded them. Florida and New York have large international airports and seaports, where people found inadmissible are counted. Where someone was encountered says nothing about where they live or go.",
      nodes: ["border-encounter", "states"],
    },
    {
      q: "How many people were deported?",
      a: s.removals
        ? `DHS carried out ${compact(s.removals.value)} removals in ${formatPeriod(s.removals.period)}, the latest year published, plus returns and Title 42 expulsions.`
        : "See Removal.",
      nodes: ["out-removal", "enforcement", "out-other-departure"],
    },
    {
      q: "How many asylum claims were granted?",
      a: s.asylum
        ? `${compact(s.asylum.value)} people were granted asylum in ${formatPeriod(s.asylum.period)}, by USCIS asylum officers or immigration judges.`
        : "See Asylum adjudication.",
      nodes: ["asylum-adjudication", "aff-interview", "def-hearing", "out-protection", "humanitarian"],
    },
    {
      q: "Does passing a credible-fear screening mean someone got asylum?",
      a: "No. A positive credible-fear finding only means the claim can go forward to a full hearing, where it is decided on the merits — often years later.",
      nodes: ["credible-fear", "proc-expedited", "humanitarian"],
    },
    {
      q: "How many unauthorized immigrants live in the U.S.?",
      a: s.unauthorized
        ? `DHS estimates ${compact(s.unauthorized.value)} as of January 1, ${s.unauthorized.period}, its latest estimate. Pew Research Center estimates 14 million as of July 2023.`
        : "See Unauthorized population.",
      nodes: ["unauthorized-population", "unauthorized"],
    },
    {
      q: "Do green cards mean that many people entered the country that year?",
      a: s.lpr
        ? `No. In ${formatPeriod(s.lpr.period)}, ${pct(s.lpr.adjustmentShare)} of the ${compact(s.lpr.value)} new green cards went to people who were already living in the U.S. and adjusted their status.`
        : "No — many go to people already living here.",
      nodes: ["lpr", "adjustment", "permanent"],
    },
    {
      q: "Is net international migration just immigration minus deportations? Why doesn't it match green cards?",
      a: "Neither. Net international migration counts everyone who moved here for a year or more — any status, including returning U.S. citizens — minus everyone who moved abroad. Green cards count status grants, mostly to people who were already here, so the two measure different things.",
      nodes: ["net-migration", "lpr"],
    },
    {
      q: "What's the difference between a refugee and an asylum seeker?",
      a: "Both must show the same fear of persecution. Refugees are approved while outside the U.S. and then resettled here; asylum is requested after reaching the U.S. or its border.",
      nodes: ["humanitarian", "refugee-admission", "asylum-adjudication"],
    },
    {
      q: "Does everyone facing deportation get a hearing before a judge?",
      a: "No. People in §240 proceedings do, with appeals. Expedited removal, reinstatement of a prior order, and administrative removal are decided by immigration officers; their main safeguard is a fear screening, with limited review.",
      nodes: ["enforcement", "procedure-choice", "proc-expedited", "proc-reinstatement", "proc-admin", "proc-240"],
    },
    {
      q: "Do people in immigration court get a free lawyer?",
      a: "No. They have the right to a lawyer, but at no expense to the government. Courts provide a list of free legal service providers.",
      nodes: ["proc-240", "p240-nta", "p240-master"],
    },
    {
      q: "Why are people without criminal convictions in ICE detention?",
      a: (
        <>
          Immigration detention is civil custody while a removal case is decided or a removal is arranged, not
          punishment for a crime. Being in the U.S. without status is a civil violation. Some people are held under
          mandatory-detention laws; “no criminal conviction” can include people with pending charges.
          {s.detention?.noConvictionShare != null && (
            <>
              {" "}
              In {formatPeriod(s.detention.period)} so far, {pct(s.detention.noConvictionShare)} of the average daily
              population had no criminal conviction.
            </>
          )}
        </>
      ),
      nodes: ["detention", "mandatory-detention", "custody-decision"],
    },
    {
      q: "Does “foreign-born” include naturalized citizens and unauthorized immigrants?",
      a: "Yes. It counts everyone living here who wasn't a U.S. citizen at birth, whatever their status today.",
      nodes: ["foreign-born", "naturalization"],
    },
    {
      q: "Why are some figures from 2024 or earlier?",
      a: `Each agency publishes on its own schedule. DHS releases each Yearbook of Immigration Statistics about a year and a half after the fiscal year ends — FY ${yearbookYear} is the newest — and its enforcement chapter${removalsYear ? ` (FY ${removalsYear})` : ""} trails by another year. DHS's unauthorized-population estimate is published irregularly. CBP publishes monthly.`,
      nodes: ["system"],
    },
    {
      q: "Why are moves between states on this page?",
      a: "They aren't immigration, but they're often confused with it, so they sit under Related migration, with Americans living abroad.",
      nodes: ["related-migration"],
    },
  ];

  return (
    <ImmigrationExplorerProvider>
      <div className="mx-auto max-w-[96rem] space-y-6">
        <IssueHeader title="Immigration">
          {nowShare && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
              <p className="shrink-0 text-5xl leading-none font-semibold tracking-tight text-slate-950 tabular-nums sm:text-6xl dark:text-white">
                {nowShare.value.toFixed(1)}%
              </p>
              <div className="space-y-1.5">
                <p className="text-base leading-7 text-slate-700 sm:text-lg dark:text-slate-200">
                  About one in {NUMBER_WORDS[Math.round(100 / nowShare.value)] ?? Math.round(100 / nowShare.value)}{" "}
                  people living in the U.S. is <Term id="foreign-born">foreign-born</Term>
                  {since ? <> — the highest share since {since.x}.</> : <> — the highest share on record.</>} Below is
                  how they, and everyone else who comes, moves through the system.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Foreign-born share of U.S. residents, {nowShare.x}.{" "}
                  <Link
                    href={SOURCES.historical.href ?? "/datasets"}
                    className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:decoration-slate-600 dark:hover:text-white"
                  >
                    Census Bureau, American Community Survey
                  </Link>
                </p>
              </div>
            </div>
          )}
        </IssueHeader>

        <ImmigrationSystemExplorer stats={stats} headlines={headlines} faq={faq} />

        {crime && <CrimeCitizenshipSection d={crime} />}
        <ImmigrationLawGuide />
      </div>
    </ImmigrationExplorerProvider>
  );
}
