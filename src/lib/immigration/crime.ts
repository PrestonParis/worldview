// /immigration's "Crime and citizenship" section: federal sentencing by
// citizenship (USSC), non-citizens in state and federal prisons (BJS, BOP),
// and Texas DPS charges and convictions of illegal noncitizens.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { toPoints } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const USSC = "ussc-sourcebook";
const BJS = "bjs-prisoners";
const BOP = "bop-population";
const DPS = "texas-dps-noncitizen";
const ACS = "census-acs1-immigration";

const DPS_OFFENSES = [
  ["homicide", "Homicide"],
  ["sexual_assault", "Sexual assault"],
  ["sexual_offense", "Other sexual offense"],
  ["kidnapping", "Kidnapping"],
  ["robbery", "Robbery"],
  ["assault", "Assault"],
  ["burglary", "Burglary"],
  ["theft", "Theft"],
  ["weapon", "Weapon"],
  ["drug", "Drug"],
  ["obstructing_police", "Obstructing police"],
] as const;
const BOP_COUNTRIES = [
  ["us", "United States"],
  ["mexico", "Mexico"],
  ["dominican", "Dominican Republic"],
  ["colombia", "Colombia"],
  ["cuba", "Cuba"],
  ["other", "Other or unknown"],
] as const;

const last = (p: Point[] | undefined) => p?.at(-1) ?? null;
const at = (p: Point[] | undefined, period: string) => p?.find((x) => x.period === period)?.value ?? null;

export async function loadCrimeCitizenship() {
  const [nation, immigration, acs, bop, dps] = await Promise.all([
    getSeriesMany(USSC, ["noncitizen_share", "sentenced_total", "sentenced_noncitizen"]),
    getSeriesMany(USSC, ["sentenced_total", "sentenced_noncitizen"], "offense", "immigration"),
    getSeriesMany(ACS, ["noncitizen"]),
    getSeriesMany(BOP, [...BOP_COUNTRIES.flatMap(([c]) => [`citizen_${c}`, `citizen_${c}_pct`]), "total_population"]),
    getSeriesMany(
      DPS,
      ["booked_noncitizens", "booked_illegal", "jail_window_charges", "jail_window_convictions", ...DPS_OFFENSES.flatMap(([o]) => [`jail_window_charges_${o}`, `jail_window_convictions_${o}`])],
      "state",
      "48",
    ),
  ]);
  if (!nation.noncitizen_share?.length) return null;

  // Federal sentencing: all cases, and without immigration offenses (nearly
  // all of which only non-citizens can commit).
  const withoutImmigration = nation.sentenced_total.flatMap((p) => {
    const nc = at(nation.sentenced_noncitizen, p.period);
    const it = at(immigration.sentenced_total, p.period);
    const inc = at(immigration.sentenced_noncitizen, p.period);
    if (nc === null || it === null || inc === null) return [];
    return [{ ...p, value: Math.round(((nc - inc) / (p.value - it)) * 1000) / 10 }];
  });
  const sentencingTrend: Series[] = [
    { id: "all", label: "All federal cases", slot: 1, points: toPoints(nation.noncitizen_share) },
    { id: "nonimm", label: "Excluding immigration offenses", slot: 2, points: toPoints(withoutImmigration) },
  ];
  const fy = last(nation.noncitizen_share)!.period;

  // By offense, latest year: categories with at least 100 cases.
  const [shares, totals] = await Promise.all([
    getCrossSection(USSC, "noncitizen_share", "offense", { period: fy }),
    getCrossSection(USSC, "sentenced_total", "offense", { period: fy }),
  ]);
  const caseCount = new Map(totals.values.map((v) => [v.geoid, v.value]));
  const byOffense: RankedItem[] = shares.values
    .filter((v) => (caseCount.get(v.geoid) ?? 0) >= 100 && v.geoid !== "other")
    .map((v) => ({ label: v.geoName ?? v.geoid, value: v.value, note: `${(caseCount.get(v.geoid) ?? 0).toLocaleString()} cases` }))
    .sort((a, b) => b.value - a.value);

  // Prisons: state and federal non-citizen shares (BJS), federal by country (BOP).
  const prisonShares = await getCrossSection(BJS, "noncitizen_share", "state");
  const federalShare = await getCrossSection(BJS, "noncitizen_share", "jurisdiction");
  const prisons: RankedItem[] = [
    ...federalShare.values.map((v) => ({ label: "Federal prisons", value: v.value })),
    ...prisonShares.values.map((v) => ({ label: v.geoName ?? v.geoid, value: v.value })),
  ].sort((a, b) => b.value - a.value);
  const bopDate = last(bop.total_population)?.period ?? null;
  const bopCountries: RankedItem[] = bopDate
    ? BOP_COUNTRIES.flatMap(([c, label]) => {
        const n = at(bop[`citizen_${c}`], bopDate);
        const p = at(bop[`citizen_${c}_pct`], bopDate);
        return n === null ? [] : [{ label, value: n, note: p !== null ? `${p.toFixed(1)}%` : undefined }];
      })
    : [];
  const bopNoncitizenPct = bopDate && at(bop.citizen_us_pct, bopDate) !== null ? Math.round((100 - at(bop.citizen_us_pct, bopDate)!) * 10) / 10 : null;

  // Texas DPS, latest snapshot.
  const dpsDate = last(dps.booked_illegal)?.period ?? null;
  const texas = dpsDate
    ? {
        asOf: dpsDate,
        booked: at(dps.booked_noncitizens, dpsDate),
        illegal: at(dps.booked_illegal, dpsDate),
        charges: at(dps.jail_window_charges, dpsDate),
        convictions: at(dps.jail_window_convictions, dpsDate),
        offenses: DPS_OFFENSES.map(([o, label]) => ({
          label,
          charges: at(dps[`jail_window_charges_${o}`], dpsDate),
          convictions: at(dps[`jail_window_convictions_${o}`], dpsDate),
        })),
      }
    : null;

  return {
    fy,
    sentencedNoncitizenShare: last(nation.noncitizen_share),
    withoutImmigrationShare: withoutImmigration.at(-1) ?? null,
    populationNoncitizenShare: last(acs.noncitizen),
    sentencingTrend,
    byOffense,
    prisons,
    prisonsYear: prisonShares.period,
    bopDate,
    bopCountries,
    bopNoncitizenPct,
    texas,
  };
}

export type CrimeCitizenship = NonNullable<Awaited<ReturnType<typeof loadCrimeCitizenship>>>;
