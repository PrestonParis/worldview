// /crime sections on who is arrested, homicide victims and offenders,
// offenders of violent crime (police reports and victims' accounts),
// prisons and reoffending, and officers killed. Data: src/lib/crime/groups.ts.

import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { RACE_COLUMNS, type CrimeGroups } from "@/lib/crime/groups";

const h2 = "text-2xl font-semibold tracking-tight text-slate-950 dark:text-white";
const lede = "mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400";
const th = "px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400";
const thFirst = "px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400";
const td = "px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200";
const tdFirst = "px-3 py-2 text-slate-950 dark:text-white";
const tr = "border-b border-slate-100 dark:border-slate-800/60";

const ds = (slug: string, label: string) => ({ label, href: `/datasets/${slug}` });
const ARRESTS = ds("fbi-arrest-demographics", "FBI Crime Data Explorer");
const POP = ds("census-pep-race", "Census population estimates");
const SHR = ds("fbi-shr", "FBI Supplementary Homicide Reports");
const NIBRS = ds("fbi-nibrs-people", "FBI NIBRS");
const NCVS = ds("bjs-ncvs", "National Crime Victimization Survey");
const PRISON = ds("bjs-prisoners", "BJS National Prisoner Statistics");
const RECID = ds("bjs-recidivism", "BJS recidivism study");
const LEOKA = ds("fbi-leoka", "FBI LEOKA");

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);
const raceLabel = (l: string) => (l === "Asian" ? "Asian / Pacific Islander" : l);

