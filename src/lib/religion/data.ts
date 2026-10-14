// Everything /religion shows beyond the affiliation explorer: Pew's
// Religious Landscape Study (states and religious groups, 2007 / 2014 /
// 2023–24) and Gallup's annual trends — all from area_stats.

import { datasetCoverage, getCrossSection, getSeriesByGeo, getSeriesMany, listDatasets, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";

const PEW = "pew-rls";
const GALLUP = "gallup-religion";
// The 2023–24 survey is stored as period 2024.
const SURVEY: Record<string, string> = { "2007": "2007", "2014": "2014", "2024": "2023–24" };

const annual = (points: Point[] | undefined): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: Number(p.period), label: p.period, value: p.value }));
const pewSeries = (points: Point[] | undefined): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: Number(p.period), label: SURVEY[p.period] ?? p.period, value: p.value }));
const whole = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const last = (points: Point[] | undefined) => points?.at(-1) ?? null;
const at = (points: Point[] | undefined, period: string) => points?.find((p) => p.period === period)?.value ?? null;

// Religious groups with a national page, in the order Pew lists them.
export const GROUPS = [
  { slug: "evangelical-protestant", label: "Evangelical Protestant", short: "Evangelical" },
  { slug: "mainline-protestant", label: "Mainline Protestant", short: "Mainline" },
  { slug: "historically-black-protestant", label: "Historically Black Protestant", short: "Black Protestant" },
  { slug: "catholic", label: "Catholic", short: "Catholic" },
  { slug: "latter-day-saint-mormon", label: "Latter-day Saint (Mormon)", short: "Latter-day Saint" },
  { slug: "orthodox-christian", label: "Orthodox Christian", short: "Orthodox" },
  { slug: "jewish", label: "Jewish", short: "Jewish" },
  { slug: "muslim", label: "Muslim", short: "Muslim" },
  { slug: "buddhist", label: "Buddhist", short: "Buddhist" },
  { slug: "hindu", label: "Hindu", short: "Hindu" },
  { slug: "atheist", label: "Atheist", short: "Atheist" },
  { slug: "agnostic", label: "Agnostic", short: "Agnostic" },
  { slug: "nothing-in-particular", label: "Nothing in particular", short: "Nothing in particular" },
] as const;
const AGGREGATES = [{ slug: "christian", label: "All Christians" }] as const;

const PROFILE_METRICS = [
  "share_of_adults", "attendance_weekly", "importance_very", "pray_daily", "god_certain", "party_rep", "party_dem",
  "age_18_29", "age_65plus", "race_white", "race_black", "race_hispanic", "race_asian", "educ_college", "educ_postgrad",
] as const;
type ProfileMetric = (typeof PROFILE_METRICS)[number];

export interface GroupProfile {
  slug: string;
  label: string;
  short: string;
  latest: Record<ProfileMetric, number | null>;
  first: Record<ProfileMetric, number | null>; // 2007
  series: Record<ProfileMetric, Point[]>;
}

const STATE_SHARES = [
  ["share_christian", "Christian"],
  ["share_evangelical_protestant", "Evangelical Protestant"],
  ["share_mainline_protestant", "Mainline Protestant"],
  ["share_historically_black_protestant", "Historically Black Protestant"],
  ["share_catholic", "Catholic"],
  ["share_latter_day_saint_mormon", "Latter-day Saint (Mormon)"],
  ["share_jewish", "Jewish"],
  ["share_other_religions", "Non-Christian religions"],
  ["share_unaffiliated", "Religiously unaffiliated"],
] as const;
const STATE_PRACTICE = [
  ["attendance_weekly", "Attend services weekly", "Practice"],
  ["attendance_seldom", "Seldom or never attend", "Practice"],
  ["pray_daily", "Pray at least daily", "Practice"],
  ["importance_very", "Religion very important", "Belief"],
  ["god_certain", "Absolutely certain God exists", "Belief"],
  ["party_rep", "Republican or lean Republican", "Politics"],
  ["party_dem", "Democrat or lean Democrat", "Politics"],
] as const;

