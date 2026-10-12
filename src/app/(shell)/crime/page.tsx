import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CrimeStateExplorer } from "@/components/crime/crime-state-explorer";
import { CitiesTable } from "@/components/crime/cities-table";
import { CrimeTrends } from "@/components/crime/crime-trends";
import { coverageLabel } from "@/components/data/dataset-list";
import { loadCrime, type CrimeData } from "@/lib/crime/data";
import { FULL_COVERAGE, type YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

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
  const d = await loadCrime();
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

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl text-slate-950 dark:text-white">Crime</h1>
        <p className="mt-4 text-lg leading-8 text-slate-500 dark:text-slate-400">
          Offenses reported to police, as rates per 100,000 residents so years and states compare fairly — nationally and
          for every state, updated monthly from the FBI.
        </p>
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
      </header>

      <nav aria-label="On this page" className="-mt-6 flex flex-wrap gap-x-5 gap-y-2 border-y border-slate-200 py-3 text-sm dark:border-slate-800">
        {[
          ["#trend", "National trend"],
          ...(d.prelim ? [["#preliminary", `${d.prelim.year} so far`]] : []),
          ["#cleared", "Cases cleared"],
          ...(d.victimization ? [["#victims", "Victim surveys"]] : []),
          ...(d.deaths ? [["#homicide", "Homicide records"]] : []),
          ["#states", "States"],
          ...(d.cities.length ? [["#cities", "Cities"]] : []),
          ...(d.hate || d.arrests ? [["#hate-arrests", "Hate crime & arrests"]] : []),
          ["#methodology", "Methodology"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            {label}
          </a>
        ))}
      </nav>

      <section className="space-y-6" aria-label="Headline rates">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tile("Violent crime rate", d.headline.violent)}
          {tile("Murder rate", d.headline.homicide)}
          {tile("Property crime rate", d.headline.property)}
          {tile("Motor vehicle theft rate", d.headline.vehicle)}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Key findings</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {d.findings.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <ChangeTable d={d} />
        </div>
      </section>

      <section id="trend" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>National trend</h2>
          <p className={lede}>
            Annual rates for complete calendar years, {baseYear}–{year}. Switch to the index view to put every offense on one
            scale and see which rose or fell the most.
            {d.flaggedYears.length > 0 && (
              <>
                {" "}
                {d.flaggedYears.map((f) => f.year).join(", ")} is marked: the FBI&apos;s switch to NIBRS left agencies covering
                only {d.flaggedYears.map((f) => formatValue(f.coverage, "percent")).join(", ")} of residents reporting, so
                its rates read low.
              </>
            )}
          </p>
        </div>
        <CrimeTrends offenses={d.offenses} flaggedYears={d.flaggedYears} baseYear={baseYear} />
      </section>

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
      </section>

      {d.victimization && <Victimization d={d} />}
      {d.deaths && <HomicideRecords d={d} />}

      <section id="states" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>Across the states</h2>
          <p className={lede}>
            Rates per 100,000 residents in {year} for the 50 states and the District of Columbia. DC is ranked alongside the
            states, though as a single city it has no rural areas to average in.
          </p>
        </div>
        <CrimeStateExplorer data={d.states} year={year} priorYear={priorYear} baseYear={baseYear} />
      </section>

      {d.cities.length > 0 && (
        <section id="cities" className="scroll-mt-24 space-y-5">
          <div className="max-w-3xl">
            <h2 className={h2}>Cities</h2>
            <p className={lede}>
              The police departments of the {d.cities.length} U.S. cities over 100,000 residents, with their staffing — sworn
              officers and civilian employees per 1,000 residents.
            </p>
          </div>
          <CitiesTable rows={d.cities} year={year} />
        </section>
      )}

      {(d.hate || d.arrests) && <HateAndArrests d={d} />}

      <Methodology d={d} />

      <section className="space-y-5">
        <h2 className={h2}>Sources</h2>
        <ul className="grid gap-4 lg:grid-cols-2">
          {d.datasets.map((ds) => (
            <li key={ds.slug} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{ds.publisher}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{ds.title}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {ds.slug === "fbi-cde" && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">Systems</dt>
                    <dd className="text-slate-700 dark:text-slate-200">UCR Summary Reporting, NIBRS</dd>
                    <dt className="text-slate-500 dark:text-slate-400">Geography</dt>
                    <dd className="text-slate-700 dark:text-slate-200">Nation, 50 states and DC</dd>
                  </>
                )}
                <dt className="text-slate-500 dark:text-slate-400">Coverage</dt>
                <dd className="text-slate-700 dark:text-slate-200">{coverageLabel(ds.coverage)}</dd>
                {ds.cadence && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">Updated</dt>
                    <dd className="text-slate-700 dark:text-slate-200">
                      {ds.cadence}
                      {ds.coverage?.lastUpdated &&
                        ` · last ${new Date(ds.coverage.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href={`/datasets/${ds.slug}`} className="rounded-full border border-slate-200 px-3 py-1 hover:border-slate-400 dark:border-slate-700">
                  View dataset
                </Link>
                <a href="#methodology" className="rounded-full border border-slate-200 px-3 py-1 hover:border-slate-400 dark:border-slate-700">
                  Methodology
                </a>
                {ds.sourceUrl && (
                  <a
                    href={ds.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 hover:border-slate-400 dark:border-slate-700"
                  >
                    Original source <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
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
    </section>
  );
}

function Methodology({ d }: { d: CrimeData }) {
  const item = "space-y-1.5";
  const dt = "font-semibold text-slate-900 dark:text-white";
  return (
    <section id="methodology" className="scroll-mt-24">
      <details className="group rounded-2xl border border-slate-200 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
          <span>
            <span className={h2}>Methodology &amp; limitations</span>
            <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
              How each source collects its numbers and how this page computes from them
            </span>
          </span>
          <span className="text-2xl text-slate-400 transition group-open:rotate-45" aria-hidden>
            +
          </span>
        </summary>
        <dl className="grid gap-6 border-t border-slate-200 p-5 text-sm leading-6 text-slate-600 md:grid-cols-2 dark:border-slate-800 dark:text-slate-300">
          <div className={item}>
            <dt className={dt}>What &ldquo;reported crime&rdquo; covers</dt>
            <dd>
              These are offenses known to law enforcement — crimes reported to or discovered by police. Crimes never reported
              are not counted. The Bureau of Justice Statistics&apos; National Crime Victimization Survey finds that fewer than half
              of violent victimizations are reported to police.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>UCR and NIBRS</dt>
            <dd>
              The FBI&apos;s Uniform Crime Reporting program collected monthly totals through the Summary Reporting System until
              2021, when it began accepting only the incident-based NIBRS format. Many large agencies had not yet converted, so
              {d.flaggedYears.length ? ` ${d.flaggedYears.map((f) => `${f.year} reporting covered ${formatValue(f.coverage, "percent")} of residents`).join("; ")}` : " participation dropped"}{" "}
              — that year is marked on every chart and left out of peaks and lows.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Rates and population</dt>
            <dd>
              Rates are offenses per 100,000 residents as published by the Crime Data Explorer, which divides offenses reported
              by participating agencies by the population. Annual rates here are the sum of the twelve monthly rates, and can
              differ slightly from the FBI&apos;s annual estimates, which impute for non-reporting agencies. Raw counts are not
              shown because they rise and fall with the number of agencies reporting.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Missing agencies and partial years</dt>
            <dd>
              A year counts as complete when all twelve months are in and agencies covering at least 90% of the U.S.
              population reported each month. States where agencies covering under {FULL_COVERAGE}% of residents reported are
              marked † — their rates count only those agencies&apos; offenses and read low.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Preliminary {d.prelim?.year ?? "current-year"} figures</dt>
            <dd>
              For the year in progress, Worldview uses only months where reporting agencies cover at least 85% of residents,
              and divides each month&apos;s rate by its coverage to estimate a full-population rate. This assumes non-reporting
              agencies have crime rates like those that reported; the same months of the prior year are scaled the same way.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Definitions</dt>
            <dd>
              Violent crime is murder and nonnegligent manslaughter, rape, robbery, and aggravated assault; property crime is
              burglary, larceny-theft, and motor vehicle theft (arson is collected separately). Rape uses the FBI&apos;s revised
              definition, in effect since 2013, for every year shown.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Clearances</dt>
            <dd>
              Clearance shares divide offenses cleared in a year by offenses reported that year, among reporting agencies. A
              clearance can relate to an offense from an earlier year, so a single year&apos;s share is an approximation.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Victimization survey</dt>
            <dd>
              The National Crime Victimization Survey interviews more than 200,000 people a year. Worldview computes rates from the
              BJS public files: victimizations (with repeated &ldquo;series&rdquo; incidents counted as BJS does) per 1,000
              people 12 and older for violence, and per 1,000 households for property crime. The survey cannot measure homicide,
              and single-year estimates for rarer crimes carry wide margins of error.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Death records</dt>
            <dd>
              CDC homicide figures come from death certificates in the National Vital Statistics System, counted by where the
              person lived. The most recent periods are provisional. County counts under 10 are suppressed, and their rates are
              marked unstable.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Cities</dt>
            <dd>
              Cities are incorporated places over 100,000 residents in the Census Bureau&apos;s latest 1-year estimates, each
              matched to its own police department or the consolidated city–county agency that polices it. Unincorporated places
              policed by a county are not listed. Staffing counts employees as of October 31 each year.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>Hate crime and arrests</dt>
            <dd>
              Both are counts from participating agencies. Hate crime reporting is voluntary, and an incident motivated by more
              than one bias is counted once under multiple biases. Arrest shares divide each group by all arrests the same
              agencies reported; juveniles are people under 18. Drug arrests start in {d.arrests?.drugFrom ?? "2021"}: in
              earlier years the FBI&apos;s tables list summary-system drug totals alongside their own subtotals, which cannot be
              separated without counting arrests twice.
            </dd>
          </div>
          <div className={item}>
            <dt className={dt}>DC and territories</dt>
            <dd>
              The District of Columbia is ranked with the states. Puerto Rico and the other territories are not shown or
              ranked.
            </dd>
          </div>
        </dl>
      </details>
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
    </section>
  );
}
