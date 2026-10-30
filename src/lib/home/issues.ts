// Series for the homepage issue grid that no other homepage loader already
// fetches: Israel aid by fiscal year (CRS) and the long-run abortion count
// (Guttmacher). Two small cached reads instead of the full page loaders.

import { getSeriesMany, type Point } from "../db/stats";

export interface AidYear { fy: number; total: number; military: number; missileDefense: number; economic: number }
export interface YearValue { year: number; value: number }

const fy = (period: string) => Number(period.replace(/^FY/, ""));
const annual = (points: Point[] | undefined): YearValue[] =>
  (points ?? []).filter((p) => /^\d{4}$/.test(p.period)).map((p) => ({ year: Number(p.period), value: p.value }));

export async function loadIsraelAid(): Promise<AidYear[] | null> {
  const aid = await getSeriesMany("crs-israel-aid", ["total", "military", "missile_defense", "economic"], "country", "ISR");
  if (!aid.total?.length) return null;
  const at = (points: Point[] | undefined, period: string) => points?.find((p) => p.period === period)?.value ?? 0;
  return aid.total.map((p) => ({
    fy: fy(p.period),
    total: p.value,
    military: at(aid.military, p.period),
    missileDefense: at(aid.missile_defense, p.period),
    economic: at(aid.economic, p.period),
  }));
}

// Guttmacher's 1973–2020 counts and its monthly study's annual estimates
// (2023 on) are separate methods, kept as separate series.
export async function loadAbortionLongRun(): Promise<{ history: YearValue[]; study: YearValue[] } | null> {
  const [history, study] = await Promise.all([
    getSeriesMany("guttmacher-pregnancy-history", ["abortions"]),
    getSeriesMany("guttmacher-monthly-abortions", ["abortions"]),
  ]);
  const result = { history: annual(history.abortions), study: annual(study.abortions) };
  return result.study.length ? result : null;
}