export async function loadReligion() {
  const [nation, gallup, datasets] = await Promise.all([
    getSeriesMany(PEW, [
      "share_christian", "share_unaffiliated", "share_other_religions", "attendance_weekly", "attendance_seldom",
      "importance_very", "pray_daily", "god_certain", "party_rep", "party_dem",
      ...GROUPS.map((g) => `share_${g.slug.replace(/-/g, "_")}`),
    ]),
    getSeriesMany(GALLUP, [
      "attended_past_week", "attend_every_week", "attend_almost_every_week", "attend_monthly", "attend_seldom", "attend_never",
      "church_member", "religion_very_important", "preference_protestant", "preference_catholic", "preference_none",
      "preference_christian_nonspecific", "confidence_great_deal", "confidence_quite_a_lot", "born_again",
    ]),
    listDatasets({ topic: "religion" }),
  ]);
  if (!nation.share_christian.length && !gallup.church_member.length) return null;
  const cov = await datasetCoverage(datasets.map((d) => d.slug));

  // ---- Groups: national profile of each tradition ----
  const groupRows = await Promise.all(
    [...GROUPS, ...AGGREGATES.map((a) => ({ ...a, short: a.label }))].map(async (g) => {
      const series = (await getSeriesMany(PEW, [...PROFILE_METRICS], "group", g.slug)) as Record<ProfileMetric, Point[]>;
      return {
        slug: g.slug,
        label: g.label,
        short: g.short,
        series,
        latest: Object.fromEntries(PROFILE_METRICS.map((m) => [m, last(series[m])?.value ?? null])) as GroupProfile["latest"],
        first: Object.fromEntries(PROFILE_METRICS.map((m) => [m, at(series[m], "2007")])) as GroupProfile["first"],
      } satisfies GroupProfile;
    }),
  );
  const groups = groupRows.filter((g) => GROUPS.some((x) => x.slug === g.slug));
  const christian = groupRows.find((g) => g.slug === "christian")!;

  // Composition: share of U.S. adults in each tradition, 2007 vs 2023–24.
  const composition: RankedItem[] = groups
    .filter((g) => g.latest.share_of_adults !== null)
    .map((g) => ({
      label: g.label,
      value: g.latest.share_of_adults!,
      note: g.first.share_of_adults !== null ? `2007: ${whole(g.first.share_of_adults)}` : undefined,
    }))
    .sort((a, b) => b.value - a.value);

  // Largest denominations, 2023–24.
  const denoms = await getCrossSection(PEW, "share_of_adults", "group", { period: "2024" });
  const denominations: RankedItem[] = denoms.values
    .filter((v) => v.metadata?.kind === "denomination" && !/other|nonspecific|unaffiliated/i.test(String(v.metadata?.label ?? v.geoName)))
    .slice(0, 12)
    .map((v) => ({ label: String(v.metadata?.label ?? v.geoName), value: v.value }));

  // Party by tradition: Republican lean, latest, ranked.
  const partyLean: RankedItem[] = groups
    .filter((g) => g.latest.party_rep !== null)
    .map((g) => ({
      label: g.label,
      value: g.latest.party_rep!,
      note: g.latest.party_dem !== null ? `Dem/lean Dem ${whole(g.latest.party_dem)}` : undefined,
      color: g.latest.party_rep! >= (g.latest.party_dem ?? 0) ? "var(--viz-rep)" : "var(--viz-dem)",
    }))
    .sort((a, b) => b.value - a.value);
  const partyTrend = (slug: string, label: string, slot: 1 | 2 | 3): Series => ({
    id: slug, label, slot, points: pewSeries(groupRows.find((g) => g.slug === slug)?.series.party_rep),
  });
  const partyShift: Series[] = [
    partyTrend("evangelical-protestant", "Evangelical Protestants", 2),
    partyTrend("catholic", "Catholics", 1),
    partyTrend("nothing-in-particular", "Nothing in particular", 3),
  ];

  // Weekly attendance by tradition.
  const attendanceByGroup: RankedItem[] = groups
    .filter((g) => g.latest.attendance_weekly !== null)
    .map((g) => ({ label: g.label, value: g.latest.attendance_weekly!, note: g.first.attendance_weekly !== null ? `2007: ${whole(g.first.attendance_weekly)}` : undefined }))
    .sort((a, b) => b.value - a.value);

  // ---- Long-run trends (Gallup) ----
  const attendance: Series[] = [
    { id: "past-week", label: "Attended in the past week", slot: 1, points: annual(gallup.attended_past_week) },
    { id: "member", label: "Member of a church, synagogue, or mosque", slot: 3, points: annual(gallup.church_member) },
    { id: "never", label: "Never attend", slot: 2, points: annual(gallup.attend_never) },
  ];
  const christianNonspecific = new Map(gallup.preference_christian_nonspecific.map((p) => [p.period, p.value]));
  const preference: Series[] = [
    {
      id: "protestant",
      label: "Protestant or other Christian",
      slot: 1,
      // Gallup splits out "Christian (nonspecific)" from 2000; added back so the line is continuous.
      points: gallup.preference_protestant.map((p) => ({ x: Number(p.period), label: p.period, value: p.value + (christianNonspecific.get(p.period) ?? 0) })),
    },
    { id: "catholic", label: "Catholic", slot: 3, points: annual(gallup.preference_catholic) },
    { id: "none", label: "No religion", slot: 2, points: annual(gallup.preference_none) },
  ];
  const importance: Series[] = [
    { id: "gallup", label: "Religion very important (Gallup)", slot: 1, points: annual(gallup.religion_very_important) },
  ];
  const confidence: Series[] = [
    {
      id: "confidence",
      label: "Great deal or quite a lot of confidence in organized religion",
      slot: 1,
      points: gallup.confidence_great_deal.flatMap((p) => {
        const q = gallup.confidence_quite_a_lot.find((x) => x.period === p.period);
        return q ? [{ x: Number(p.period), label: p.period, value: p.value + q.value }] : [];
      }),
    },
  ];

  // ---- States ----
  const keys = [...STATE_SHARES.map(([k]) => k), ...STATE_PRACTICE.map(([k]) => k)];
  const byGeo = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSeriesByGeo(PEW, k, "state")] as const)));
  const valueAt = (k: string, fips: string, period: string) => byGeo[k]?.[fips]?.find((p) => p.period === period)?.value ?? null;
  const change = (k: string, fips: string) => {
    const now = valueAt(k, fips, "2024");
    const then = valueAt(k, fips, "2007");
    return now === null || then === null ? null : now - then;
  };
  const stateMetrics: StateMetric[] = [
    ...STATE_PRACTICE.map(([key, label, group]) => ({ key, label, unit: "percent", period: "2023–24", source: "Pew Religious Landscape Study", group })),
    { key: "attendance_change", label: "Change in weekly attendance since 2007", unit: "points", period: "2007 to 2023–24", source: "Pew Religious Landscape Study", group: "Practice", description: "Percentage points." },
    ...STATE_SHARES.map(([key, label]) => ({ key, label, unit: "percent", period: "2023–24", source: "Pew Religious Landscape Study", group: "Identity" })),
    { key: "christian_change", label: "Change in Christian share since 2007", unit: "points", period: "2007 to 2023–24", source: "Pew Religious Landscape Study", group: "Identity", description: "Percentage points." },
    { key: "unaffiliated_change", label: "Change in unaffiliated share since 2007", unit: "points", period: "2007 to 2023–24", source: "Pew Religious Landscape Study", group: "Identity", description: "Percentage points." },
  ];
  const stateRows: StateRow[] = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: {
      ...Object.fromEntries(keys.map((k) => [k, valueAt(k, s.fips, "2024")])),
      attendance_change: change("attendance_weekly", s.fips),
      christian_change: change("share_christian", s.fips),
      unaffiliated_change: change("share_unaffiliated", s.fips),
    },
  }));
  // Highest first, or lowest first with `lowest`.
  const ranked = (k: string, n = 10, lowest = false): RankedItem[] =>
    stateRows
      .filter((r) => r.values[k] !== null)
      .sort((a, b) => (b.values[k]! - a.values[k]!) * (lowest ? -1 : 1))
      .slice(0, n)
      .map((r) => ({ label: r.name, value: r.values[k]!, note: k === "attendance_weekly" && r.values.attendance_change !== null ? `${r.values.attendance_change! > 0 ? "+" : ""}${Math.round(r.values.attendance_change!)} pts since 2007` : undefined }));
  const attendanceTop = ranked("attendance_weekly");
  const attendanceBottom = ranked("attendance_weekly", 10, true);
  const attendanceDrop = stateRows
    .filter((r) => r.values.attendance_change !== null)
    .sort((a, b) => a.values.attendance_change! - b.values.attendance_change!)
    .slice(0, 10)
    .map((r) => ({ label: r.name, value: Math.abs(r.values.attendance_change!), note: `${whole(valueAt("attendance_weekly", STATES_51.find((s) => s.abbr === r.abbr)!.fips, "2007"))} → ${whole(r.values.attendance_weekly)}` }));

  // ---- Headline + findings ----
  const nWeekly = last(nation.attendance_weekly);
  const headline = {
    christian: { value: at(nation.share_christian, "2024"), then: christian.first.share_of_adults },
    nones: { value: at(nation.share_unaffiliated, "2024"), then: at(nation.share_unaffiliated, "2007") },
    weekly: { value: nWeekly?.value ?? null },
    member: { point: last(gallup.church_member), spark: gallup.church_member.map((p) => p.value) },
    pastWeek: { point: last(gallup.attended_past_week), spark: gallup.attended_past_week.map((p) => p.value) },
  };

  const findings: string[] = [];
  if (headline.christian.value !== null && headline.christian.then !== null) {
    findings.push(`${whole(headline.christian.value)} of U.S. adults identified as Christian in 2023–24, down from ${whole(headline.christian.then)} in 2007; ${whole(headline.nones.value)} were religiously unaffiliated, up from ${whole(headline.nones.then)}.`);
  }
  const member = headline.member.point;
  const memberFirst = gallup.church_member[0];
  if (member && memberFirst) findings.push(`${whole(member.value)} of Americans said they belonged to a church, synagogue, or mosque in ${member.period}, against ${whole(memberFirst.value)} in ${memberFirst.period} (Gallup).`);
  const pw = headline.pastWeek.point;
  const pwFirst = gallup.attended_past_week[0];
  if (pw && pwFirst) findings.push(`${whole(pw.value)} said they had attended services in the past week in ${pw.period}, compared with ${whole(pwFirst.value)} in ${pwFirst.period}.`);
  if (attendanceTop[0] && attendanceBottom[0]) findings.push(`Weekly attendance ranges from ${whole(attendanceTop[0].value)} in ${attendanceTop[0].label} to ${whole(attendanceBottom[0].value)} in ${attendanceBottom[0].label} (2023–24).`);
  const ev = groups.find((g) => g.slug === "evangelical-protestant");
  if (ev?.latest.party_rep != null && ev.first.party_rep != null) findings.push(`${whole(ev.latest.party_rep)} of evangelical Protestants identify with or lean to the Republican Party, up from ${whole(ev.first.party_rep)} in 2007.`);
  const prefNone = last(gallup.preference_none);
  const prefNoneFirst = gallup.preference_none[0];
  if (prefNone && prefNoneFirst) findings.push(`In Gallup's polling, the share naming no religion rose from ${whole(prefNoneFirst.value)} in ${prefNoneFirst.period} to ${whole(prefNone.value)} in ${prefNone.period}.`);

  const order = [PEW, GALLUP];
  return {
    headline,
    findings,
    composition,
    denominations,
    groups,
    christian,
    partyLean,
    partyShift,
    attendanceByGroup,
    attendance,
    preference,
    importance,
    confidence,
    states: { metrics: stateMetrics, rows: stateRows },
    attendanceTop,
    attendanceBottom,
    attendanceDrop,
    national: {
      weekly: at(nation.attendance_weekly, "2024"),
      seldom: at(nation.attendance_seldom, "2024"),
      importance: at(nation.importance_very, "2024"),
      prayDaily: at(nation.pray_daily, "2024"),
      godCertain: at(nation.god_certain, "2024"),
    },
    datasets: [...datasets]
      .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
      .map((d) => ({ ...d, coverage: cov[d.slug] ?? null })),
  };
}
