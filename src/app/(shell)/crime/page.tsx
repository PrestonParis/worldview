import type { Metadata } from "next";
import { RankedBars } from "@/components/charts/ranked-bars";
import { SourceLines } from "@/components/charts/chart-card";
import { citeFrom } from "@/components/charts/citation";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CitiesTable } from "@/components/crime/cities-table";
import { CrimeAtlas } from "@/components/crime/crime-atlas";
import { CrimeTrends } from "@/components/crime/crime-trends";
import { CrimeViews, ViewTabs, type CrimeView } from "@/components/crime/crime-views";
import { DataDownloads } from "@/components/crime/data-downloads";
import { HomicideCompare } from "@/components/crime/homicide-compare";
import { PoliceResponse } from "@/components/crime/police-response";
import { ReportingViews } from "@/components/crime/reporting-views";
import { CrimeSelectionProvider } from "@/components/crime/selection";
import cityCoords from "@/lib/crime/city-coords.json";
import { loadCrime, type CrimeData } from "@/lib/crime/data";
import type { YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";
import { loadStatePaths, projectPoint } from "@/lib/geo/state-paths";
import { STATE_FIPS } from "@/lib/geo/states";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Crime | Worldview",
  description:
    "The Crime Atlas: reported crime in the United States by offense, state, city police department, and year, with victimization surveys, case clearance, and homicide death records.",
};

const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));
const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
const cardTitle = "text-base font-semibold text-slate-950 dark:text-white";
const cardSub = "mt-1 text-sm text-slate-500 dark:text-slate-400";

