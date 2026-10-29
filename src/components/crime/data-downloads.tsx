"use client";

import { Download } from "lucide-react";
import { CLEARED, OFFENSES, type CityRow, type OffenseTrend, type StateCrimeData } from "@/lib/crime/offenses";

function save(name: string, header: string[], lines: (string | number | null)[][]) {
  const csv = [header, ...lines].map((r) => r.map((v) => (v === null ? "" : typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const button =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300";

// CSV exports of what the page charts: national, state, and department rows.
export function DataDownloads({ offenses, states, cities, year }: { offenses: OffenseTrend[]; states: StateCrimeData; cities: CityRow[]; year: string }) {
  const years = states.years;
  const national = () =>
    save(
      `worldview-crime-national-${years[0]}-${year}.csv`,
      ["year", "coverage_pct", ...OFFENSES.flatMap((o) => [`${o.key}_rate`, `${o.key}_cleared_pct`])],
      years.map((y, k) => [
        y,
        states.usCoverage[k],
        ...offenses.flatMap((o) => [o.rates.find((p) => p.year === y)?.value ?? null, o.cleared.find((p) => p.year === y)?.value ?? null]),
      ]),
    );
  const byState = () =>
    save(
      `worldview-crime-by-state-${years[0]}-${year}.csv`,
      ["state", "abbr", ...OFFENSES.flatMap((o) => years.map((y) => `${o.key}_rate_${y}`)), ...years.map((y) => `coverage_${y}`), ...CLEARED.map((k) => `${k}_cleared_pct_${year}`)],
      states.rows.map((r) => [r.name, r.abbr, ...OFFENSES.flatMap((o) => r.rates[o.key]), ...r.coverage, ...CLEARED.map((k) => r.cleared[k])]),
    );
  const byCity = () =>
    save(
      `worldview-crime-city-departments-${year}.csv`,
      ["agency_ori", "name", "state", "population_served", "violent_rate", "murder_rate", "property_rate", "violent_change_pct", "staff_per_1000", "incomplete"],
      cities.map((c) => [c.ori, c.name, c.state, c.population, c.violent, c.murder, c.property, c.violentChange, c.staffing, c.partial ? "yes" : ""]),
    );
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={national} className={button}>
        <Download className="size-3.5" /> National rates and clearance, {years[0]}–{year}
      </button>
      <button type="button" onClick={byState} className={button}>
        <Download className="size-3.5" /> States, all offenses, {years[0]}–{year}
      </button>
      {cities.length > 0 && (
        <button type="button" onClick={byCity} className={button}>
          <Download className="size-3.5" /> City police departments, {year}
        </button>
      )}
    </div>
  );
}
