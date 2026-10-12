// Everything /abortion shows: Guttmacher's monthly provision study (2023–),
// its 1973–2020 series by state of residence, CDC's surveillance reports,
// and each state's gestational limit — all from area_stats.

import { datasetCoverage, getCrossSection, getSeriesMany, listDatasets, type Point } from "@/lib/db/stats";
import { STATES_51, stateName } from "@/lib/geo/states";
import { formatPeriod, formatValue, pctChange } from "@/lib/format";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";

const MONTHLY = "guttmacher-monthly-abortions";
const HISTORY = "guttmacher-pregnancy-history";
const CDC = "cdc-abortion-surveillance";
const LIMITS = "abortion-gestational-limits";

const annual = (points: Point[] | undefined): SeriesPoint[] =>
  (points ?? []).filter((p) => /^\d{4}$/.test(p.period)).map((p) => ({ x: Number(p.period), label: p.period, value: p.value }));
const monthly = (points: Point[] | undefined): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: Number(p.period.slice(0, 4)) + (Number(p.period.slice(5, 7)) - 1) / 12, label: formatPeriod(p.period), value: p.value }));
const at = (s: SeriesPoint[], year: string | null) => (year ? s.find((p) => p.label === year)?.value ?? null : null);
const fmt = (v: number | null | undefined, unit = "abortions") => formatValue(v, unit, { compact: true });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const theName = (name: string) => (name.startsWith("District") ? `the ${name}` : name);

export const LIMIT_CATEGORIES = [
  { value: 1, label: "Total ban" },
  { value: 2, label: "Banned at 6–12 weeks" },
  { value: 3, label: "Banned at 15–22 weeks" },
  { value: 4, label: "Banned at 24 weeks, viability, or third trimester" },
  { value: 5, label: "No gestational limit" },
] as const;

export interface StateTravel {
  fips: string;
  name: string;
  occurred: number | null; // abortions provided in the state
  residents: number | null; // abortions obtained by its residents anywhere
  leftState: number | null;
  cameFrom: RankedItem[]; // patients from other states, by home state
  wentTo: RankedItem[]; // residents who left, by destination state
}

