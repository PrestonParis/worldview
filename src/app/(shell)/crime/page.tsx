import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RankedBars } from "@/components/charts/ranked-bars";
import { SourceLines } from "@/components/charts/chart-card";
import { citeFrom } from "@/components/charts/citation";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CitiesTable } from "@/components/crime/cities-table";
import { CrimeAtlas } from "@/components/crime/crime-atlas";
import { CrimeTrends } from "@/components/crime/crime-trends";
import { DataDownloads } from "@/components/crime/data-downloads";
import { PoliceResponse } from "@/components/crime/police-response";
import { ReportingViews } from "@/components/crime/reporting-views";
import { CrimeSelectionProvider } from "@/components/crime/selection";
import { IssueHeader } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
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
const card = "min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800";
const cardTitle = "text-base font-semibold text-slate-950 dark:text-white";
const cardSub = "mt-1 text-sm text-slate-500 dark:text-slate-400";

function Section({ id, n, title, question, children }: { id: string; n: number; title: string; question: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">{String(n).padStart(2, "0")}</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">{question}</p>
      </div>
      {children}
    </section>
  );
}

// A collapsible module in Special topics & data.
function Module({ title, summary, open = false, children }: { title: string; summary: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-slate-200 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-lg font-semibold text-slate-950 dark:text-white">{title}</span>
          <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{summary}</span>
        </span>
        <ChevronDown className="mt-1 size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-5 border-t border-slate-200 p-5 dark:border-slate-800">{children}</div>
    </details>
  );
}

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
  const sections = [
    ["atlas", "Crime Atlas"],
    ["trends", "Trends"],
    ...(d.victimization ? [["reporting", "Victimization & reporting"] as const] : []),
    ["response", "Police response"],
    ...(d.deaths ? [["homicide", "Homicide"] as const] : []),
    ["topics", "Special topics & data"],
  ] as const;
  let n = 0;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="space-y-5">
        <IssueHeader title="Crime">
          <p className="mt-4 max-w-3xl text-xl leading-8 text-slate-700 dark:text-slate-200">
            Explore crime across the United States by offense, state, city police department, and year — then see what police statistics miss,
            what police clear, and how death records count homicide.
          </p>
        </IssueHeader>
        <dl className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Annual series</dt>
            <dd className="font-semibold text-slate-950 dark:text-white">
              {baseYear}–{year} · every month reported
            </dd>
          </div>
          {d.prelim && (
            <div className="rounded-xl border border-dashed border-amber-400/70 px-4 py-2.5 dark:border-amber-500/50">
              <dt className="text-xs text-amber-700 dark:text-amber-400">{d.prelim.year} preliminary</dt>
              <dd className="font-semibold text-slate-950 dark:text-white">
                {d.prelim.span ? `${d.prelim.span} comparable` : "No comparable months yet"}
                <span className="font-normal text-slate-500 dark:text-slate-400"> · reported through {d.prelim.latestReported.label}</span>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <SectionNav sections={sections} />

      <CrimeSelectionProvider years={d.states.years} prelimYear={d.prelim?.year ?? null} states={d.states.rows.map((r) => r.abbr)}>
        <div className="space-y-14">
          <Section id="atlas" n={++n} title="Crime Atlas" question="What happened, where, and when? Pick an offense, a place, and a year — the map, the profile, and the history move together.">
            <CrimeAtlas
              data={d.states}
              offenses={d.offenses}
              flaggedYears={d.flaggedYears}
              prelim={d.prelim}
              map={{ width: map.width, height: map.height, states: map.states }}
              cities={d.cities}
              cityPoints={cityPoints}
            />
            <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              Rates per 100,000 residents for the 50 states and the District of Columbia, from offenses reported to the FBI by participating agencies.
              DC is ranked alongside the states, though as a single city it has no rural areas to average in. City figures are each police
              department&apos;s, for the jurisdiction and population it serves.
            </p>
            <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-cde-cities")} />
          </Section>

          <Section id="trends" n={++n} title="Crime trends" question={`How has each offense moved since ${baseYear}?`}>
            <CrimeTrends offenses={d.offenses} flaggedYears={d.flaggedYears} baseYear={baseYear} />
            <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              Annual rates for complete calendar years. The index view puts every offense on one scale.
              {d.flaggedYears.length > 0 && (
                <>
                  {" "}
                  {d.flaggedYears.map((f) => f.year).join(", ")} is marked: the FBI&apos;s switch to NIBRS left agencies covering only{" "}
                  {d.flaggedYears.map((f) => formatValue(f.coverage, "percent")).join(", ")} of residents reporting, so its rates read low.
                </>
              )}
              {d.prelim && <> {d.prelim.year} preliminary figures are in the Atlas&apos;s Period switch.</>}
            </p>
            <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
          </Section>

          {d.victimization && (
            <Section id="reporting" n={++n} title="Victimization & reporting" question="What do police statistics miss? Surveys count crime whether or not anyone told the police.">
              <MeasurementFlow d={d} />
              <ReportingViews v={d.victimization} />
              <SourceLines sources={citeFrom(d.datasets, "bjs-ncvs", "fbi-cde", "cdc-violent-deaths")} />
            </Section>
          )}

          <Section id="response" n={++n} title="Police response" question="Of the offenses police record, how many are cleared — and what are people arrested for?">
            <PoliceResponse offenses={d.offenses} year={year} flaggedYears={d.flaggedYears} arrests={d.arrests} />
            <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-arrests")} />
          </Section>
        </div>
      </CrimeSelectionProvider>

      {d.deaths && (
        <Section id="homicide" n={++n} title="Homicide" question="How does the count of homicide change with the system doing the counting?">
          <Homicide d={d} />
        </Section>
      )}

      <Section id="topics" n={++n} title="Special topics & data" question="Measures that follow their own rules, and every table behind the page.">
        {d.hate && <HateCrime d={d} />}
        {d.cities.length > 0 && (
          <Module title="City police departments" summary={`${d.cities.length} departments serving cities over 100,000, ${year} — sortable and searchable`}>
            <CitiesTable rows={d.cities} year={year} />
            <SourceLines sources={citeFrom(d.datasets, "fbi-cde-cities")} />
          </Module>
        )}
        <Module title="National rates table" summary={`Every offense against ${d.priorYear}, ${d.preYear}, ${baseYear}, and its peak`}>
          <ChangeTable d={d} />
          <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
        </Module>
        <Module title="Downloads, definitions & sources" summary="CSV exports and what each measure counts">
          <DataDownloads offenses={d.offenses} states={d.states} cities={d.cities} year={year} />
          <Definitions />
          <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-cde-cities", "bjs-ncvs", "cdc-violent-deaths", "fbi-hate-crime", "fbi-arrests")} />
        </Module>
      </Section>
    </div>
  );
}

