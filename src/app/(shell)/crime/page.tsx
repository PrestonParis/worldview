import type { Metadata } from "next";
import { RankedBars } from "@/components/charts/ranked-bars";
import { SourceLines } from "@/components/charts/chart-card";
import { citeFrom } from "@/components/charts/citation";
import { StatTile } from "@/components/charts/stat-tile";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CrimeStateExplorer } from "@/components/crime/crime-state-explorer";
import { CrimeTrends } from "@/components/crime/crime-trends";
import cityCoords from "@/lib/crime/city-coords.json";
import { loadCrime, type CrimeData } from "@/lib/crime/data";
import { loadStatePaths, projectPoint } from "@/lib/geo/state-paths";
import { STATE_FIPS } from "@/lib/geo/states";
import type { YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";
import { IssueHeader } from "@/components/data/issue-layout";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Crime | Worldview",
  description: "Reported crime in the United States — violent and property crime rates nationally and by state, from the FBI.",
};

const h2 = "text-2xl font-semibold tracking-tight text-slate-950 dark:text-white";
const lede = "mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400";
const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));
const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
const card = "min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800";
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
  const priorYear = d.priorYear!;
  const baseYear = d.baseYear!;
  const tile = (label: string, h: (typeof d.headline)["violent"]) => (
    <StatTile label={label} unit="per_100k" value={h.value} period={`${year} · per 100,000`} change={h.change} compareLabel={`vs ${priorYear}`} spark={h.spark} />
  );
  const violent = d.offenses.find((o) => o.key === "violent_crime")!;
  const murder = d.offenses.find((o) => o.key === "homicide")!;
  const property = d.offenses.find((o) => o.key === "property_crime")!;
  // Each city department's location on the state map, from the FBI agency directory.
  const coords = cityCoords as unknown as Record<string, [number, number]>;
  const cityPoints = Object.fromEntries(
    d.cities.flatMap((c) => (coords[c.ori] && STATE_FIPS[c.state] ? [[c.ori, projectPoint(map.frame, STATE_FIPS[c.state], ...coords[c.ori])]] : [])),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Crime">
        <dl className="mt-6 flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Latest complete year</dt>
            <dd className="font-semibold text-slate-950 dark:text-white">{year} · all 12 months reported</dd>
          </div>
          {d.prelim && (
            <div className="rounded-xl border border-dashed border-amber-400/70 px-4 py-2.5 dark:border-amber-500/50">
              <dt className="text-xs text-amber-700 dark:text-amber-400">{d.prelim.year} preliminary</dt>
              <dd className="font-semibold text-slate-950 dark:text-white">
                Reported through {d.prelim.latestReported.label} ·{" "}
                <a href="#preliminary" className="font-normal text-slate-500 underline underline-offset-2 dark:text-slate-400">
                  see below
                </a>
              </dd>
            </div>
          )}
        </dl>
      </IssueHeader>

      <section id="trend" className="scroll-mt-24 space-y-4">
        <h2 className={h2}>National trend, {baseYear}–{year}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tile("Violent crime rate", d.headline.violent)}
          {tile("Murder rate", d.headline.homicide)}
          {tile("Property crime rate", d.headline.property)}
          {tile("Motor vehicle theft rate", d.headline.vehicle)}
        </div>
        <CrimeTrends offenses={d.offenses} flaggedYears={d.flaggedYears} baseYear={baseYear} />
        <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          Annual rates for complete calendar years. The index view puts every offense on one scale.
          {d.flaggedYears.length > 0 && (
            <>
              {" "}
              {d.flaggedYears.map((f) => f.year).join(", ")} is marked: the FBI&apos;s switch to NIBRS left agencies covering
              only {d.flaggedYears.map((f) => formatValue(f.coverage, "percent")).join(", ")} of residents reporting, so
              its rates read low.
            </>
          )}
        </p>
        <ChangeTable d={d} />
        <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
      </section>

      <nav aria-label="On this page" className=" flex flex-wrap gap-x-5 gap-y-2 border-y border-slate-200 py-3 text-sm dark:border-slate-800">
        {[
          ...(d.prelim ? [["#preliminary", `${d.prelim.year} so far`]] : []),
          ["#cleared", "Cases cleared"],
          ...(d.victimization ? [["#victims", "Victim surveys"]] : []),
          ...(d.deaths ? [["#homicide", "Homicide records"]] : []),
          ["#states", d.cities.length ? "States & cities" : "States"],
          ...(d.hate || d.arrests ? [["#hate-arrests", "Hate crime & arrests"]] : []),
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            {label}
          </a>
        ))}
      </nav>

      {d.prelim && <Preliminary d={d} />}

      <section id="cleared" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>Cases cleared</h2>
          <p className={lede}>
            The share of reported offenses that police cleared — by an arrest, or by &ldquo;exceptional means&rdquo; when the
            offender is identified but cannot be arrested, such as after their death.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <figure className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <figcaption className="text-base font-semibold text-slate-950 dark:text-white">By offense, {year}</figcaption>
            <div className="mt-4">
              <RankedBars
                unit="percent"
                limit={9}
                items={d.offenses
                  .map((o) => ({ label: o.label, value: o.cleared.find((p) => p.year === year)?.value ?? NaN }))
                  .filter((i) => Number.isFinite(i.value))
                  .sort((a, b) => b.value - a.value)}
              />
            </div>
          </figure>
          <figure className="min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <figcaption className="text-base font-semibold text-slate-950 dark:text-white">Over time</figcaption>
            <div className="mt-4">
              <TimeSeriesChart
                unit="percent"
                height={260}
                markers={d.flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }))}
                series={[murder, violent, property].map((o, i) => ({
                  id: o.key,
                  label: o.label,
                  slot: (i + 1) as 1 | 2 | 3,
                  points: o.cleared.map((p) => ({ x: Number(p.year), label: p.year, value: p.value })),
                }))}
              />
            </div>
          </figure>
        </div>
        <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
      </section>

      {d.victimization && <Victimization d={d} />}
      {d.deaths && <HomicideRecords d={d} />}

      <section id="states" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>States and cities</h2>
          <p className={lede}>
            Rates per 100,000 residents in {year} for the 50 states and the District of Columbia
            {d.cities.length > 0 && <>, with the police departments of the {d.cities.length} U.S. cities over 100,000 residents marked where they are</>}.
            DC is ranked alongside the states, though as a single city it has no rural areas to average in.
          </p>
        </div>
        <CrimeStateExplorer
          data={d.states}
          year={year}
          priorYear={priorYear}
          baseYear={baseYear}
          map={{ width: map.width, height: map.height, states: map.states }}
          cities={d.cities}
          cityPoints={cityPoints}
        />
        <SourceLines sources={citeFrom(d.datasets, "fbi-cde", "fbi-cde-cities")} />
      </section>

      {(d.hate || d.arrests) && <HateAndArrests d={d} />}

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
        <caption className="px-4 pt-4 text-left text-base font-semibold text-slate-950 dark:text-white">
          How rates have changed
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">Per 100,000 residents; peak excludes partial-reporting years</span>
        </caption>
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
              <td className={`py-1.5 pr-3 text-slate-700 dark:text-slate-200 ${o.key === "violent_crime" || o.key === "property_crime" ? "pl-3 font-medium" : "pl-6"}`}>
                {o.label}
              </td>
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

