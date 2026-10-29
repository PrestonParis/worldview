// /immigration "Crime and citizenship": federal sentencing and prisons by
// citizenship, and Texas DPS figures on illegal noncitizens. Data:
// src/lib/immigration/crime.ts.

import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { formatPeriod, formatValue } from "@/lib/format";
import type { CrimeCitizenship as Data } from "@/lib/immigration/crime";

const ds = (slug: string, label: string) => ({ label, href: `/datasets/${slug}` });
const USSC = ds("ussc-sourcebook", "U.S. Sentencing Commission");
const BJS = ds("bjs-prisoners", "BJS National Prisoner Statistics");
const BOP = ds("bop-population", "Federal Bureau of Prisons");
const DPS = ds("texas-dps-noncitizen", "Texas Department of Public Safety");
const ACS = ds("census-acs1-immigration", "American Community Survey");

const th = "px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400";
const td = "px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200";

export function CrimeCitizenshipSection({ d }: { d: Data }) {
  const t = d.texas;
  return (
    <section id="crime-citizenship" className="scroll-mt-28 space-y-6 border-t border-slate-200 pt-10 dark:border-slate-800">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Crime and citizenship</h2>
        <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">
          Who is sentenced in federal court and held in prison, by citizenship, and the criminal records of illegal noncitizens booked into
          Texas jails.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Non-citizens among people sentenced federally"
          unit="percent"
          value={d.sentencedNoncitizenShare?.value ?? null}
          period={formatPeriod(d.fy)}
          note={d.withoutImmigrationShare ? `${d.withoutImmigrationShare.value.toFixed(1)}% excluding immigration offenses` : undefined}
        />
        <StatTile
          label="Non-citizens in the population"
          unit="percent"
          value={d.populationNoncitizenShare?.value ?? null}
          period={d.populationNoncitizenShare?.period}
          note="All residents"
        />
        <StatTile label="Non-citizens in federal prison" unit="percent" value={d.bopNoncitizenPct} period={d.bopDate ? `Week of ${d.bopDate}` : undefined} />
        {t && (
          <StatTile
            label="Illegal noncitizens booked into Texas jails"
            unit="people"
            value={t.illegal}
            period={`June 2011 – ${t.asOf}`}
            note={t.charges !== null ? `${formatValue(t.charges, "charges", { compact: true })} criminal charges` : undefined}
          />
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Non-citizen share of people sentenced in federal court"
          subtitle="Percent of individuals sentenced, by fiscal year"
          source={USSC}
          table={seriesTable(d.sentencingTrend, "percent")}
        >
          <TimeSeriesChart series={d.sentencingTrend} unit="percent" height={260} />
        </ChartCard>
        <ChartCard
          title={`Non-citizen share by type of crime, ${formatPeriod(d.fy)}`}
          subtitle="Federal sentences · categories with at least 100 cases"
          source={USSC}
          table={{ columns: ["Type of crime", "Non-citizen share (%)", "Cases"], rows: d.byOffense.map((i) => [i.label, i.value, i.note ?? ""]) }}
        >
          <RankedBars items={d.byOffense} unit="percent" limit={20} />
        </ChartCard>
        <ChartCard
          title={`Non-citizens in prison, ${d.prisonsYear}`}
          subtitle="Share of prisoners in state or federal prisons · states that report citizenship"
          source={[BJS, ACS]}
          table={{ columns: ["Jurisdiction", "Non-citizen share (%)"], rows: d.prisons.map((i) => [i.label, i.value]) }}
        >
          <RankedBars items={d.prisons} unit="percent" limit={15} slot={2} />
        </ChartCard>
        <ChartCard
          title="Federal prisoners by citizenship"
          subtitle={d.bopDate ? `Week of ${d.bopDate}` : undefined}
          source={BOP}
          table={{ columns: ["Country of citizenship", "Prisoners", "Share"], rows: d.bopCountries.map((i) => [i.label, i.value, i.note ?? ""]) }}
        >
          <RankedBars items={d.bopCountries} unit="people" slot={3} />
        </ChartCard>
      </div>
      {t && (
        <ChartCard
          title="Texas: charges and convictions of illegal noncitizens"
          subtitle={`People identified as illegally present when booked into Texas jails · arrests from June 2011 to ${t.asOf}`}
          source={DPS}
          table={{ columns: ["Offense", "Charges", "Convictions"], rows: t.offenses.map((o) => [o.label, o.charges ?? "", o.convictions ?? ""]) }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Offense</th>
                  <th className={th}>Charges</th>
                  <th className={th}>Convictions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50 font-medium dark:border-slate-800 dark:bg-slate-900">
                  <td className="px-3 py-2 text-slate-950 dark:text-white">All offenses</td>
                  <td className={td}>{formatValue(t.charges, "charges")}</td>
                  <td className={td}>{formatValue(t.convictions, "convictions")}</td>
                </tr>
                {t.offenses.map((o) => (
                  <tr key={o.label} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2 text-slate-950 dark:text-white">{o.label}</td>
                    <td className={td}>{formatValue(o.charges, "charges")}</td>
                    <td className={td}>{formatValue(o.convictions, "convictions")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </section>
  );
}
