"use client";

import Link from "next/link";
import { useState } from "react";
import { RankedBars } from "@/components/charts/ranked-bars";
import type { StateTravel } from "@/lib/abortion/data";
import { formatValue } from "@/lib/format";

// Pick a state: where its residents went for abortions, and where patients
// treated there came from (Guttmacher occurrence × residence table).
export function StateTravelPicker({ states, year, defaultFips = "48" }: { states: StateTravel[]; year: string; defaultFips?: string }) {
  const [fips, setFips] = useState(defaultFips);
  const s = states.find((x) => x.fips === fips) ?? states[0];

  return (
    <figure className="min-w-0 space-y-6 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <figcaption className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Travel to and from one state</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{year} · flows under 100 are not published</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          State
          <select
            value={fips}
            onChange={(e) => setFips(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {states.map((x) => (
              <option key={x.fips} value={x.fips}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </figcaption>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            ["Abortions provided in the state", s.occurred],
            ["Abortions obtained by its residents", s.residents],
            ["Residents who went to another state", s.leftState],
          ] as const
        ).map(([label, v]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(v, "abortions")}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Where residents who left went</p>
          {s.wentTo.length ? <RankedBars items={s.wentTo} unit="abortions" slot={2} /> : <p className="text-sm text-slate-500">No published flows.</p>}
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Where patients from other states came from</p>
          {s.cameFrom.length ? <RankedBars items={s.cameFrom} unit="abortions" slot={1} /> : <p className="text-sm text-slate-500">No published flows.</p>}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Source:{" "}
        <Link href="/datasets/guttmacher-monthly-abortions" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:hover:text-slate-200">
          Guttmacher Monthly Abortion Provision Study
        </Link>
      </p>
    </figure>
  );
}
