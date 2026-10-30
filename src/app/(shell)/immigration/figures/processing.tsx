import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { formatPeriod } from "@/lib/format";
import { head, hasPoints, pct, recent, summed, type FigureContext, type StageFigures } from "./shared";

// Stage 3: petitions, adjudications, and the enforcement and court system.
export function processingFigures({ d, SOURCES }: FigureContext): StageFigures {
  const s = d.stats;
  const partialNote = (latest: { period: string; value: number } | null | undefined, unit: string) =>
    latest && s.courts && latest.period !== s.courts.period
      ? `Latest count, ${formatPeriod(latest.period)} to date: ${latest.value.toLocaleString("en-US")} ${unit}`
      : undefined;

  // A partial year's pending count is a snapshot at the end of its last quarter.
  const asOfLabel = (x: { period: string; through: string | null } | null | undefined) =>
    !x ? "" : x.through ? `End of ${formatPeriod(x.through)}` : `End of ${formatPeriod(x.period)}`;

  return {
    stats: {
      petitions: hasPoints(d.uscis.petitionsPending) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Relative petitions pending (I-130)",
              value: s.petitions?.family,
              unit: "forms",
              period: asOfLabel(s.petitions),
            },
            {
              label: "Employer petitions pending (I-140)",
              value: s.petitions?.employment,
              unit: "forms",
              period: asOfLabel(s.petitions),
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "pending",
              label: "Pending",
              title: "Immigrant petitions waiting for a USCIS decision",
              subtitle: "At the end of each fiscal year; the latest is the end of the last reported quarter",
              kind: "time",
              type: "column",
              series: d.uscis.petitionsPending,
              unit: "forms",
              source: SOURCES.uscis,
            },
            {
              key: "received",
              label: "Filed",
              title: "Immigrant petitions filed",
              subtitle: "Per fiscal year",
              kind: "time",
              type: "column",
              series: d.uscis.petitionsReceived,
              unit: "forms",
              source: SOURCES.uscis,
            },
          ]}
          callout="An approved petition doesn't give a green card. Immediate relatives of U.S. citizens can then apply; other relatives and workers also wait for a visa number under the yearly limits."
        />
      ),
      adjustment: hasPoints(d.uscis.i485) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Green-card applications pending (I-485)",
              value: s.adjustment?.value,
              unit: "forms",
              period: asOfLabel(s.adjustment),
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "pending",
              label: "Pending",
              title: "Applications to adjust to permanent residence waiting for a decision",
              subtitle: "At the end of each fiscal year; the latest is the end of the last reported quarter",
              kind: "time",
              type: "column",
              series: d.uscis.i485Pending,
              unit: "forms",
              source: SOURCES.uscis,
            },
            {
              key: "flow",
              label: "Filed and decided",
              title: "Adjustment applications filed, approved, and denied",
              subtitle: "Per fiscal year",
              kind: "time",
              series: d.uscis.i485,
              unit: "forms",
              source: SOURCES.uscis,
            },
          ]}
          secondaryLabel="Category"
          secondary={
            d.uscis.i485ByCategory.items.length
              ? [
                  {
                    key: "category",
                    label: "Pending by category",
                    title: "Pending applications by category",
                    subtitle: formatPeriod(d.uscis.i485ByCategory.period),
                    kind: "ranked",
                    items: d.uscis.i485ByCategory.items,
                    itemLabel: "Category",
                    unit: "forms",
                    source: SOURCES.uscis,
                  },
                ]
              : undefined
          }
        />
      ),
      changeStatus: hasPoints(d.uscis.changeStatus) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Extension and change-of-status applications (I-539)",
              value: s.changeStatus?.value,
              unit: "forms",
              period: s.changeStatus ? formatPeriod(s.changeStatus.period) : "",
              change: s.changeStatus?.change,
              compare: s.changeStatus?.compare,
            },
          ]}
          primaryLabel="Measure"
          primary={[
            {
              key: "filed",
              label: "Filed",
              title: "Requests to extend or change a temporary status",
              subtitle: "Per fiscal year · worker petitions also cover new hires from abroad",
              kind: "time",
              type: "column",
              series: d.uscis.changeStatus,
              unit: "forms",
              source: SOURCES.uscis,
            },
            {
              key: "pending",
              label: "Pending",
              title: "I-539 applications waiting for a decision",
              subtitle: "At the end of each fiscal year; the latest is the end of the last reported quarter",
              kind: "time",
              type: "column",
              series: d.uscis.i539Pending,
              unit: "forms",
              source: SOURCES.uscis,
            },
          ]}
        />
      ),
      asylumCourt: hasPoints(d.courts.asylumDecisions) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Grant rate, grants and denials",
              value: s.asylumCourt?.value,
              unit: "percent",
              period: s.asylumCourt ? formatPeriod(s.asylumCourt.period) : "",
              change: s.asylumCourt?.change,
              compare: s.asylumCourt?.compare,
            },
            {
              label: "Asylum granted by judges",
              value: s.asylumCourt?.grants,
              unit: "cases",
              period: s.asylumCourt ? formatPeriod(s.asylumCourt.period) : "",
            },
            ...(s.credibleFear
              ? [
                  {
                    label: "Credible-fear screenings",
                    value: s.credibleFear.total,
                    unit: "cases",
                    period: formatPeriod(s.credibleFear.period),
                    note: `${pct(s.credibleFear.positiveShare)} found a credible fear`,
                  },
                ]
              : []),
          ]}
          primaryLabel="Decisions"
          primary={[
            {
              key: "decisions",
              label: "How cases ended",
              title: "Asylum cases completed in immigration court",
              subtitle: "Per fiscal year · by how the application ended",
              kind: "time",
              type: "column",
              series: d.courts.asylumDecisions,
              unit: "cases",
              source: SOURCES.eoir,
            },
            {
              key: "rate",
              label: "Grant rate",
              title: "Immigration court asylum grant rate",
              subtitle: "Per fiscal year · two denominators",
              kind: "time",
              series: d.courts.grantRates,
              unit: "percent",
              source: SOURCES.eoir,
              note: "The higher line divides grants by grants plus denials. The lower one divides by every asylum completion, including applications abandoned, withdrawn, or closed.",
            },
          ]}
          secondaryLabel="Screening"
          secondary={
            hasPoints(d.fear)
              ? [
                  {
                    key: "fear",
                    label: "Credible fear",
                    title: "Credible-fear screenings by result",
                    subtitle: "Per fiscal year · USCIS asylum officers, people in expedited removal",
                    kind: "time",
                    type: "column",
                    series: d.fear,
                    unit: "cases",
                    source: SOURCES.ohss,
                  },
                ]
              : undefined
          }
        />
      ),
      arrests: hasPoints(d.arrests.byCriminality) && (
        <ChapterExplorer
          metrics={[
            {
              label: "ICE arrests",
              value: s.arrests?.value,
              unit: "arrests",
              period: s.arrests ? formatPeriod(s.arrests.period) : "",
              change: s.arrests?.change,
              compare: s.arrests?.compare,
            },
          ]}
          primaryLabel="Arrests"
          primary={[
            {
              key: "criminality",
              label: "By criminal history",
              title: "ICE administrative arrests by criminal history",
              subtitle: "Per fiscal year · criminal history at the time of arrest",
              kind: "time",
              type: "column",
              series: d.arrests.byCriminality,
              unit: "arrests",
              source: SOURCES.ohss,
            },
          ]}
          secondaryLabel="Book-ins"
          secondary={
            hasPoints(d.arrests.bookins)
              ? [
                  {
                    key: "bookins",
                    label: "Who made the arrest",
                    title: "ICE detention book-ins by arresting agency",
                    subtitle: "Per fiscal year",
                    kind: "time",
                    type: "column",
                    series: d.arrests.bookins,
                    unit: "book-ins",
                    source: SOURCES.ohss,
                  },
                ]
              : undefined
          }
        />
      ),
      courts: hasPoints(d.courts.caseload) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Cases pending in immigration court",
              value: s.courts?.value,
              unit: "cases",
              period: s.courts ? `End of ${formatPeriod(s.courts.period)}` : "",
              change: s.courts?.change,
              compare: s.courts?.compare,
              note: partialNote(s.courts?.latest, "pending"),
            },
          ]}
          primaryLabel="Caseload"
          primary={[
            {
              key: "pending",
              label: "Backlog",
              title: "Cases pending in immigration court",
              subtitle: "At the end of each fiscal year",
              kind: "time",
              type: "column",
              series: d.courts.caseload,
              unit: "cases",
              source: SOURCES.eoir,
            },
            {
              key: "flow",
              label: "In and out",
              title: "New cases received and cases completed",
              subtitle: "Per fiscal year",
              kind: "time",
              series: d.courts.flow,
              unit: "cases",
              source: SOURCES.eoir,
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
    },
    headlines: {
      petitions: head(
        s.petitions?.value,
        `relative and employer petitions pending, ${asOfLabel(s.petitions).toLowerCase()}`,
        recent(summed(d.uscis.petitionsPending)),
      ),
      adjustment: head(
        s.adjustment?.value,
        `green-card applications pending, ${asOfLabel(s.adjustment).toLowerCase()}`,
        recent(d.uscis.i485Pending[0].points),
      ),
      changeStatus: head(
        s.changeStatus?.value,
        `requests to extend or change status, ${s.changeStatus ? formatPeriod(s.changeStatus.period) : ""}`,
        recent(d.uscis.changeStatus[0].points),
      ),
      asylumCourt: head(
        s.asylumCourt?.value,
        `of court asylum decisions were grants, ${s.asylumCourt ? formatPeriod(s.asylumCourt.period) : ""}`,
        recent(d.courts.grantRates[0].points),
        "percent",
      ),
      arrests: head(
        s.arrests?.value,
        `ICE arrests, ${s.arrests ? formatPeriod(s.arrests.period) : ""}`,
        recent(summed(d.arrests.byCriminality)),
      ),
      courts: head(
        s.courts?.value,
        `cases pending in immigration court, end of ${s.courts ? formatPeriod(s.courts.period) : ""}`,
        recent(d.courts.caseload[0].points),
      ),
      detention: head(
        s.detention?.value,
        `in ICE detention on an average day, ${s.detention ? formatPeriod(s.detention.period) : ""}`,
        recent(summed(d.enforcement.detention)),
      ),
    },
  };
}
