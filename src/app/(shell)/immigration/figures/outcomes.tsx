import { ChapterExplorer } from "@/components/immigration/chapter-explorer";
import { formatPeriod } from "@/lib/format";
import { head, hasPoints, pct, recent, summed, type FigureContext, type StageFigures } from "./shared";

// Stage 4: the legally distinct results a case can end in.
export function outcomesFigures({ d, SOURCES }: FigureContext): StageFigures {
  const s = d.stats;
  const removals = d.enforcement.repatriations.filter((x) => x.id === "removals");

  const outcomesPeriod = s.courtOutcomes ? formatPeriod(s.courtOutcomes.period) : "";

  return {
    stats: {
      extensions: hasPoints(d.uscis.i539Decisions) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Extensions and changes of status approved",
              value: s.extensions?.value,
              unit: "forms",
              period: s.extensions ? formatPeriod(s.extensions.period) : "",
              change: s.extensions?.change,
              compare: s.extensions?.compare,
              note:
                s.extensions?.denied != null
                  ? `${pct((s.extensions.denied / (s.extensions.value + s.extensions.denied)) * 100)} of decisions were denials`
                  : undefined,
            },
          ]}
          primaryLabel="Decisions"
          primary={[
            {
              key: "i539",
              label: "Extensions and changes (I-539)",
              title: "Requests to extend or change a temporary status, decided",
              subtitle: "Per fiscal year · mostly visitors, students, and family of workers",
              kind: "time",
              type: "column",
              series: d.uscis.i539Decisions,
              unit: "forms",
              source: SOURCES.uscis,
            },
            {
              key: "i129",
              label: "Worker petitions (I-129)",
              title: "Temporary worker petitions, decided",
              subtitle: "Per fiscal year · includes new hires, extensions, and changes of employer",
              kind: "time",
              type: "column",
              series: d.uscis.i129Decisions,
              unit: "forms",
              source: SOURCES.uscis,
            },
          ]}
        />
      ),
      relief: d.courtOutcomes.items.length > 0 && (
        <ChapterExplorer
          metrics={[
            {
              label: "Relief granted by immigration judges",
              value: s.courtOutcomes?.relief,
              unit: "cases",
              period: `${outcomesPeriod} to date`,
            },
            {
              label: "Cases terminated or dismissed",
              value: s.courtOutcomes?.termination,
              unit: "cases",
              period: `${outcomesPeriod} to date`,
            },
          ]}
          primary={[
            {
              key: "outcomes",
              label: "How removal cases ended",
              title: "Immigration judges' decisions in removal cases",
              subtitle: `${outcomesPeriod} to date · initial decisions; EOIR publishes the current year only`,
              kind: "ranked",
              items: d.courtOutcomes.items,
              itemLabel: "Outcome",
              unit: "cases",
              source: SOURCES.eoir,
              note: "Relief includes asylum, cancellation of removal, and adjustment of status granted by a judge. Withholding of removal and Convention Against Torture protection, granted alongside a removal order, are left out.",
            },
          ]}
        />
      ),
      lprClass: hasPoints(d.outcomes.lprGroups) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Family-based green cards",
              value: s.lprClass?.family,
              unit: "people",
              period: s.lprClass ? formatPeriod(s.lprClass.period) : "",
              note:
                s.lprClass?.total && s.lprClass.family
                  ? `${pct((s.lprClass.family / s.lprClass.total) * 100)} of all new green cards`
                  : undefined,
            },
          ]}
          primaryLabel="Category"
          primary={[
            {
              key: "groups",
              label: "Over time",
              title: "New green cards by category",
              subtitle: "Per fiscal year · family includes immediate relatives of U.S. citizens",
              kind: "time",
              type: "column",
              series: d.outcomes.lprGroups,
              unit: "people",
              source: SOURCES.yearbook,
            },
          ]}
          secondaryLabel="Class"
          secondary={[
            {
              key: "classes",
              label: "Largest classes",
              title: "New green cards by class of admission",
              subtitle: formatPeriod(d.legal.pathways.period),
              kind: "ranked",
              items: d.legal.pathways.items,
              itemLabel: "Class",
              unit: "people",
              source: SOURCES.yearbook,
            },
          ]}
        />
      ),
      protectionGrants: hasPoints(d.outcomes.protection) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Refugees admitted plus people granted asylum",
              value: s.protection?.value,
              unit: "people",
              period: s.protection ? formatPeriod(s.protection.period) : "",
            },
          ]}
          primary={[
            {
              key: "grants",
              label: "By route",
              title: "People granted humanitarian protection",
              subtitle: "Per fiscal year · refugees approved abroad, asylum granted after arrival",
              kind: "time",
              type: "column",
              series: d.outcomes.protection,
              unit: "people",
              source: SOURCES.yearbook,
            },
          ]}
        />
      ),
      voluntaryDeparture: hasPoints(d.departures.voluntaryDeparture) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Voluntary departures carried out",
              value: s.voluntaryDeparture?.value,
              unit: "people",
              period: s.voluntaryDeparture ? formatPeriod(s.voluntaryDeparture.period) : "",
              change: s.voluntaryDeparture?.change,
              compare: s.voluntaryDeparture?.compare,
            },
            ...(s.courtOutcomes?.voluntaryDeparture
              ? [
                  {
                    label: "Granted by judges, with withdrawals at ports",
                    value: s.courtOutcomes.voluntaryDeparture,
                    unit: "cases",
                    period: `${outcomesPeriod} to date`,
                    note: "EOIR counts voluntary departure together with withdrawals of the application for admission; DHS counts only departures it confirmed.",
                  },
                ]
              : []),
          ]}
          primary={[
            {
              key: "vd",
              label: "Departures",
              title: "Voluntary departures carried out",
              subtitle: "Per fiscal year · granted by ICE or an immigration judge, confirmed by DHS",
              kind: "time",
              type: "column",
              series: d.departures.voluntaryDeparture,
              unit: "people",
              source: SOURCES.ohss,
            },
          ]}
        />
      ),
      returns: hasPoints(d.departures.returnsHistory) && (
        <ChapterExplorer
          metrics={[
            {
              label: "Returns and expulsions",
              value: s.returns?.value,
              unit: "events",
              period: s.returns ? formatPeriod(s.returns.period) : "",
            },
          ]}
          primaryLabel="Measure"
          primary={[
            ...(hasPoints(d.departures.returnsByType)
              ? [
                  {
                    key: "type",
                    label: "By type",
                    title: "Departures without a removal order",
                    subtitle: "Per fiscal year · events, not people",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.departures.returnsByType,
                    unit: "events",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
            {
              key: "history",
              label: "Since 1927",
              title: "Returns and Title 42 expulsions",
              subtitle: "Per fiscal year · events, not people",
              kind: "time",
              type: "column",
              series: d.departures.returnsHistory,
              unit: "events",
              markers: [{ x: 1996, label: "IIRIRA" }],
              source: SOURCES.yearbook,
              note: "Before the 1996 law created expedited removal, most people caught at the border were returned without an order.",
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
          primaryLabel="Measure"
          primary={[
            ...(hasPoints(d.departures.removalsByType)
              ? [
                  {
                    key: "type",
                    label: "By procedure",
                    title: "Removals by procedure",
                    subtitle: "Per fiscal year · events, not people",
                    kind: "time" as const,
                    type: "column" as const,
                    series: d.departures.removalsByType,
                    unit: "events",
                    source: SOURCES.ohss,
                  },
                ]
              : []),
            {
              key: "history",
              label: "1892–present",
              title: "Removals since 1892",
              subtitle: "DHS and predecessors, per fiscal year · events, not people",
              kind: "time",
              type: "column",
              series: removals,
              unit: "events",
              markers: [
                { x: 1924, label: "1924 quotas" },
                { x: 1996, label: "IIRIRA" },
              ],
              source: SOURCES.yearbook,
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
    },
    headlines: {
      extensions: head(
        s.extensions?.value,
        `extensions and changes of status approved, ${s.extensions ? formatPeriod(s.extensions.period) : ""}`,
        recent(d.uscis.i539Decisions[0].points),
      ),
      relief: head(s.courtOutcomes?.relief, `granted relief by immigration judges, ${outcomesPeriod} to date`),
      lprClass: head(
        s.lprClass?.family,
        `family-based green cards, ${s.lprClass ? formatPeriod(s.lprClass.period) : ""}`,
        recent(d.outcomes.lprGroups[0]?.points),
      ),
      protectionGrants: head(
        s.protection?.value,
        `refugees admitted and people granted asylum, ${s.protection ? formatPeriod(s.protection.period) : ""}`,
        recent(summed(d.outcomes.protection)),
      ),
      voluntaryDeparture: head(
        s.voluntaryDeparture?.value,
        `voluntary departures, ${s.voluntaryDeparture ? formatPeriod(s.voluntaryDeparture.period) : ""}`,
        recent(d.departures.voluntaryDeparture[0]?.points),
      ),
      returns: head(
        s.returns?.value,
        `returns and expulsions, ${s.returns ? formatPeriod(s.returns.period) : ""}`,
        recent(summed(d.departures.returnsByType)),
      ),
      removals: head(
        s.removals?.value,
        `removals, ${s.removals ? formatPeriod(s.removals.period) : ""}`,
        recent(removals[0]?.points),
      ),
    },
  };
}