// How an incident reaches each statistic. Each figure carries its own year
// and population; the lanes are parallel systems, not one funnel.
function MeasurementFlow({ d }: { d: CrimeData }) {
  const v = d.victimization!;
  const violent = d.offenses.find((o) => o.key === "violent_crime")!;
  const murder = d.offenses.find((o) => o.key === "homicide")!;
  const at = (s: YearValue[], y: string | null) => s.find((p) => p.year === y)?.value ?? null;
  const usCov = d.states.usCoverage.at(-1) ?? null;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">How crime enters official statistics</p>
      <Lane
        name="Nonfatal crime"
        steps={[
          { stage: "Victimization", source: "BJS survey", value: formatValue(v.latest.violent, "per_1000"), caption: `violent victimizations per 1,000 people 12+, ${v.year}, reported or not` },
          { stage: "Reported to police", source: "BJS survey", value: formatValue(v.latest.violentReported, "percent"), caption: `of violent victimizations, ${v.year}` },
          {
            stage: "Recorded by police",
            source: "FBI",
            value: formatValue(violent.latest, "per_100k"),
            caption: `violent offenses per 100,000 residents, ${d.year}${usCov !== null ? ` · agencies covering ${formatValue(usCov, "percent")} of residents` : ""}`,
          },
          { stage: "Cleared", source: "FBI", value: formatValue(at(violent.cleared, d.year), "percent"), caption: `of violent offenses, by arrest or exceptional means, ${d.year}` },
        ]}
      />
      {d.deaths && (
        <Lane
          name="Homicide"
          steps={[
            { stage: "Death certificate", source: "CDC", value: formatValue(d.deaths.homicide.at(-1)?.value, "per_100k"), caption: `homicide deaths per 100,000, ${d.deaths.year}` },
            { stage: "Recorded by police", source: "FBI", value: formatValue(murder.latest, "per_100k"), caption: `murders per 100,000, ${d.year}` },
            { stage: "Cleared", source: "FBI", value: formatValue(at(murder.cleared, d.year), "percent"), caption: `of murders, ${d.year}` },
          ]}
        />
      )}
      <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
        The survey interviews people 12 and older in households, so it has no homicide figure and counts crimes against people, not
        businesses; the FBI counts offenses known to participating agencies; death certificates cover every death. Each figure is labeled with its
        own year and population.
      </p>
    </div>
  );
}

