import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { GreenCardChapter } from "@/components/immigration/green-card-explorer";
import { formatPeriod } from "@/lib/format";
import { head, hasPoints, recent, summed, type FigureContext, type StageFigures } from "./shared";

// Stage 2: the routes people take — permanent, temporary, humanitarian, and
// how people come to lack status.
export function pathwaysFigures({ d, SOURCES }: FigureContext): StageFigures {
  const s = d.stats;
  return {
    stats: {
      greenCards: (
        <GreenCardChapter
          // Pathways and the adjusted/arrived split each lead their own figure elsewhere.
          omit={["citizenship", "pathways", "status"]}
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
      overstays: hasPoints(d.overstays.byType) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Suspected in-country overstays",
              value: s.overstays?.value,
              unit: "people",
              period: s.overstays ? `End of ${formatPeriod(s.overstays.period)}` : "",
              change: s.overstays?.change,
              compare: s.overstays?.compare,
              note: s.overstays?.rate != null ? `${s.overstays.rate}% of visitors due to leave by air or sea` : undefined,
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "type",
              label: "By type of visitor",
              title: "Visitors still believed to be in the U.S. after their stay ended",
              subtitle: "Air and sea arrivals · counted at the end of each fiscal year",
              kind: "time",
              type: "column",
              series: d.overstays.byType,
              unit: "people",
              source: SOURCES.overstays,
              note: "Later departures and changes of status lower each year's count; CBP's next report revises it.",
            },
            {
              key: "rate",
              label: "Rate",
              title: "Suspected in-country overstay rate",
              subtitle: "Share of air and sea visitors whose stay ended in the fiscal year",
              kind: "time",
              series: d.overstays.rate,
              unit: "percent",
              source: SOURCES.overstays,
            },
          ]}
        />
      ),
      humanitarianDemand: hasPoints(d.courts.asylumFiled) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Asylum applications filed in immigration court",
              value: s.asylumFiled?.value,
              unit: "applications",
              period: s.asylumFiled ? formatPeriod(s.asylumFiled.period) : "",
              change: s.asylumFiled?.change,
              compare: s.asylumFiled?.compare,
            },
            ...(s.refugeeCeiling
              ? [
                  {
                    label: "Refugees admitted",
                    value: s.refugeeCeiling.admitted,
                    unit: "people",
                    period: formatPeriod(s.refugeeCeiling.period),
                    note: `Ceiling: ${s.refugeeCeiling.ceiling.toLocaleString("en-US")}`,
                  },
                ]
              : []),
          ]}
          primaryLabel="Measure"
          primary={[
            ...(hasPoints(d.refugeeCeilings)
              ? [
                  {
                    key: "ceiling",
                    label: "Refugee ceiling",
                    title: "Refugee admissions: the ceiling and how many came",
                    subtitle: "Per fiscal year · the ceiling is a maximum set by the President",
                    kind: "time" as const,
                    series: d.refugeeCeilings,
                    unit: "people",
                    source: SOURCES.refugees,
                  },
                ]
              : []),
            {
              key: "filed",
              label: "Asylum applications",
              title: "Asylum applications filed in immigration court",
              subtitle: "Per fiscal year · USCIS referrals and applications made in removal proceedings",
              kind: "time",
              type: "column",
              series: d.courts.asylumFiled,
              unit: "applications",
              source: SOURCES.eoir,
              note: "Applications decided by USCIS asylum officers and granted there never reach court, so they are not counted here.",
            },
            ...(hasPoints(d.chnv)
              ? [
                  {
                    key: "chnv",
                    label: "CHNV parole",
                    title: "Cubans, Haitians, Nicaraguans, and Venezuelans paroled with a U.S. sponsor",
                    subtitle: "Monthly · the process stopped taking new travelers in January 2025",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.chnv,
                    unit: "people",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
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
    },
    headlines: {
      greenCards: head(
        s.lpr?.value,
        `new green cards, ${s.lpr ? formatPeriod(s.lpr.period) : ""}`,
        recent(d.legal.lprHistory[0].points),
      ),
      temporary: head(
        s.temporary?.value,
        `temporary admissions, ${s.temporary ? formatPeriod(s.temporary.period) : ""}`,
        recent(d.temporary.i94[0].points),
      ),
      overstays: head(
        s.overstays?.value,
        `suspected in-country overstays, end of ${s.overstays ? formatPeriod(s.overstays.period) : ""}`,
        recent(summed(d.overstays.byType)),
      ),
      humanitarianDemand: head(
        s.asylumFiled?.value,
        `asylum applications filed in court, ${s.asylumFiled ? formatPeriod(s.asylumFiled.period) : ""}`,
        recent(summed(d.courts.asylumFiled)),
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
    },
  };
}