export default async function CrimePage() {
  const [d, map] = await Promise.all([loadCrime(), loadStatePaths()]);
  if (!d.year) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Crime</h1>
        <p className="mt-4 text-slate-500">No complete year of FBI data is loaded yet.</p>
      </div>
    );
  }
  const year = d.year;
  const baseYear = d.baseYear!;
  // Each city department's location on the state map, from the FBI agency directory.
  const coords = cityCoords as unknown as Record<string, [number, number]>;
  const cityPoints = Object.fromEntries(
    d.cities.flatMap((c) => (coords[c.ori] && STATE_FIPS[c.state] ? [[c.ori, projectPoint(map.frame, STATE_FIPS[c.state], ...coords[c.ori])]] : [])),
  );
  const violent = d.offenses.find((o) => o.key === "violent_crime")!;
  const murder = d.offenses.find((o) => o.key === "homicide")!;
  const at = (s: YearValue[], y: string | null) => s.find((p) => p.year === y)?.value ?? null;
  const usCov = d.states.usCoverage.at(-1) ?? null;
  const yearsLabel = `${baseYear}–${year}`;

  const views: CrimeView[] = [
    {
      id: "trends",
      label: "Trends",
      kicker: "Historical comparison",
      figure: signed(violent.vsBase),
      caption: `Violent crime rate, ${yearsLabel}, national`,
      spark: violent.rates.map((p) => p.value),
      scope: `FBI annual rates, ${yearsLabel} · compare offenses or places over any span`,
      content: (
        <>
          <CrimeTrends offenses={d.offenses} states={d.states} flaggedYears={d.flaggedYears} />
          <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
        </>
      ),
    },
    ...(d.victimization
      ? [
          {
            id: "reporting",
            label: "Reporting",
            kicker: "What the figures miss",
            figure: formatValue(d.victimization.latest.violentReported, "percent"),
            caption: `of violent victimizations reported to police, ${d.victimization.year}`,
            spark: d.victimization.violentReported.map((p) => p.value),
            scope: `BJS survey ${d.victimization.firstYear}–${d.victimization.year} · FBI ${year} · independent of the Atlas year`,
            content: (
              <>
                <ReportingViews
                  v={d.victimization}
                  police={{ year, violentRate: violent.latest, violentCleared: at(violent.cleared, year), coverage: usCov }}
                />
                <SourceLines sources={citeFrom(d.datasets, "bjs-ncvs", "fbi-cde")} />
              </>
            ),
          },
        ]
      : []),
    {
      id: "response",
      label: "Police response",
      kicker: "Clearance and arrests",
      figure: formatValue(at(violent.cleared, year), "percent"),
      caption: `of violent offenses cleared, ${year}`,
      spark: violent.cleared.map((p) => p.value),
      scope: `FBI clearances ${violent.cleared[0]?.year ?? baseYear}–${year} · follows the Atlas offense and year${d.arrests ? ` · arrests through ${d.arrests.year}` : ""}`,
      content: (
        <>
          <PoliceResponse offenses={d.offenses} latestYear={year} flaggedYears={d.flaggedYears} arrests={d.arrests} />
          <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-arrests")} />
        </>
      ),
    },
    ...(d.deaths
      ? [
          {
            id: "homicide",
            label: "Homicide",
            kicker: "FBI versus CDC",
            figure: `${formatValue(d.deaths.homicide.at(-1)?.value, "per_100k")} · ${formatValue(murder.latest, "per_100k")}`,
            caption: `CDC deaths (${d.deaths.year}) · FBI murders (${year}), per 100,000`,
            spark: d.deaths.homicide.map((p) => p.value),
            scope: `CDC death certificates ${d.deaths.homicide[0]?.year}–${d.deaths.year} · FBI ${yearsLabel} · independent of the Atlas year`,
            content: (
              <>
                <HomicideCompare deaths={d.deaths} murder={murder.rates} flaggedYears={d.flaggedYears} fbiYear={year} fbiCoverage={usCov} />
                <SourceLines sources={citeFrom(d.datasets, "cdc-violent-deaths", "fbi-cde")} />
              </>
            ),
          },
        ]
      : []),
    {
      id: "data",
      label: "Data Explorer",
      kicker: "Tables, hate crime, downloads",
      figure: String(d.cities.length || d.offenses.length),
      caption: d.cities.length ? `city police departments, ${year} · plus national tables and CSVs` : "offenses in the national table",
      scope: `Each tab carries its own year${d.hate ? ` · hate crime ${d.hate.year}` : ""} · cities and national table ${year}`,
      content: (
        <ViewTabs
          key="data"
          label="Data Explorer"
          tabs={[
            ...(d.cities.length
              ? [
                  {
                    id: "cities",
                    label: "City departments",
                    content: (
                      <>
                        <p className={cardSub}>{d.cities.length} departments serving cities over 100,000, {year} · sortable and searchable</p>
                        <CitiesTable rows={d.cities} year={year} />
                        <SourceLines sources={citeFrom(d.datasets, "fbi-cde-cities")} />
                      </>
                    ),
                  },
                ]
              : []),
            {
              id: "national",
              label: "National rates",
              content: (
                <>
                  <ChangeTable d={d} />
                  <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
                </>
              ),
            },
            ...(d.hate ? [{ id: "hate", label: "Hate crime", content: <HateCrime d={d} /> }] : []),
            {
              id: "downloads",
              label: "Downloads & definitions",
              content: (
                <>
                  <DataDownloads offenses={d.offenses} states={d.states} cities={d.cities} year={year} />
                  <Definitions />
                  <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-cde-cities", "bjs-ncvs", "cdc-violent-deaths", "fbi-hate-crime", "fbi-arrests")} />
                </>
              ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 sm:-mt-3">
      <CrimeSelectionProvider years={d.states.years} prelimYear={d.prelim?.year ?? null} states={d.states.rows.map((r) => r.abbr)}>
        <CrimeAtlas
          data={d.states}
          offenses={d.offenses}
          flaggedYears={d.flaggedYears}
          prelim={d.prelim}
          map={{ width: map.width, height: map.height, states: map.states }}
          cities={d.cities}
          cityPoints={cityPoints}
          sources={<SourceLines key="src" sources={citeFrom(d.datasets, "fbi-cde", "fbi-cde-cities")} />}
        />
        <CrimeViews views={views} />
      </CrimeSelectionProvider>
    </div>
  );
}

function HateCrime({ d }: { d: CrimeData }) {
  const hate = d.hate!;
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-950 dark:text-white">
          {formatValue(hate.total.at(-1)!.value, "incidents")} incidents in {hate.year}
          {hate.change !== null && ` · ${formatSigned(hate.change, "percent")} vs ${hate.total.at(-2)?.year}`}.
        </span>{" "}
        Incidents an agency classifies as motivated, in whole or in part, by bias against a victim&apos;s group, counted from the agencies that
        submitted hate crime data that year, so totals move with participation as well as with incidents.
      </p>
      <div className="grid gap-8 lg:grid-cols-2">
        <figure className="min-w-0">
          <figcaption>
            <p className={cardTitle}>Incidents reported</p>
            <p className={cardSub}>Per year</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart type="column" height={240} unit="incidents" series={[{ id: "hate", label: "Incidents", slot: 1, points: pts(hate.total) }]} />
          </div>
        </figure>
        <figure className="min-w-0">
          <figcaption>
            <p className={cardTitle}>By bias motivation, {hate.year}</p>
            <p className={cardSub}>Incidents</p>
          </figcaption>
          <div className="mt-4">
            <RankedBars unit="incidents" items={hate.byBias} />
          </div>
        </figure>
      </div>
      <SourceLines sources={citeFrom(d.datasets, "fbi-hate-crime")} />
    </div>
  );
}

// Every offense against the comparison years that give a rate context.
function ChangeTable({ d }: { d: CrimeData }) {
  const th = "px-3 py-2 text-right font-medium";
  const td = "px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300";
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-136 text-sm">
        <caption className="px-4 pt-4 text-left text-xs text-slate-500 dark:text-slate-400">Per 100,000 residents; peak excludes partial-reporting years</caption>
        <thead className="text-xs text-slate-500 dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-3 py-2 text-left font-medium">Offense</th>
            <th className={th}>{d.year}</th>
            <th className={th}>vs {d.priorYear}</th>
            <th className={th}>vs {d.preYear}</th>
            <th className={th}>vs {d.baseYear}</th>
            <th className={th}>Peak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {d.offenses.map((o) => (
            <tr key={o.key}>
              <td className={`py-1.5 pr-3 text-slate-700 dark:text-slate-200 ${o.key === "violent_crime" || o.key === "property_crime" ? "pl-3 font-medium" : "pl-6"}`}>{o.label}</td>
              <td className={`${td} font-medium text-slate-900 dark:text-white`}>{formatValue(o.latest, "per_100k")}</td>
              <td className={td}>{signed(o.change1y)}</td>
              <td className={td}>{signed(o.vsPre)}</td>
              <td className={td}>{signed(o.vsBase)}</td>
              <td className={td}>
                {o.peak ? (
                  <>
                    {formatValue(o.peak.value, "per_100k")} <span className="text-slate-400">{o.peak.year}</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Definitions() {
  const items: [string, string][] = [
    ["Rate per 100,000", "Offenses reported by participating agencies per 100,000 residents of the whole state or nation, so a year with agencies missing reads low."],
    ["Reporting coverage", "The share of residents served by agencies that submitted data, averaged over the year's months. Below 90%, a year is marked as partial reporting."],
    ["Preliminary year", "Months of the current year where agencies covering at least 85% of residents have reported, each scaled up by its own coverage and compared with the same months a year earlier."],
    ["Cleared", "An offense closed by an arrest, or by exceptional means when police identify the offender but cannot make an arrest. A clearance is not a conviction."],
    ["Arrest", "One arrest event, as reported by the arresting agency. One person can be arrested more than once in a year."],
    ["Victimization (BJS)", "A crime a survey respondent age 12 or older says they or their household experienced, whether or not police learned of it."],
    ["Homicide death (CDC)", "A death a medical examiner or coroner certifies as caused by another person's intent to injure or kill."],
    ["Police department", "An agency with its own FBI identifier (ORI). Its rate uses the population of its jurisdiction, which can differ from the city's boundaries."],
    ["States and DC", "Rates cover the 50 states and the District of Columbia. DC is ranked alongside the states, though as a single city it has no rural areas to average in."],
    ["Atlas shading", "Rate shades split the states into sevenths by rank for the year shown; change shades step at 2.5, 5, 10, and 20 percent."],
  ];
  return (
    <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
      {items.map(([term, def]) => (
        <div key={term}>
          <dt className="font-semibold text-slate-900 dark:text-white">{term}</dt>
          <dd className="mt-0.5 leading-6 text-slate-600 dark:text-slate-300">{def}</dd>
        </div>
      ))}
    </dl>
  );
}