function Preliminary({ d }: { d: CrimeData }) {
  const p = d.prelim!;
  return (
    <section id="preliminary" className="scroll-mt-24 space-y-5 rounded-2xl border border-dashed border-amber-400/70 p-6 dark:border-amber-500/50">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-amber-700 uppercase dark:text-amber-400">Preliminary</p>
        <h2 className={`mt-1 ${h2}`}>{p.year} so far</h2>
        <p className={lede}>
          Agencies report with a lag, so each month of {p.year} covers a different share of the population.
          {p.span ? (
            <>
              {" "}
              This compares {p.span} {p.year} — the months where agencies covering at least 85% of residents have reported —
              with the same months of {d.year}, with each month scaled up to the full population by its own coverage.
            </>
          ) : (
            <> No month of {p.year} has reached 85% coverage yet.</>
          )}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {p.rows.length > 0 && (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-md text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-medium">Offense, per 100,000</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {p.span} {d.year}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {p.span} {p.year}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {p.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{formatValue(r.prior, "per_100k")}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(r.current, "per_100k")}</td>
                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{signed(r.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Population covered by reporting agencies</p>
          <ul className="mt-3 space-y-1.5">
            {p.reported.map((m) => (
              <li key={m.label} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{m.label}</span>
                <span className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block h-2 rounded-full"
                    style={{
                      width: `${m.coverage ?? 0}%`,
                      background: (m.coverage ?? 0) >= 85 ? "var(--viz-series-1)" : "var(--viz-axis)",
                    }}
                  />
                </span>
                <span className="text-right text-slate-700 tabular-nums dark:text-slate-300">{formatValue(m.coverage, "percent")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SourceLines sources={citeFrom(d.datasets, "fbi-cde")} />
    </section>
  );
}

function Victimization({ d }: { d: CrimeData }) {
  const v = d.victimization!;
  return (
    <section id="victims" className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className={h2}>Beyond police reports</h2>
        <p className={lede}>
          The Bureau of Justice Statistics asks a national sample of households about crimes they experienced, whether or not
          they told police. It measures the crime that police statistics miss — and how much of it goes unreported.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Violent victimization rate" unit="per_1000" value={v.latest.violent} period={`${v.year} · per 1,000 people 12+`} spark={v.violent.map((p) => p.value)} />
        <StatTile label="Violent crimes reported to police" unit="percent" value={v.latest.violentReported} period={`${v.year} · share of victimizations`} />
        <StatTile label="Property crimes reported to police" unit="percent" value={v.latest.propertyReported} period={`${v.year} · share of victimizations`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Victimization, {v.firstYear}–{v.year}</p>
            <p className={cardSub}>Violent per 1,000 people 12 and older; property per 1,000 households</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="per_1000"
              height={260}
              series={[
                { id: "violent", label: "Violent", slot: 1, points: pts(v.violent) },
                { id: "property", label: "Property", slot: 2, points: pts(v.property) },
              ]}
            />
          </div>
        </figure>
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Share reported to police, {v.year}</p>
            <p className={cardSub}>Percent of victimizations victims say police learned about</p>
          </figcaption>
          <div className="mt-4">
            <RankedBars unit="percent" limit={10} items={[...v.reportedByType].sort((a, b) => b.value - a.value)} />
          </div>
        </figure>
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Reporting over time</p>
            <p className={cardSub}>Percent of victimizations reported to police</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="percent"
              height={240}
              series={[
                { id: "violent", label: "Violent", slot: 1, points: pts(v.violentReported) },
                { id: "property", label: "Property", slot: 2, points: pts(v.propertyReported) },
              ]}
            />
          </div>
        </figure>
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Violence by relationship to the offender</p>
            <p className={cardSub}>Per 1,000 people 12 and older. Domestic violence is by an intimate partner or other relative.</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="per_1000"
              height={240}
              series={[
                { id: "stranger", label: "Stranger", slot: 1, points: pts(v.stranger) },
                { id: "domestic", label: "Domestic", slot: 2, points: pts(v.domestic) },
                { id: "intimate", label: "Intimate partner", slot: 3, points: pts(v.intimate) },
              ]}
            />
          </div>
        </figure>
      </div>
      <SourceLines sources={citeFrom(d.datasets, "bjs-ncvs")} />
    </section>
  );
}

function HomicideRecords({ d }: { d: CrimeData }) {
  const c = d.deaths!;
  const murder = d.offenses.find((o) => o.key === "homicide")!;
  return (
    <section id="homicide" className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className={h2}>Homicide in death records</h2>
        <p className={lede}>
          Death certificates give a count of homicide that does not depend on police reporting. It runs above the FBI&apos;s
          murder rate because death certificates record any death caused intentionally by another person as homicide, including
          killings in self-defense that police do not count as murder.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <figure className={card}>
          <figcaption>
            <p className={cardTitle}>Two counts of homicide</p>
            <p className={cardSub}>Per 100,000 residents</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="per_100k"
              height={280}
              markers={d.flaggedYears.map((f) => ({ x: Number(f.year), label: "FBI partial reporting" }))}
              series={[
                { id: "cdc", label: "Homicide deaths (CDC)", slot: 1, points: pts(c.homicide) },
                { id: "cdc-fa", label: "Firearm homicide deaths (CDC)", slot: 3, points: pts(c.firearmHomicide) },
                { id: "fbi", label: "Murders reported to police (FBI)", slot: 2, points: pts(murder.rates) },
              ]}
            />
          </div>
        </figure>
        <div className="grid content-start gap-4">
          <StatTile
            label="Homicide death rate"
            unit="per_100k"
            value={c.homicide.at(-1)?.value ?? null}
            period={`${c.year} · per 100,000`}
            change={c.homicide.length > 1 ? ((c.homicide.at(-1)!.value - c.homicide.at(-2)!.value) / c.homicide.at(-2)!.value) * 100 : null}
            compareLabel={`vs ${c.homicide.at(-2)?.year ?? ""}`}
            spark={c.homicide.map((p) => p.value)}
          />
          <StatTile label="Homicides by firearm" unit="percent" value={c.firearmShare} period={`${c.year} · share of homicide deaths`} />
          {c.ttm && (
            <StatTile
              label="Latest 12 months"
              unit="per_100k"
              value={c.ttm.homicide}
              period={`${c.ttm.range ?? `through ${c.ttm.through}`} · provisional`}
            />
          )}
        </div>
      </div>
      <SourceLines sources={citeFrom(d.datasets, "cdc-violent-deaths", "fbi-cde")} />
    </section>
  );
}

function HateAndArrests({ d }: { d: CrimeData }) {
  const { hate, arrests } = d;
  return (
    <section id="hate-arrests" className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className={h2}>Hate crime and arrests</h2>
        <p className={lede}>
          Both are counts from the agencies that reported, so totals rise and fall with participation; the shares of arrests
          compare fairly across years.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {hate && (
          <>
            <figure className={card}>
              <figcaption>
                <p className={cardTitle}>Hate crime incidents</p>
                <p className={cardSub}>
                  {formatValue(hate.total.at(-1)!.value, "incidents")} in {hate.year}
                  {hate.change !== null && ` · ${formatSigned(hate.change, "percent")} vs ${hate.total.at(-2)?.year}`}
                </p>
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
          </>
        )}
        {arrests && (
          <figure className={`${card} lg:col-span-2`}>
            <figcaption>
              <p className={cardTitle}>Who and what arrests are for</p>
              <p className={cardSub}>
                Percent of all arrests · {formatValue(arrests.total.at(-1)!.value, "arrests", { compact: true })} arrests reported
                in {arrests.year}
              </p>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart
                unit="percent"
                height={260}
                markers={d.flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }))}
                series={[
                  { id: "violent", label: "Violent offenses", slot: 1, points: pts(arrests.violentShare) },
                  { id: "drug", label: `Drug offenses (${arrests.drugFrom}–)`, slot: 2, points: pts(arrests.drugShare) },
                  { id: "juvenile", label: "People under 18", slot: 3, points: pts(arrests.juvenileShare) },
                ]}
              />
            </div>
          </figure>
        )}
      </div>
      <SourceLines sources={citeFrom(d.datasets, "fbi-hate-crime", "fbi-arrests")} />
    </section>
  );
}