// A grid of shares: rows × columns, each cell a percent.
function ShareTable({ first, columns, rows, highlight }: {
  first: string;
  columns: readonly (readonly [string, string])[];
  rows: { key?: string; label: string; shares: Record<string, number | null> }[];
  highlight?: { label: string; shares: Record<string, number | null> };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className={thFirst}>{first}</th>
            {columns.map(([k, l]) => (
              <th key={k} className={th}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {highlight && (
            <tr className="border-b border-slate-200 bg-slate-50 font-medium dark:border-slate-800 dark:bg-slate-900">
              <td className={tdFirst}>{highlight.label}</td>
              {columns.map(([k]) => (
                <td key={k} className={td}>{pct(highlight.shares[k])}</td>
              ))}
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key ?? r.label} className={tr}>
              <td className={tdFirst}>{r.label}</td>
              {columns.map(([k]) => (
                <td key={k} className={td}>{pct(r.shares[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const shareTableView = (first: string, columns: readonly (readonly [string, string])[], rows: { label: string; shares: Record<string, number | null> }[]) => ({
  columns: [first, ...columns.map(([, l]) => `${l} (%)`)],
  rows: rows.map((r) => [r.label, ...columns.map(([k]) => r.shares[k] ?? "")]),
});

export function CrimeGroupSections({ g }: { g: CrimeGroups }) {
  const raceCols = RACE_COLUMNS.map(([k, l]) => [k, raceLabel(l)] as const);
  const murder = g.arrestRows.find((r) => r.key === "murder");
  const all = g.arrestRows.find((r) => r.key === "all");
  const ageCols = [["male", "Male"], ["under18", "Under 18"], ["age18to24", "Ages 18–24"]] as const;
  const ageRows = g.ageSex.map((r) => ({ label: r.label, shares: { male: r.male, under18: r.under18, age18to24: r.age18to24 } }));
  const lastOfficers = g.officers[0].points.at(-1);

  return (
    <>
      <section id="arrested" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>Who is arrested</h2>
          <p className={lede}>
            Arrests in {g.year} by the arrestee&apos;s race as police recorded it, beside each race&apos;s share of the population. The FBI counts
            Hispanic arrestees within their race, so the population row is race of any origin.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Arrests reported" unit="arrests" value={all?.total ?? null} period={g.year} />
          <StatTile
            label="Murder arrestees who are Black"
            unit="percent"
            value={murder?.shares.black ?? null}
            period={`${g.year} · of known race`}
            note={g.population.shares.black !== null ? `${g.population.shares.black.toFixed(1)}% of the population` : undefined}
          />
          <StatTile
            label="Murder arrestees who are White"
            unit="percent"
            value={murder?.shares.white ?? null}
            period={`${g.year} · includes Hispanic`}
            note={g.population.shares.white !== null ? `${g.population.shares.white.toFixed(1)}% of the population` : undefined}
          />
          <StatTile label="Arrestees who are male" unit="percent" value={g.ageSex[0]?.male ?? null} period={`${g.year} · all offenses`} />
        </div>
        <ChartCard
          title={`Arrests by race, ${g.year}`}
          subtitle="Share of arrestees of known race"
          source={[ARRESTS, POP]}
          table={shareTableView("Offense", raceCols, [g.population, ...g.arrestRows])}
        >
          <ShareTable first="Offense" columns={raceCols} rows={g.arrestRows} highlight={g.population} />
        </ChartCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Black share of arrests" subtitle="Of arrestees of known race" source={ARRESTS} table={seriesTable(g.blackShareTrend, "percent")}>
            <TimeSeriesChart series={g.blackShareTrend} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title={`Arrests by sex and age, ${g.year}`} subtitle="Share of all arrests for each offense" source={ARRESTS} table={shareTableView("Offense", ageCols, ageRows)}>
            <ShareTable first="Offense" columns={ageCols} rows={ageRows} />
          </ChartCard>
        </div>
        <h3 className="pt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Across the states</h3>
        <StateExplorer metrics={g.states.metrics} rows={g.states.rows} />
      </section>

      {g.shrLatest && (
        <section id="homicide-people" className="scroll-mt-24 space-y-5">
          <div className="max-w-3xl">
            <h2 className={h2}>Homicide victims and offenders</h2>
            <p className={lede}>
              Police homicide reports: who was killed, and who killed them. In {g.shrLatest.year} the offender&apos;s race was unknown in{" "}
              {g.shrLatest.offenderRaceUnknown?.toFixed(0)}% of cases, mostly those without an arrest; shares are of victims and offenders of
              known race.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Race of homicide victims and offenders"
              subtitle="Share of those of known race"
              source={SHR}
              table={seriesTable(g.homicideTrend, "percent")}
              className="lg:col-span-2"
            >
              <TimeSeriesChart series={g.homicideTrend} unit="percent" height={280} />
            </ChartCard>
            <ChartCard title={`Weapon used, ${g.shrLatest.year}`} subtitle="Victims" source={SHR} table={{ columns: ["Weapon", "Victims"], rows: g.weapons.map((i) => [i.label, i.value]) }}>
              <RankedBars items={g.weapons} unit="victims" />
            </ChartCard>
            <ChartCard
              title={`Victim's relationship to the offender, ${g.shrLatest.year}`}
              subtitle="Victims where the relationship is known"
              source={SHR}
              table={{ columns: ["Relationship", "Victims"], rows: g.relationships.map((i) => [i.label, i.value]) }}
            >
              <RankedBars items={g.relationships} unit="victims" slot={2} />
            </ChartCard>
          </div>
        </section>
      )}

      {(g.nibrsRows.length > 0 || g.ncvsRows.length > 0) && (
        <section id="offenders" className="scroll-mt-24 space-y-5">
          <div className="max-w-3xl">
            <h2 className={h2}>Offenders of violent crime</h2>
            <p className={lede}>
              Two independent sources: offenders in police incident reports, and offenders as victims describe them in the national
              victimization survey, which also counts crimes never reported to police.
            </p>
          </div>
          {g.nibrsRows.length > 0 && (
            <ChartCard
              title={`Offenders in police incident reports, ${g.nibrsYear}`}
              subtitle="Share of offenders of known race · Hispanic offenders are counted within their race"
              source={NIBRS}
              table={shareTableView("Offense", raceCols, g.nibrsRows)}
            >
              <ShareTable first="Offense" columns={raceCols} rows={g.nibrsRows} />
            </ChartCard>
          )}
          {g.ncvsRows.length > 0 && (
            <ChartCard
              title={`Offenders as victims described them, ${g.ncvsYear}`}
              subtitle="Share of violent victimizations, excluding homicide · White, Black, and other exclude Hispanics"
              source={NCVS}
              table={shareTableView("Victimizations", g.ncvsGroups, g.ncvsRows)}
            >
              <ShareTable first="Victimizations" columns={g.ncvsGroups} rows={g.ncvsRows} />
            </ChartCard>
          )}
        </section>
      )}

      <section id="prisons" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl">
          <h2 className={h2}>Prisons and reoffending</h2>
          <p className={lede}>Sentenced state and federal prisoners per 100,000 residents of each group, and how often released prisoners are arrested again.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Imprisonment rate by race and Hispanic origin" subtitle="Sentenced prisoners per 100,000 residents" source={PRISON} table={seriesTable(g.imprisonment, "per_100k")}>
            <TimeSeriesChart series={g.imprisonment} unit="per_100k" height={280} />
          </ChartCard>
          <ChartCard
            title="Arrested again within 5 years"
            subtitle="State prisoners released in 2012, by group and by the offense served for"
            source={RECID}
            table={{ columns: ["Group", "Arrested within 5 years (%)"], rows: g.recidItems.map((i) => [i.label, i.value]) }}
          >
            <RankedBars items={g.recidItems} unit="percent" limit={20} />
          </ChartCard>
        </div>
      </section>

      {lastOfficers && (
        <section id="officers" className="scroll-mt-24 space-y-5">
          <div className="max-w-3xl">
            <h2 className={h2}>Officers killed</h2>
            <p className={lede}>Law enforcement officers killed in the line of duty, feloniously or by accident. The current year is year to date.</p>
          </div>
          <ChartCard title="Officers killed in the line of duty" subtitle="Officers" source={LEOKA} table={seriesTable(g.officers, "officers")}>
            <TimeSeriesChart series={g.officers} type="column" unit="officers" height={240} />
          </ChartCard>
        </section>
      )}
    </>
  );
}