function Lane({ name, steps }: { name: string; steps: { stage: string; source: string; value: string; caption: string }[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-stretch">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase md:pt-3 dark:text-slate-400">{name}</p>
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {steps.map((s, k) => (
          <li key={s.stage} className="flex flex-col gap-2 md:flex-1 md:flex-row md:items-center">
            {k > 0 && <ChevronRight className="mx-auto size-4 shrink-0 rotate-90 text-slate-400 md:rotate-0" aria-hidden />}
            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-3 md:h-full dark:border-slate-800 dark:bg-slate-950">
              <p className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{s.stage}</span>
                <span className="text-slate-400">{s.source}</span>
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{s.value}</p>
              <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">{s.caption}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Homicide({ d }: { d: CrimeData }) {
  const c = d.deaths!;
  const murder = d.offenses.find((o) => o.key === "homicide")!;
  const cov = d.states.usCoverage.at(-1) ?? null;
  const prev = c.homicide.at(-2);
  const rows: [string, string, string][] = [
    [
      "What counts",
      "Murder and nonnegligent manslaughter: the willful killing of one person by another. Justifiable homicides, accidents, and negligent manslaughter are excluded.",
      "Any death certified as caused by another person's intent to injure or kill, including killings in self-defense. Deaths from police use of force are a separate category.",
    ],
    ["Who records it", "Police agencies, as offenses known to them", "Medical examiners and coroners, on death certificates"],
    ["Coverage", `Agencies that reported — ${formatValue(cov, "percent")} of residents in ${d.year}`, "Every death in the United States"],
    ["Latest", `${formatValue(murder.latest, "per_100k")} per 100,000 in ${d.year}`, `${formatValue(c.homicide.at(-1)?.value, "per_100k")} per 100,000 in ${c.year}`],
  ];
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Two counts of homicide</p>
            <p className={cardSub}>Per 100,000 residents</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="per_100k"
              height={300}
              markers={d.flaggedYears.map((f) => ({ x: Number(f.year), label: "FBI partial reporting" }))}
              series={[
                { id: "cdc", label: "Homicide deaths (CDC)", slot: 1, points: pts(c.homicide) },
                { id: "cdc-fa", label: "Firearm homicide deaths (CDC)", slot: 3, points: pts(c.firearmHomicide) },
                { id: "fbi", label: "Murders reported to police (FBI)", slot: 2, points: pts(murder.rates) },
              ]}
            />
          </div>
          <dl className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3 dark:border-slate-800">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Homicide deaths, {c.year}</dt>
              <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">
                {formatValue(c.deaths, "deaths")}
                {prev && <span className="ml-1 text-xs font-normal text-slate-500">rate {signed(((c.homicide.at(-1)!.value - prev.value) / prev.value) * 100)} vs {prev.year}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">By firearm, {c.year}</dt>
              <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(c.firearmShare, "percent")} of homicide deaths</dd>
            </div>
            {c.ttm && (
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Latest 12 months, provisional</dt>
                <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">
                  {formatValue(c.ttm.homicide, "per_100k")} per 100,000
                  <span className="block text-xs font-normal text-slate-500">{c.ttm.range ?? `through ${c.ttm.through}`}</span>
                </dd>
              </div>
            )}
          </dl>
        </figure>
        <div className={card}>
          <p className={cardTitle}>How the two counts differ</p>
          <dl className="mt-4 space-y-4 text-sm">
            {rows.map(([label, fbi, cdc]) => (
              <div key={label}>
                <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</dt>
                <dd className="mt-1 grid gap-2 sm:grid-cols-2">
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: "var(--viz-series-2)" }} aria-hidden />
                    <span className="font-medium">FBI:</span> {fbi}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: "var(--viz-series-1)" }} aria-hidden />
                    <span className="font-medium">CDC:</span> {cdc}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <SourceLines sources={citeFrom(d.datasets, "cdc-violent-deaths", "fbi-cde")} />
    </>
  );
}

function HateCrime({ d }: { d: CrimeData }) {
  const hate = d.hate!;
  return (
    <Module
      title="Hate crime"
      summary={`${formatValue(hate.total.at(-1)!.value, "incidents")} incidents in ${hate.year}${hate.change !== null ? ` · ${formatSigned(hate.change, "percent")} vs ${hate.total.at(-2)?.year}` : ""}`}
      open
    >
      <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        Incidents an agency classifies as motivated, in whole or in part, by bias against a victim&apos;s group. Totals are counts from the agencies
        that submitted hate crime data that year, so they rise and fall with participation as well as with incidents.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Incidents reported</p>
            <p className={cardSub}>Per year</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart type="column" height={240} unit="incidents" series={[{ id: "hate", label: "Incidents", slot: 1, points: pts(hate.total) }]} />
          </div>
        </figure>
        <figure className={card}>
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
    </Module>
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