export async function loadAbortion() {
  const [nation, banGroup, openGroup, hist, cdc, datasets] = await Promise.all([
    getSeriesMany(MONTHLY, ["abortions_monthly", "abortions", "abortions_from_other_states", "abortions_from_other_states_share", "abortions_virtual_only"]),
    getSeriesMany(MONTHLY, ["abortions_monthly", "abortions", "abortions_virtual_only"], "group", "total-ban"),
    getSeriesMany(MONTHLY, ["abortions_monthly", "abortions", "abortions_virtual_only"], "group", "no-total-ban"),
    getSeriesMany(HISTORY, ["abortions", "abortion_rate", "abortion_ratio"]),
    getSeriesMany(CDC, [
      "abortions_reported", "abortion_rate", "medication_share",
      "share_age_under15", "share_age_15_19", "share_age_20_24", "share_age_25_29", "share_age_30_34", "share_age_35_39", "share_age_40plus",
      "share_weeks_le6", "share_weeks_7_9", "share_weeks_10_13", "share_weeks_gt13",
      "abortion_rate_black", "abortion_rate_white", "abortion_rate_hispanic", "abortion_rate_other",
    ]),
    listDatasets({ topic: "abortion" }),
  ]);
  const order = [MONTHLY, HISTORY, CDC, LIMITS];
  const ds = [...datasets].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  const cov = await datasetCoverage(ds.map((d) => d.slug));

  const monthlyUS = monthly(nation.abortions_monthly);
  if (!monthlyUS.length) return null;
  const annualUS = annual(nation.abortions);
  const year = annualUS.at(-1)?.label ?? null;
  const priorYear = year ? String(Number(year) - 1) : null;
  const lastMonth = nation.abortions_monthly.at(-1)!;
  const sameMonthLastYear = nation.abortions_monthly.find((p) => p.period === `${Number(lastMonth.period.slice(0, 4)) - 1}${lastMonth.period.slice(4)}`);

  // ---- Headline ----
  const total = at(annualUS, year);
  const virtual = at(annual(nation.abortions_virtual_only), year);
  const fromOther = at(annual(nation.abortions_from_other_states), year);
  const headline = {
    year,
    priorYear,
    total: { value: total, change: pctChange(total, at(annualUS, priorYear)), spark: annualUS.map((p) => p.value) },
    month: {
      period: lastMonth.period,
      value: lastMonth.value,
      change: pctChange(lastMonth.value, sameMonthLastYear?.value ?? null),
      compare: sameMonthLastYear ? formatPeriod(sameMonthLastYear.period) : null,
      spark: monthlyUS.slice(-24).map((p) => p.value),
    },
    virtual: { value: virtual, share: total && virtual !== null ? (virtual / total) * 100 : null, spark: annual(nation.abortions_virtual_only).map((p) => p.value) },
    fromOther: { value: fromOther, share: at(annual(nation.abortions_from_other_states_share), year) },
  };

  // ---- Monthly trend ----
  const trend: Series[] = [{ id: "us", label: "United States", slot: 1, points: monthlyUS }];
  const groups: Series[] = [
    { id: "open", label: "States without total bans", slot: 1, points: monthly(openGroup.abortions_monthly) },
    { id: "ban", label: "States with total bans", slot: 2, points: monthly(banGroup.abortions_monthly) },
  ];
  const virtualSeries: Series[] = [
    { id: "open", label: "States without total bans", slot: 1, points: annual(openGroup.abortions_virtual_only) },
    { id: "ban", label: "States with total bans", slot: 2, points: annual(banGroup.abortions_virtual_only) },
  ];

  // ---- Long run: Guttmacher history + monthly-study annual totals + CDC ----
  const longRun: Series[] = [
    { id: "history", label: "Guttmacher, 1973–2020", slot: 1, points: annual(hist.abortions) },
    { id: "study", label: "Guttmacher monthly study", slot: 3, points: annualUS },
    { id: "cdc", label: "Reported to CDC (excludes CA, MD, NH)", slot: 2, points: annual(cdc.abortions_reported) },
  ].filter((s) => s.points.length) as Series[];
  const rates: Series[] = [
    { id: "history", label: "Guttmacher (all states)", slot: 1, points: annual(hist.abortion_rate) },
    { id: "cdc", label: "CDC (continuously reporting areas)", slot: 2, points: annual(cdc.abortion_rate) },
  ].filter((s) => s.points.length) as Series[];
  const histRate = annual(hist.abortion_rate);
  const peakRate = histRate.length ? histRate.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  // ---- Who, how, when (CDC) ----
  const cdcYear = cdc.medication_share?.at(-1)?.period ?? null;
  const cdcAt = (m: string) => cdc[m]?.find((p) => p.period === cdcYear)?.value ?? null;
  const ages: RankedItem[] = [
    ["share_age_under15", "Under 15"], ["share_age_15_19", "15–19"], ["share_age_20_24", "20–24"], ["share_age_25_29", "25–29"],
    ["share_age_30_34", "30–34"], ["share_age_35_39", "35–39"], ["share_age_40plus", "40 and over"],
  ].flatMap(([m, label]) => (cdcAt(m) === null ? [] : [{ label, value: cdcAt(m)! }]));
  const weeks: Series[] = [
    { id: "le6", label: "6 weeks or earlier", slot: 1, points: annual(cdc.share_weeks_le6) },
    { id: "7_9", label: "7–9 weeks", slot: 2, points: annual(cdc.share_weeks_7_9) },
    { id: "10_13", label: "10–13 weeks", slot: 3, points: annual(cdc.share_weeks_10_13) },
  ];
  const later = cdcAt("share_weeks_gt13");
  const raceRates: RankedItem[] = [
    ["abortion_rate_black", "Black (non-Hispanic)"], ["abortion_rate_hispanic", "Hispanic"],
    ["abortion_rate_other", "Other races (non-Hispanic)"], ["abortion_rate_white", "White (non-Hispanic)"],
  ].flatMap(([m, label]) => (cdcAt(m) === null ? [] : [{ label, value: cdcAt(m)! }]));
  const medication: Series[] = [{ id: "med", label: "Medication abortions", slot: 1, points: annual(cdc.medication_share) }];

  // ---- States ----
  const [occ, prior, fromOtherShare, virtualByState, residents, leftState, limitCat, limitWeeks, cdcRate, histStateRate, flows] = await Promise.all([
    getCrossSection(MONTHLY, "abortions", "state", { period: year ?? undefined }),
    getCrossSection(MONTHLY, "abortions", "state", { period: priorYear ?? undefined }),
    getCrossSection(MONTHLY, "abortions_from_other_states_share", "state", { period: year ?? undefined }),
    getCrossSection(MONTHLY, "abortions_virtual_only", "state", { period: year ?? undefined }),
    getCrossSection(MONTHLY, "abortions_by_residence", "state"),
    getCrossSection(MONTHLY, "abortions_residents_out_of_state", "state"),
    getCrossSection(LIMITS, "gestational_limit_category", "state"),
    getCrossSection(LIMITS, "gestational_limit_weeks", "state"),
    getCrossSection(CDC, "abortion_rate", "state"),
    getCrossSection(HISTORY, "abortion_rate", "state"),
    getCrossSection(MONTHLY, "abortion_travel", "flow"),
  ]);
  const byGeo = (x: { values: { geoid: string; value: number }[] }) => new Map(x.values.map((v) => [v.geoid, v.value]));
  const m = {
    occ: byGeo(occ), prior: byGeo(prior), share: byGeo(fromOtherShare), virtual: byGeo(virtualByState),
    residents: byGeo(residents), left: byGeo(leftState), weeks: byGeo(limitWeeks), cdc: byGeo(cdcRate), hist: byGeo(histStateRate),
  };
  const limitOf = new Map(limitCat.values.map((v) => [v.geoid, { category: v.value, detail: (v.metadata?.detail as string | undefined) ?? null }]));

  const travelYear = flows.period;
  const stateMetrics = [
    { key: "abortions", label: "Abortions provided", unit: "abortions", period: year ?? "", source: "Guttmacher Monthly Abortion Provision Study", group: "Abortions", description: "Abortions provided in the state, including medication abortion mailed into it by telehealth providers." },
    { key: "change", label: `Change, ${priorYear}–${year}`, unit: "percent", period: `${priorYear}–${year}`, source: "Guttmacher Monthly Abortion Provision Study", group: "Abortions" },
    { key: "residents", label: "Abortions obtained by residents", unit: "abortions", period: residents.period ?? "", source: "Guttmacher Monthly Abortion Provision Study", group: "Abortions", description: "Residents of the state who obtained an abortion in any state, including their own." },
    { key: "share", label: "Patients from other states", unit: "percent", period: year ?? "", source: "Guttmacher Monthly Abortion Provision Study", group: "Travel", description: "Share of abortions in the state provided to residents of other states." },
    { key: "left", label: "Residents who went to another state", unit: "abortions", period: leftState.period ?? "", source: "Guttmacher Monthly Abortion Provision Study", group: "Travel" },
    { key: "virtual", label: "Virtual-only (telehealth) abortions", unit: "abortions", period: year ?? "", source: "Guttmacher Monthly Abortion Provision Study", group: "Telehealth" },
    { key: "weeks", label: "Gestational limit (weeks)", unit: "weeks", period: `as of ${formatPeriod(limitCat.period ?? "")}`, source: "Guttmacher state policy summaries", group: "Law", description: "0 = total ban. Viability is shown as 24 weeks, the third trimester as 27. States with no limit are blank." },
    { key: "cdc", label: "Abortion rate, CDC", unit: "per_1000", period: cdcRate.period ?? "", source: "CDC Abortion Surveillance", group: "Rates", description: "Per 1,000 women aged 15–44, by state where the abortion took place. CA, MD, and NH do not report." },
    { key: "hist", label: "Abortion rate, residents", unit: "per_1000", period: histStateRate.period ?? "", source: "Guttmacher, 1973–2020", group: "Rates", description: "Per 1,000 women aged 15–44, by the woman's state of residence." },
  ];
  const stateRows = STATES_51.map((s) => {
    const cur = m.occ.get(s.fips) ?? null;
    return {
      abbr: s.abbr,
      name: s.name,
      values: {
        abortions: cur,
        change: pctChange(cur, m.prior.get(s.fips) ?? null),
        residents: m.residents.get(s.fips) ?? null,
        share: m.share.get(s.fips) ?? null,
        left: m.left.get(s.fips) ?? null,
        virtual: m.virtual.get(s.fips) ?? null,
        weeks: m.weeks.get(s.fips) ?? null,
        cdc: m.cdc.get(s.fips) ?? null,
        hist: m.hist.get(s.fips) ?? null,
      },
    };
  });

  // ---- Gestational limits, grouped ----
  const limits = LIMIT_CATEGORIES.map((c) => ({
    ...c,
    states: STATES_51.filter((s) => limitOf.get(s.fips)?.category === c.value).map((s) => ({ abbr: s.abbr, name: s.name, detail: limitOf.get(s.fips)!.detail })),
  }));

  // ---- Travel ----
  const parsed = flows.values.map((f) => {
    const [dest, origin] = f.geoid.split(":");
    return { dest, origin, value: f.value };
  });
  const corridors: RankedItem[] = parsed
    .filter((f) => f.dest !== f.origin)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
    .map((f) => ({ label: `${stateName(f.origin)} → ${stateName(f.dest)}`, value: f.value }));
  const travel: StateTravel[] = STATES_51.map((s) => ({
    fips: s.fips,
    name: s.name,
    occurred: m.occ.get(s.fips) ?? null,
    residents: m.residents.get(s.fips) ?? null,
    leftState: m.left.get(s.fips) ?? null,
    cameFrom: parsed
      .filter((f) => f.dest === s.fips && f.origin !== s.fips)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((f) => ({ label: stateName(f.origin), value: f.value })),
    wentTo: parsed
      .filter((f) => f.origin === s.fips && f.dest !== s.fips)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((f) => ({ label: stateName(f.dest), value: f.value })),
  }));
  const leftRanking: RankedItem[] = STATES_51.flatMap((s) => {
    const v = m.left.get(s.fips);
    const r = m.residents.get(s.fips);
    return v ? [{ label: s.name, value: v, note: r ? `${pct((v / r) * 100)} of residents' abortions` : undefined }] : [];
  })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ---- Findings: plain statements computed from the numbers above ----
  const findings: string[] = [];
  if (year && total !== null) {
    const ch = headline.total.change;
    findings.push(
      `Clinicians provided an estimated ${fmt(total)} abortions in ${year}${ch !== null ? `, ${Math.abs(ch) < 0.5 ? "about the same as" : `${pct(Math.abs(ch))} ${ch < 0 ? "fewer than" : "more than"}`} ${priorYear}` : ""}.`,
    );
  }
  const hist2020 = at(annual(hist.abortions), "2020");
  if (hist2020 !== null && total !== null && year) {
    findings.push(`That is ${fmt(Math.abs(total - hist2020))} ${total > hist2020 ? "more" : "fewer"} than in 2020 (${fmt(hist2020)}), before the Supreme Court's June 2022 Dobbs decision returned abortion law to the states.`);
  }
  if (peakRate) findings.push(`The abortion rate peaked in ${peakRate.label} at ${formatValue(peakRate.value, "per_1000")} per 1,000 women aged 15–44; in 2020 it was ${formatValue(at(histRate, "2020"), "per_1000")}.`);
  if (headline.virtual.share !== null && year) findings.push(`${pct(headline.virtual.share)} of abortions in ${year} were provided by virtual-only telehealth providers, which mail pills after an online consultation.`);
  const banVirtual = at(annual(banGroup.abortions_virtual_only), year);
  if (banVirtual !== null && year) findings.push(`${fmt(banVirtual)} abortions in ${year} were medication abortions mailed by telehealth providers into the ${limits[0].states.length} states with total bans.`);
  if (headline.fromOther.value !== null && year) findings.push(`${fmt(headline.fromOther.value)} patients (${pct(headline.fromOther.share)}) traveled to another state for an abortion in ${year}.`);
  const topLeft = leftRanking[0];
  if (topLeft && travelYear) findings.push(`${theName(topLeft.label).replace(/^the/, "The")} had the most residents leave the state for an abortion in ${travelYear}: at least ${fmt(topLeft.value)}.`);
  const med = cdc.medication_share?.at(-1);
  const medFirst = cdc.medication_share?.[0];
  if (med && medFirst) findings.push(`Medication abortion rose from ${pct(medFirst.value)} of abortions reported to CDC in ${medFirst.period} to ${pct(med.value)} in ${med.period}.`);

  return {
    headline,
    findings,
    trend,
    groups,
    virtualSeries,
    longRun,
    rates,
    medication,
    cdcYear,
    ages,
    weeks,
    later,
    raceRates,
    states: { metrics: stateMetrics, rows: stateRows },
    limits,
    limitsPeriod: limitCat.period,
    travel: { year: travelYear, corridors, states: travel, leftRanking },
    datasets: ds.map((d) => ({ ...d, coverage: cov[d.slug] ?? null })),
  };
}

export type AbortionData = NonNullable<Awaited<ReturnType<typeof loadAbortion>>>;
