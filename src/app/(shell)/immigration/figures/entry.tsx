import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { EncounterExplorer } from "@/components/immigration/encounter-explorer";
import type { Series } from "@/components/charts/time-series-chart";
import { formatPeriod } from "@/lib/format";
import { summed, recent, head, hasPoints, pct, type FigureContext, type StageFigures } from "./shared";

const BORDER_MARKERS = [
  { x: 2020 + 2 / 12, to: 2023 + 5 / 12, label: "Title 42 in effect" },
  { x: 2021, label: "Biden term" },
  { x: 2024 + 5 / 12, label: "Jun 2024 asylum limits" },
  { x: 2025, label: "Trump term" },
];

// One agency's monthly encounters, stacked by where they happened.
const byRegion = (regions: Record<string, Series[]>, labels: Record<string, string>): Series[] =>
  Object.entries(labels).flatMap(([key, label], i) =>
    (regions[key] ?? []).map((s) => ({ ...s, id: key, label, slot: (i + 1) as Series["slot"] })),
  );

// Stage 1: where people first meet the system.
export function entryFigures({ d, SOURCES, trailing }: FigureContext): StageFigures {
  const s = d.stats;
  const ofo = byRegion(d.ports.byRegion, {
    southwest: "Southwest border ports",
    northern: "Northern border ports",
    other: "Airports, seaports, and other ports",
  });
  const usbp = byRegion(d.between.byRegion, {
    southwest: "Southwest border",
    northern: "Northern border",
    other: "Coastal sectors",
  });

  return {
    stats: {
      visas: hasPoints(d.fromAbroad.arrivals) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Arrived with an immigrant visa",
              value: s.newArrivals?.value,
              unit: "people",
              period: s.newArrivals ? formatPeriod(s.newArrivals.period) : "",
              change: s.newArrivals?.change,
              compare: s.newArrivals?.compare,
              note: "Became permanent residents on arrival",
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "arrivals",
              label: "Immigrants and refugees",
              title: "People who arranged permanent entry before they came",
              subtitle: "Per fiscal year · immigrant visas from a consulate, refugee status approved abroad",
              kind: "time",
              type: "column",
              series: d.fromAbroad.arrivals,
              unit: "people",
              source: SOURCES.yearbook,
            },
            {
              key: "vwp",
              label: "Visa Waiver travel",
              title: "Visitors admitted under the Visa Waiver Program",
              subtitle: "Per fiscal year · business and tourist trips with an ESTA instead of a visa; repeat trips count again",
              kind: "time",
              type: "column",
              series: d.fromAbroad.visaWaiver,
              unit: "admissions",
              source: SOURCES.yearbook,
            },
          ]}
        />
      ),
      ports: hasPoints(ofo) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Found inadmissible at ports",
              value: s.ofo12?.value,
              unit: "encounters",
              period: trailing,
              note: s.ofo12 ? `${pct(s.ofo12.share)} of all CBP encounters` : undefined,
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "inadmissible",
              label: "Found inadmissible",
              title: "People found inadmissible at ports of entry",
              subtitle: "Monthly · CBP Office of Field Operations · events, not people",
              kind: "time",
              type: "column",
              series: ofo,
              unit: "encounters",
              markers: BORDER_MARKERS,
              source: SOURCES.cbp,
            },
            ...(hasPoints(d.ports.cbpOne)
              ? [
                  {
                    key: "cbp-one",
                    label: "CBP One appointments",
                    title: "Appointments at southwest border ports booked through CBP One",
                    subtitle: "Monthly · the app's scheduling ended in January 2025",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.ports.cbpOne,
                    unit: "appointments",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
            ...(hasPoints(d.ports.paroles)
              ? [
                  {
                    key: "paroles",
                    label: "Paroled at ports",
                    title: "People paroled at southwest border ports",
                    subtitle: "Per fiscal year · initial outcome of a port encounter",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.ports.paroles,
                    unit: "people",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
          ]}
          secondaryLabel="Where and who"
          secondary={[
            {
              key: "offices",
              label: "Field offices",
              title: "Ports' field offices",
              subtitle: `${trailing} · inadmissibility findings`,
              kind: "ranked",
              items: d.ports.offices,
              itemLabel: "Field office",
              unit: "encounters",
              slot: 3,
              source: SOURCES.cbp,
            },
            ...(d.ports.cbpOneByCountry.length
              ? [
                  {
                    key: "cbp-one-country",
                    label: "CBP One nationality",
                    title: "CBP One appointments by nationality",
                    subtitle: d.ports.cbpOneRange,
                    kind: "ranked" as const,
                    items: d.ports.cbpOneByCountry,
                    itemLabel: "Nationality",
                    unit: "appointments",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
          ]}
        />
      ),
      betweenPorts: hasPoints(usbp) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Border Patrol apprehensions",
              value: s.usbp12?.value,
              unit: "encounters",
              period: trailing,
              note: s.usbp12 ? `${pct(s.usbp12.share)} of all CBP encounters` : undefined,
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "apprehensions",
              label: "Apprehensions",
              title: "Border Patrol apprehensions between ports",
              subtitle: "Monthly · includes Title 42 expulsions · events, not people",
              kind: "time",
              type: "column",
              series: usbp,
              unit: "encounters",
              markers: BORDER_MARKERS,
              source: SOURCES.cbp,
            },
            ...(hasPoints(d.between.bookouts)
              ? [
                  {
                    key: "next",
                    label: "What happened next",
                    title: "What happened after a Border Patrol apprehension at the southwest border",
                    subtitle: "Per fiscal year · the first outcome; someone released can later be removed",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.between.bookouts,
                    unit: "people",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
          ]}
          secondaryLabel="Where"
          secondary={[
            {
              key: "sectors",
              label: "Sectors",
              title: "Border Patrol sectors",
              subtitle: trailing,
              kind: "ranked",
              items: d.between.sectors,
              itemLabel: "Sector",
              unit: "encounters",
              source: SOURCES.cbp,
            },
          ]}
        />
      ),
      inside: hasPoints(d.legal.lprSplit) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Green cards to people already here",
              value: s.adjustments?.value,
              unit: "people",
              period: s.adjustments ? formatPeriod(s.adjustments.period) : "",
              note: s.adjustments ? `${pct(s.adjustments.share)} of all new green cards` : undefined,
            },
          ]}
          primary={[
            {
              key: "split",
              label: "Already here or arriving",
              title: "New green cards: adjusted inside the U.S. or arrived with an immigrant visa",
              subtitle: "Per fiscal year",
              kind: "time",
              type: "column",
              series: d.legal.lprSplit,
              unit: "people",
              source: SOURCES.yearbook,
            },
          ]}
        />
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
              key: "group",
              label: "Who",
              note: "Single adults; members of family units and other accompanied children; and unaccompanied children, who are transferred to HHS custody.",
            },
          ]}
          series={d.border.series}
          markers={BORDER_MARKERS}
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
    },
    headlines: {
      visas: head(
        s.newArrivals?.value,
        `arrived with an immigrant visa, ${s.newArrivals ? formatPeriod(s.newArrivals.period) : ""}`,
        recent(d.fromAbroad.arrivals[0].points),
      ),
      ports: head(s.ofo12?.value, `found inadmissible at ports, ${trailing}`, recent(summed(ofo), 36)),
      betweenPorts: head(s.usbp12?.value, `Border Patrol apprehensions, ${trailing}`, recent(summed(usbp), 36)),
      inside: head(
        s.adjustments?.share,
        `of new green cards went to people already here, ${s.adjustments ? formatPeriod(s.adjustments.period) : ""}`,
        undefined,
        "percent",
      ),
      border: head(
        s.encounters12?.value,
        `CBP encounters, ${trailing}`,
        recent(summed(d.border.series.nation?.authority ?? []), 36),
      ),
    },
  };
}
