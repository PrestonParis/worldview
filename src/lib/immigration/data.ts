// Everything /immigration shows, assembled server-side from area_stats.
// Each section degrades to empty when its dataset hasn't been imported yet.

import {
  datasetCoverage,
  getCrossSection,
  getSeries,
  getSeriesByGeo,
  getSeriesMany,
  listDatasets,
  sumByGeo,
  type AreaValue,
  type Point,
} from "@/lib/db/stats";
import type { SeriesSlot } from "@/components/charts/time-series-chart";
import { FIPS_TO_ABBR, STATES_51, stateName } from "@/lib/geo/states";
import { formatPeriod, pctChange, periodToX, tidyLabel } from "@/lib/format";
import { fiscalYearTotals, shiftMonth, toChartPoints, trailingSum, valueAt, type ChartPoint } from "@/lib/stats/series";

const last = (p: Point[]) => p.at(-1) ?? null;
const prev = (p: Point[]) => p.at(-2) ?? null;
const named = (values: AreaValue[]) => values.map((r) => ({ label: r.geoName ?? r.geoid, value: r.value }));
const byPeriod = (p: Point[]) => new Map(p.map((x) => [x.period, x.value]));
const isPartial = (p: Point) => p.metadata?.partial === true;
// Sum several series period by period (over the union of their periods).
function addSeries(...series: Point[][]): Point[] {
  const out = new Map<string, Point>();
  for (const s of series)
    for (const p of s) {
      const cur = out.get(p.period);
      if (cur) cur.value += p.value;
      else out.set(p.period, { period: p.period, periodStart: p.periodStart, value: p.value });
    }
  return [...out.values()].sort((a, b) => (a.periodStart ?? a.period).localeCompare(b.periodStart ?? b.period));
}

const OVERSTAY_TYPES: Record<string, string> = {
  vwp: "Visa Waiver Program visitors",
  "non-vwp-visitors": "Other business and tourist visitors",
  students: "Students and exchange visitors",
  other: "All other temporary visitors",
  "canada-mexico": "Canadian and Mexican visitors",
};

// CBP land-border regions as stored by import-cbp-encounters.mjs.
const REGIONS = [
  { key: "nation", level: "nation", geoid: "US", label: "Nationwide", subtitle: "All CBP encounters: land borders, coasts, and airports" },
  { key: "southwest", level: "border_region", geoid: "southwest_land_border", label: "Southwest border", subtitle: "The land border with Mexico" },
  { key: "northern", level: "border_region", geoid: "northern_land_border", label: "Northern border", subtitle: "The land border with Canada" },
  { key: "other", level: "border_region", geoid: "other", label: "Coasts & airports", subtitle: "Coastal Border Patrol sectors and interior ports, mostly airports" },
] as const;
const CBP_SPLITS = [
  "encounters_title_8",
  "encounters_title_42",
  "encounters_usbp",
  "encounters_ofo",
  "encounters_single_adults",
  "encounters_fmua",
  "encounters_accompanied_minors",
  "encounters_uac",
  "encounters_uc_single_minors",
];

// DHS nonimmigrant classes of admission (import-dhs-yearbook.mjs codes),
// grouped by purpose. H-2B shares its row with returning workers ('h2r').
const NONIMMIGRANT_GROUPS: [string, string[]][] = [
  ["Tourists", ["b2", "wt", "gmt"]],
  ["Business visitors", ["b1", "wb", "gmb"]],
  ["Temporary workers & trainees", ["h1b", "h1b1", "h1c", "h2a", "h2r", "h3", "o1", "o2", "p1", "p2", "p3", "r1", "tn", "e3", "cw1", "l1", "e1", "e2", "e2c", "i1"]],
  ["Spouses & children of temporary residents", ["h4", "o3", "p4", "r2", "td", "e3s", "e3y", "l2", "l2s", "l2y", "e1s", "e1y", "e2s", "e2y", "cw2", "f2", "m2", "j2"]],
  ["Students", ["f1", "m1", "f3"]],
  ["Exchange visitors", ["j1", "q1"]],
  ["Transit passengers", ["c1", "c2", "c3"]],
  ["Diplomats & international organizations", ["a1", "a2", "a3", "g1", "g2", "g3", "g4", "g5", "n1-to-n7"]],
  ["Fiancé(e)s & other family", ["k1", "k2", "k3", "k4", "v1", "v2", "v3", "n8", "n9", "q2", "q3"]],
];
const WORK_VISAS: [string, string][] = [
  ["tn", "TN — USMCA professionals (Canada, Mexico)"],
  ["h1b", "H-1B — specialty occupations"],
  ["h2a", "H-2A — seasonal agricultural workers"],
  ["l1", "L-1 — intracompany transferees"],
  ["e2", "E-2 — treaty investors"],
  ["h2r", "H-2B — seasonal non-farm workers"],
  ["o1", "O-1 — extraordinary ability"],
  ["p1", "P-1 — athletes and entertainers"],
  ["e1", "E-1 — treaty traders"],
  ["e3", "E-3 — Australian professionals"],
];

export async function loadImmigration() {
  // ---------------------------------------------------------------- Border
  const [encounters, regionSplits] = await Promise.all([
    getSeries("cbp", "encounters_total"),
    Promise.all(REGIONS.map((r) => getSeriesMany("cbp", CBP_SPLITS, r.level, r.geoid))),
  ]);
  const lastMonth = last(encounters)?.period ?? null;
  const windowFrom = lastMonth ? `${shiftMonth(lastMonth, -11)}-01` : null;
  const windowTo = lastMonth ? `${lastMonth}-01` : null;
  const [byCitizenship, encountersByState, encountersByAor, usbp12, ofo12] =
    windowFrom && windowTo
      ? await Promise.all([
          sumByGeo("cbp", "encounters_by_citizenship", "citizenship", windowFrom, windowTo),
          sumByGeo("cbp", "encounters_total", "state", windowFrom, windowTo),
          sumByGeo("cbp", "encounters_by_aor", "aor", windowFrom, windowTo),
          sumByGeo("cbp", "encounters_usbp", "nation", windowFrom, windowTo),
          sumByGeo("cbp", "encounters_ofo", "nation", windowFrom, windowTo),
        ])
      : [[], [], [], [], []];

  const borderSeries = Object.fromEntries(
    REGIONS.map((r, i) => {
      const s = regionSplits[i];
      // UAC was "UC / Single Minors" in files before FY 2023; take the newer
      // label wherever both exist.
      const uacNew = byPeriod(s.encounters_uac);
      const uac = [...s.encounters_uc_single_minors.filter((p) => !uacNew.has(p.period)), ...s.encounters_uac];
      return [
        r.key,
        {
          authority: [
            { id: "t8", label: "Title 8 (immigration law)", slot: 1 as const, points: toChartPoints(s.encounters_title_8) },
            { id: "t42", label: "Title 42 (public-health expulsions)", slot: 2 as const, points: toChartPoints(s.encounters_title_42) },
          ],
          agency: [
            { id: "usbp", label: "Border Patrol — between ports", slot: 1 as const, points: toChartPoints(s.encounters_usbp) },
            { id: "ofo", label: "Field Operations — at ports of entry", slot: 3 as const, points: toChartPoints(s.encounters_ofo) },
          ],
          group: [
            { id: "adults", label: "Single adults", slot: 1 as const, points: toChartPoints(s.encounters_single_adults) },
            {
              id: "families",
              label: "Family units & accompanied children",
              slot: 2 as const,
              points: toChartPoints(addSeries(s.encounters_fmua, s.encounters_accompanied_minors)),
            },
            { id: "uac", label: "Unaccompanied children", slot: 3 as const, points: toChartPoints(uac.sort((a, b) => a.period.localeCompare(b.period))) },
          ],
        },
      ];
    }),
  );

  // ------------------------------------------------------- Legal permanent
  const [lpr, lprComponents, naturalizations, natzApps, natzShare, lprByClass, lprByCountry, natzByCountry, lprByState, natzByState, lprClassSeries] =
    await Promise.all([
      getSeries("dhs-yearbook", "lpr_total"),
      getSeriesMany("dhs-yearbook", ["lpr_adjustments", "lpr_new_arrivals"]),
      getSeries("dhs-yearbook", "naturalizations_total"),
      getSeries("dhs-yearbook", "naturalization_applications"),
      getSeries("census-acs1-immigration", "naturalized_share_of_foreign_born"),
      getCrossSection("dhs-yearbook", "lpr_by_class", "class"),
      getCrossSection("dhs-yearbook", "lpr_by_country", "country"),
      getCrossSection("dhs-yearbook", "naturalizations_by_country", "country"),
      getCrossSection("dhs-yearbook", "lpr_total", "state"),
      getCrossSection("dhs-yearbook", "naturalizations_total", "state"),
      getSeriesByGeo("dhs-yearbook", "lpr_by_class", "class"),
    ]);
  // Pathways: the seven largest classes, the rest folded into "All other".
  const classes = named(lprByClass.values).map((c) =>
    c.label.startsWith("Certain Iraqis and Afghans") ? { ...c, label: "Iraqi & Afghan special immigrants (U.S. government employees)" } : c,
  );
  const pathways = [
    ...classes.slice(0, 7),
    ...(classes.length > 7 ? [{ label: "All other classes", value: classes.slice(7).reduce((t, c) => t + c.value, 0) }] : []),
  ];

  // Classes of admission grouped the way DHS summarizes them.
  const LPR_GROUPS: [string, string, string[]][] = [
    ["family", "Family", ["immediate-relatives-of-u-s-citizens", "family-sponsored-preferences"]],
    ["employment", "Employment", ["employment-based-preferences"]],
    ["humanitarian", "Refugees, asylees, and parolees", ["refugees", "asylees", "parolees"]],
    ["diversity", "Diversity lottery", ["diversity"]],
    ["other", "All other", ["cancellation-of-removal", "certain-iraqis-and-afghans-employed-by-u-s-government-and-their-spouses-and-children", "children-born-abroad-to-noncitizen-residents", "other", "victims-of-crimes-and-their-immediate-relatives", "victims-of-human-trafficking"]],
  ];
  const lprGroupSeries = (codes: string[]) => addSeries(...codes.map((c) => lprClassSeries[c] ?? []));
  const lprGroups = (period: string) =>
    Object.fromEntries(LPR_GROUPS.map(([key, , codes]) => [key, lprGroupSeries(codes).find((p) => p.period === period)?.value ?? 0]));

  // ------------------------------------------------------------ Temporary
  const [i94, allAdmissions, nonimmByClassAll] = await Promise.all([
    getSeries("dhs-yearbook", "nonimmigrant_i94_admissions"),
    getSeries("dhs-yearbook", "nonimmigrant_admissions_total"),
    getSeriesByGeo("dhs-yearbook", "nonimmigrant_by_class", "class"),
  ]);
  const classAt = (code: string, period: string) => nonimmByClassAll[code]?.find((p) => p.period === period)?.value ?? 0;
  const tempPeriod = last(i94)?.period ?? "";
  const groupTotal = (codes: string[], period: string) => codes.reduce((t, c) => t + classAt(c, period), 0);
  const tempGroups = NONIMMIGRANT_GROUPS.map(([label, codes]) => ({ label, value: groupTotal(codes, tempPeriod) })).sort((a, b) => b.value - a.value);
  const groupSeries = (name: string) => {
    const codes = NONIMMIGRANT_GROUPS.find(([l]) => l === name)![1];
    return i94.map((p) => ({ period: p.period, periodStart: p.periodStart, value: groupTotal(codes, p.period) }));
  };

  // ---------------------------------------------------------- Humanitarian
  const [refugees, asylum, refugeesByCountry, asylumByCountry] = await Promise.all([
    getSeries("dhs-yearbook", "refugee_arrivals"),
    getSeriesMany("dhs-yearbook", ["asylum_grants_total", "asylum_grants_affirmative", "asylum_grants_defensive"]),
    getCrossSection("dhs-yearbook", "refugee_arrivals_by_country", "country"),
    getCrossSection("dhs-yearbook", "asylum_affirmative_by_country", "country"),
  ]);

  // ---------------------------------------------------------- Unauthorized
  const [unauth, unauthByCountry, unauthByState, unauthByEntry] = await Promise.all([
    getSeries("dhs-unauthorized", "unauthorized_population"),
    getCrossSection("dhs-unauthorized", "unauthorized_by_country", "country"),
    getCrossSection("dhs-unauthorized", "unauthorized_by_state", "state"),
    getCrossSection("dhs-unauthorized", "unauthorized_by_entry_period", "entry_period"),
  ]);

  // ------------------------------------------------------------ Population
  const [netMigration, naturalChange, population, acs, fbByCountry, fbByRegion, censusShare] = await Promise.all([
    getSeries("census-pep", "international_migration"),
    getSeries("census-pep", "natural_change"),
    getSeries("census-pep", "population"),
    getSeriesMany("census-acs1-immigration", ["foreign_born", "foreign_born_share", "naturalized", "noncitizen"]),
    getCrossSection("census-acs1-immigration", "foreign_born_by_country", "country", { geoidPrefix: "US:" }),
    getCrossSection("census-acs1-immigration", "foreign_born_by_region", "region", { geoidPrefix: "US:" }),
    getSeries("census-historical-nativity", "foreign_born_share"),
  ]);
  // Foreign-born share since 1850: decennial censuses, then the ACS.
  const lastCensus = censusShare.at(-1)?.period ?? "";
  const longRun: ChartPoint[] = [
    ...censusShare.map((p) => ({
      x: Number(p.period),
      label: Number(p.period) <= 1860 ? `${p.period} census (free population)` : `${p.period} census`,
      value: p.value,
    })),
    ...acs.foreign_born_share.filter((p) => p.period > lastCensus).map((p) => ({ x: Number(p.period), label: `${p.period} survey`, value: p.value })),
  ];
  const growthYears = new Set(naturalChange.map((p) => p.period));

  // ----------------------------------------------------------- Enforcement
  const [repatriations, removalsByStatus, removalsByCountry, detention, facilities, facilityAlos] = await Promise.all([
    getSeriesMany("dhs-yearbook", ["removals", "returns_administrative", "returns_enforcement", "expulsions_title_42"]),
    getSeriesMany("dhs-yearbook", ["removals_criminal", "removals_noncriminal"]),
    getCrossSection("dhs-yearbook", "removals_by_country", "country"),
    getSeriesMany("ice-detention", ["detained_adp", "detained_adp_convicted", "detained_adp_no_conviction", "detained_adp_mandatory"]),
    getCrossSection("ice-detention", "detained_adp", "facility"),
    getCrossSection("ice-detention", "facility_alos", "facility"),
  ]);
  const alos = new Map(facilityAlos.values.map((v) => [v.geoid, v.value]));

  // ------------------------------------------- OHSS monthly and EOIR courts
  // OHSS monthly tables, rolled up to fiscal years. A year counts only when
  // the tables cover all of it; series that start or stop mid-year (Title 42,
  // MPP) keep their partial years inside that window.
  const OHSS = {
    bookouts: [
      "swb_bookouts_usbp_t8_repatriations",
      "swb_bookouts_usbp_t42_expulsions",
      "swb_bookouts_usbp_transfers_to_ice",
      "swb_bookouts_usbp_transfers_to_hhs",
      "swb_bookouts_usbp_usbp_releases",
      "swb_bookouts_usbp_migrant_protection_protocols",
      "swb_bookouts_usbp_other_outcomes",
    ],
    ports: ["swb_bookouts_ofo_paroles", "cbp_one_total", "chnv_paroles_total"],
    cbpOne: ["cbp_one_colombia", "cbp_one_cuba", "cbp_one_ecuador", "cbp_one_el_salvador", "cbp_one_guatemala", "cbp_one_haiti", "cbp_one_honduras", "cbp_one_mexico", "cbp_one_russia", "cbp_one_venezuela", "cbp_one_other"],
    fear: ["credible_fear_positive_fear", "credible_fear_negative_fear", "credible_fear_administrative_closure"],
    arrests: ["ero_arrests_convicted_criminals_total_convicted", "ero_arrests_pending_criminal_charges", "ero_arrests_other_immigration_violators", "ero_arrests_non_criminal_total_non_criminal", "ero_arrests_total"],
    bookins: ["ice_bookins_by_arrester_border", "ice_bookins_by_arrester_interior"],
    repatriations: [
      "dhs_repatriations_dhs_removals_expedited_removals",
      "dhs_repatriations_dhs_removals_reinstatements_of_removal_orders",
      "dhs_repatriations_dhs_removals_other_removals",
      "dhs_repatriations_dhs_enforcement_returns_voluntary_departures",
      "dhs_repatriations_dhs_enforcement_returns_voluntary_returns",
      "dhs_repatriations_dhs_enforcement_returns_withdrawals",
      "dhs_repatriations_dhs_enforcement_returns_other_enforcement_returns",
      "dhs_repatriations_dhs_administrative_returns_total_administrative_returns",
      "dhs_repatriations_total_repatriations_title_42_expulsions",
    ],
  };
  const [ohss, eoir] = await Promise.all([
    getSeriesMany("ohss-enforcement", Object.values(OHSS).flat()),
    getSeriesMany("eoir", [
      "pending_cases",
      "initial_receipts",
      "total_completions",
      "asylum_grants",
      "asylum_denials",
      "asylum_abandoned",
      "asylum_withdrawn",
      "asylum_admin_closure",
      "asylum_not_adjudicated",
      "asylum_grant_rate",
      "asylum_grant_rate_all",
      "asylum_filed",
      "asylum_filed_affirmative",
      "asylum_filed_defensive",
    ]),
  ]);
  // USCIS workloads, refugee ceilings, overstays, LPR population, court outcomes.
  const USCIS_FORMS = ["i129", "i130", "i140", "i485", "i539"];
  const [uscis, i485ByCategory, wraps, overstays, overstaysByType, lprPop, lprPopByCountry, lprPopByState, lprPopByClass, outcomes] =
    await Promise.all([
      getSeriesMany("uscis-forms", USCIS_FORMS.flatMap((f) => ["received", "approved", "denied", "pending"].map((st) => `uscis_${f}_${st}`))),
      getCrossSection("uscis-forms", "uscis_i485_pending", "category"),
      getSeriesMany("wraps-refugees", ["refugee_ceiling", "refugee_admissions"]),
      getSeriesMany("dhs-overstays", ["overstay_in_country", "overstay_in_country_rate", "overstay_expected_departures"]),
      getSeriesByGeo("dhs-overstays", "overstay_in_country", "admission_type"),
      getSeriesMany("ohss-lpr-population", ["lpr_population", "lpr_eligible_to_naturalize"]),
      getCrossSection("ohss-lpr-population", "lpr_population", "country"),
      getCrossSection("ohss-lpr-population", "lpr_population", "state"),
      getCrossSection("ohss-lpr-population", "lpr_population", "class"),
      getSeriesMany("eoir", ["removal_orders", "removal_orders_in_absentia", "decisions_relief", "decisions_voluntary_departure", "decisions_termination"]),
    ]);
  const fyOnly = (points: Point[]) => points.filter((p) => p.period.startsWith("FY"));
  // "Other" and "Unknown" rows go last, not by rank.
  const rankedLast = (values: AreaValue[]) =>
    [...named(values)].sort((a, b) => Number(/^(Other|Unknown|ACS- Unknown)$/.test(a.label)) - Number(/^(Other|Unknown|ACS- Unknown)$/.test(b.label)) || b.value - a.value);

  const ohssYears = new Set(fiscalYearTotals(ohss.ero_arrests_total ?? []).map((p) => p.period));
  const fy = (metric: string) => fiscalYearTotals(ohss[metric] ?? [], { partial: true }).filter((p) => ohssYears.has(p.period));
  const fyPoints = (metric: string) => toChartPoints(fy(metric));
  const sumAll = (metric: string) => (ohss[metric] ?? []).reduce((t, p) => t + p.value, 0);
  // EOIR's current fiscal year is partial; charts of yearly counts stop at the last full year.
  const eoirFull = (metric: string) => eoir[metric]?.filter((p) => !isPartial(p)) ?? [];

  // ---------------------------------------------------------------- States
  const [pepByState, pepRateByState, fbShareByState, fbByState, detentionByState] = await Promise.all([
    getCrossSection("census-pep", "international_migration", "state"),
    getCrossSection("census-pep", "international_migration_rate", "state"),
    getCrossSection("census-acs1-immigration", "foreign_born_share", "state"),
    getCrossSection("census-acs1-immigration", "foreign_born", "state"),
    getCrossSection("ice-detention", "detained_adp", "state"),
  ]);

  // ----------------------------------------------- Related: between states
  const [domByState, domRateByState, domSeriesByState, flows, inflowByState, outflowByState, fromAbroadByState, interstate] =
    await Promise.all([
      getCrossSection("census-pep", "domestic_migration", "state"),
      getCrossSection("census-pep", "domestic_migration_rate", "state"),
      getSeriesByGeo("census-pep", "domestic_migration", "state"),
      getCrossSection("census-state-migration", "state_to_state", "flow"),
      getCrossSection("census-state-migration", "state_inflow", "state"),
      getCrossSection("census-state-migration", "state_outflow", "state"),
      getCrossSection("census-state-migration", "moved_from_abroad", "state"),
      getSeries("census-state-migration", "state_inflow"),
    ]);

  // ------------------------------------------ Related: Americans abroad
  const [emigrants, emigByCountry, emigByRegion] = await Promise.all([
    getSeries("un-migrant-stock", "emigrants_total"),
    getCrossSection("un-migrant-stock", "emigrants_by_country", "country"),
    getCrossSection("un-migrant-stock", "emigrants_by_region", "region"),
  ]);

  // Population estimates are filed under demographics but supply this page's
  // net international and domestic migration.
  const datasets = [
    ...(await listDatasets({ topic: "immigration" })),
    ...(await listDatasets({ topic: "demographics" })).filter((d) => d.slug === "census-pep"),
  ];
  const coverage = await datasetCoverage(datasets.map((d) => d.slug));

  // ------------------------------------------------------------ Headlines
  const lastEnc = last(encounters);
  const encYearAgo = lastMonth ? valueAt(encounters, shiftMonth(lastMonth, -12)) : null;
  const enc12 = trailingSum(encounters, 12);
  const encPrior12 = trailingSum(encounters, 12, encounters.length - 13);
  const fb = acs.foreign_born;
  const det = detention.detained_adp;
  const lastLpr = last(lpr);
  const lastAdj = last(lprComponents.lpr_adjustments);
  const lastUnauth = last(unauth);
  const popAt = (year: string) => population.find((p) => p.period === year)?.value ?? null;
  const fbAt = (year: string) => fb.find((p) => p.period === year)?.value ?? null;
  const removals = repatriations.removals;
  const mandatory = last(detention.detained_adp_mandatory);

  const stats = {
    encounters: lastEnc && {
      value: lastEnc.value,
      period: lastEnc.period,
      change: pctChange(lastEnc.value, encYearAgo),
      compare: `vs ${lastMonth ? formatPeriod(shiftMonth(lastMonth, -12)) : ""}`,
      spark: encounters.slice(-24).map((p) => p.value),
    },
    encounters12:
      enc12 === null
        ? null
        : {
            value: enc12,
            change: pctChange(enc12, encPrior12),
            usbpShare: enc12 && usbp12[0] ? (usbp12[0].value / enc12) * 100 : null,
            ofoShare: enc12 && ofo12[0] ? (ofo12[0].value / enc12) * 100 : null,
          },
    peakMonth: encounters.length ? encounters.reduce((a, b) => (b.value > a.value ? b : a)) : null,
    lpr: lastLpr && {
      value: lastLpr.value,
      period: lastLpr.period,
      change: pctChange(lastLpr.value, prev(lpr)?.value),
      compare: `vs ${prev(lpr) ? formatPeriod(prev(lpr)!.period) : ""}`,
      spark: lpr.slice(-15).map((p) => p.value),
      adjustmentShare: lastAdj && lastLpr ? (lastAdj.value / lastLpr.value) * 100 : null,
    },
    naturalizations: last(naturalizations) && {
      value: last(naturalizations)!.value,
      period: last(naturalizations)!.period,
      change: pctChange(last(naturalizations)!.value, prev(naturalizations)?.value),
      compare: `vs ${prev(naturalizations) ? formatPeriod(prev(naturalizations)!.period) : ""}`,
      spark: naturalizations.slice(-15).map((p) => p.value),
    },
    netMigration: last(netMigration) && {
      value: last(netMigration)!.value,
      period: last(netMigration)!.period,
      change: pctChange(last(netMigration)!.value, prev(netMigration)?.value),
      compare: `vs ${prev(netMigration)?.period ?? ""}`,
      spark: netMigration.map((p) => p.value),
      periods: netMigration.map((p) => p.period),
    },
    naturalChange: last(naturalChange) && {
      value: last(naturalChange)!.value,
      period: last(naturalChange)!.period,
    },
    foreignBorn: last(fb) && {
      value: last(fb)!.value,
      period: last(fb)!.period,
      share: last(acs.foreign_born_share)?.value ?? null,
      naturalizedShare: last(natzShare)?.value ?? null,
      change: pctChange(last(fb)!.value, prev(fb)?.value),
      compare: `vs ${prev(fb)?.period ?? ""}`,
      spark: fb.map((p) => p.value),
    },
    unauthorized: lastUnauth && {
      value: lastUnauth.value,
      period: lastUnauth.period,
      shareOfPopulation: popAt(lastUnauth.period) ? (lastUnauth.value / popAt(lastUnauth.period)!) * 100 : null,
      shareOfForeignBorn: fbAt(lastUnauth.period) ? (lastUnauth.value / fbAt(lastUnauth.period)!) * 100 : null,
      spark: unauth.map((p) => p.value),
    },
    temporary: last(i94) && {
      value: last(i94)!.value,
      period: last(i94)!.period,
      all: last(allAdmissions)?.value ?? null,
      change: pctChange(last(i94)!.value, prev(i94)?.value),
      compare: `vs ${prev(i94) ? formatPeriod(prev(i94)!.period) : ""}`,
      spark: i94.map((p) => p.value),
    },
    refugees: last(refugees) && {
      value: last(refugees)!.value,
      period: last(refugees)!.period,
      change: pctChange(last(refugees)!.value, prev(refugees)?.value),
      compare: `vs ${prev(refugees) ? formatPeriod(prev(refugees)!.period) : ""}`,
      spark: refugees.slice(-15).map((p) => p.value),
    },
    asylum: last(asylum.asylum_grants_total) && {
      value: last(asylum.asylum_grants_total)!.value,
      period: last(asylum.asylum_grants_total)!.period,
      change: pctChange(last(asylum.asylum_grants_total)!.value, prev(asylum.asylum_grants_total)?.value),
      compare: `vs ${prev(asylum.asylum_grants_total) ? formatPeriod(prev(asylum.asylum_grants_total)!.period) : ""}`,
      spark: asylum.asylum_grants_total.slice(-15).map((p) => p.value),
    },
    removals: last(removals) && {
      value: last(removals)!.value,
      period: last(removals)!.period,
      change: pctChange(last(removals)!.value, prev(removals)?.value),
      compare: `vs ${prev(removals) ? formatPeriod(prev(removals)!.period) : ""}`,
      spark: removals.slice(-15).map((p) => p.value),
    },
    detention: last(det) && {
      value: last(det)!.value,
      period: last(det)!.period,
      change: pctChange(last(det)!.value, prev(det)?.value),
      compare: `vs ${prev(det) ? formatPeriod(prev(det)!.period) : ""}`,
      spark: det.map((p) => p.value),
      mandatoryShare: mandatory && last(det) ? (mandatory.value / last(det)!.value) * 100 : null,
      noConvictionShare:
        last(detention.detained_adp_no_conviction) && last(det) ? (last(detention.detained_adp_no_conviction)!.value / last(det)!.value) * 100 : null,
    },
  };

  const lastFull = (points: Point[]) => {
    const full = points.filter((p) => !isPartial(p));
    const cur = last(full);
    const before = prev(full);
    return cur && { value: cur.value, period: cur.period, change: pctChange(cur.value, before?.value), compare: `vs ${before ? formatPeriod(before.period) : ""}` };
  };
  // A partial year's stock is "as of" its last reported month.
  const asOf = (p: Point) => ({ period: p.period, through: typeof p.metadata?.through === "string" ? p.metadata.through : null });
  const lastFy = (metric: string) => {
    const p = fy(metric);
    return last(p) && { value: last(p)!.value, period: last(p)!.period, change: pctChange(last(p)!.value, prev(p)?.value), compare: `vs ${prev(p) ? formatPeriod(prev(p)!.period) : ""}` };
  };
  const fearFy = OHSS.fear.map(fy);
  const lastFear = fearFy.map((p) => last(p)?.value ?? 0);
  const lastAff = last(asylum.asylum_grants_affirmative);
  const lastDef = last(asylum.asylum_grants_defensive);
  const lastRef = last(refugees);
  const protectionPeriod = [lastAff, lastDef, lastRef].every((p) => p && p.period === lastRef!.period) ? lastRef!.period : null;
  const repatFy = (metrics: string[]) => metrics.map(lastFy).reduce((t, x) => t + (x?.value ?? 0), 0);
  const extra = {
    usbp12: enc12 && usbp12[0] ? { value: usbp12[0].value, share: (usbp12[0].value / enc12) * 100 } : null,
    ofo12: enc12 && ofo12[0] ? { value: ofo12[0].value, share: (ofo12[0].value / enc12) * 100 } : null,
    adjustments: lastAdj && lastLpr && lastAdj.period === lastLpr.period ? { value: lastAdj.value, period: lastAdj.period, share: (lastAdj.value / lastLpr.value) * 100 } : null,
    courts: lastFull(eoir.pending_cases) && { ...lastFull(eoir.pending_cases)!, latest: last(eoir.pending_cases) },
    asylumCourt: lastFull(eoir.asylum_grant_rate) && {
      ...lastFull(eoir.asylum_grant_rate)!,
      grants: eoir.asylum_grants.find((p) => p.period === lastFull(eoir.asylum_grant_rate)!.period)?.value ?? null,
      latest: last(eoir.asylum_grant_rate),
    },
    credibleFear: last(fearFy[0]) && {
      period: last(fearFy[0])!.period,
      total: lastFear.reduce((a, b) => a + b, 0),
      positiveShare: lastFear[0] + lastFear[1] ? (lastFear[0] / (lastFear[0] + lastFear[1])) * 100 : null,
    },
    asylumFiled: lastFull(eoir.asylum_filed),
    arrests: lastFy("ero_arrests_total"),
    voluntaryDeparture: lastFy("dhs_repatriations_dhs_enforcement_returns_voluntary_departures"),
    returns: lastFy("dhs_repatriations_dhs_enforcement_returns_voluntary_returns") && {
      period: lastFy("dhs_repatriations_dhs_enforcement_returns_voluntary_returns")!.period,
      value: repatFy([
        "dhs_repatriations_dhs_enforcement_returns_voluntary_returns",
        "dhs_repatriations_dhs_enforcement_returns_withdrawals",
        "dhs_repatriations_dhs_enforcement_returns_other_enforcement_returns",
        "dhs_repatriations_dhs_administrative_returns_total_administrative_returns",
        "dhs_repatriations_total_repatriations_title_42_expulsions",
      ]),
    },
    protection: protectionPeriod ? { period: protectionPeriod, value: lastRef!.value + lastAff!.value + lastDef!.value } : null,
    petitions: last(uscis.uscis_i130_pending) && {
      value: last(uscis.uscis_i130_pending)!.value + (last(uscis.uscis_i140_pending)?.value ?? 0),
      family: last(uscis.uscis_i130_pending)!.value,
      employment: last(uscis.uscis_i140_pending)?.value ?? null,
      ...asOf(last(uscis.uscis_i130_pending)!),
    },
    adjustment: last(uscis.uscis_i485_pending) && { value: last(uscis.uscis_i485_pending)!.value, ...asOf(last(uscis.uscis_i485_pending)!) },
    changeStatus: lastFull(uscis.uscis_i539_received),
    extensions: lastFull(uscis.uscis_i539_approved) && {
      ...lastFull(uscis.uscis_i539_approved)!,
      denied: uscis.uscis_i539_denied.find((p) => p.period === lastFull(uscis.uscis_i539_approved)!.period)?.value ?? null,
    },
    newArrivals: last(lprComponents.lpr_new_arrivals) && {
      value: last(lprComponents.lpr_new_arrivals)!.value,
      period: last(lprComponents.lpr_new_arrivals)!.period,
      change: pctChange(last(lprComponents.lpr_new_arrivals)!.value, prev(lprComponents.lpr_new_arrivals)?.value),
      compare: `vs ${prev(lprComponents.lpr_new_arrivals) ? formatPeriod(prev(lprComponents.lpr_new_arrivals)!.period) : ""}`,
    },
    refugeeCeiling: last(wraps.refugee_ceiling) && {
      period: last(wraps.refugee_ceiling)!.period,
      ceiling: last(wraps.refugee_ceiling)!.value,
      admitted: fyOnly(wraps.refugee_admissions).find((p) => p.period === last(wraps.refugee_ceiling)!.period)?.value ?? null,
    },
    overstays: last(overstays.overstay_in_country) && {
      ...lastFull(overstays.overstay_in_country)!,
      rate: last(overstays.overstay_in_country_rate)?.value ?? null,
      expected: last(overstays.overstay_expected_departures)?.value ?? null,
    },
    lprPopulation: last(lprPop.lpr_population) && {
      value: last(lprPop.lpr_population)!.value,
      period: last(lprPop.lpr_population)!.period,
      eligible: last(lprPop.lpr_eligible_to_naturalize)?.value ?? null,
    },
    courtOutcomes: last(outcomes.decisions_relief) && {
      period: last(outcomes.decisions_relief)!.period,
      relief: last(outcomes.decisions_relief)!.value,
      voluntaryDeparture: last(outcomes.decisions_voluntary_departure)?.value ?? null,
      termination: last(outcomes.decisions_termination)?.value ?? null,
    },
    lprClass: lprByClass.period ? { period: lprByClass.period, family: lprGroups(lprByClass.period).family, total: lastLpr?.period === lprByClass.period ? lastLpr.value : null } : null,
  };

  // --------------------------------------------------------- State explorer
  const byGeo = (values: { geoid: string; value: number }[]) => new Map(values.map((v) => [v.geoid, v.value]));
  const maps: Record<string, Map<string, number>> = {
    fb: byGeo(fbShareByState.values),
    fbCount: byGeo(fbByState.values),
    intl: byGeo(pepByState.values),
    intlRate: byGeo(pepRateByState.values),
    abroad: byGeo(fromAbroadByState.values),
    lpr: byGeo(lprByState.values),
    natz: byGeo(natzByState.values),
    enc: byGeo(encountersByState),
    det: byGeo(detentionByState.values),
    dom: byGeo(domByState.values),
    domRate: byGeo(domRateByState.values),
  };
  const stateMetrics = [
    { key: "fb", group: "Population", label: "Foreign-born share", unit: "percent", period: fbShareByState.period ?? "", source: "Census ACS",
      description: "Share of residents who were not U.S. citizens at birth, any legal status." },
    { key: "fbCount", group: "Population", label: "Foreign-born residents", unit: "people", period: fbByState.period ?? "", source: "Census ACS",
      description: "Residents born abroad, any legal status — a population (stock), not yearly arrivals." },
    { key: "intl", group: "Population", label: "Net international migration", unit: "people", period: `Year to July 1, ${pepByState.period ?? ""}`, source: "Census PEP",
      description: "People moving in from abroad minus people moving abroad, citizens included." },
    { key: "intlRate", group: "Population", label: "Net international migration per 1,000", unit: "per_1000", period: `Year to July 1, ${pepRateByState.period ?? ""}`, source: "Census PEP",
      description: "The same, per 1,000 residents — comparable between large and small states." },
    { key: "abroad", group: "Population", label: "Residents who lived abroad a year earlier", unit: "people", period: fromAbroadByState.period ?? "", source: "Census ACS",
      description: "Includes returning U.S. citizens and service members." },
    { key: "lpr", group: "Legal immigration", label: "New green cards", unit: "people", period: formatPeriod(lprByState.period ?? ""), source: "DHS Yearbook",
      description: "New lawful permanent residents by state of residence." },
    { key: "natz", group: "Legal immigration", label: "Naturalizations", unit: "people", period: formatPeriod(natzByState.period ?? ""), source: "DHS Yearbook",
      description: "New citizens by state of residence." },
    { key: "enc", group: "Enforcement", label: "Border encounters recorded", unit: "encounters", period: "Last 12 months", source: "CBP",
      description: "Encounters recorded by CBP offices in the state — not where the people live or went." },
    { key: "det", group: "Enforcement", label: "ICE detention (avg. daily)", unit: "people", period: formatPeriod(detentionByState.period ?? ""), source: "ICE",
      description: "Average daily population of ICE detention facilities located in the state." },
    { key: "dom", group: "Related: moves between states", label: "Net domestic migration", unit: "people", period: `Year to July 1, ${domByState.period ?? ""}`, source: "Census PEP",
      description: "Moves in from other states minus moves out to other states. Not immigration." },
    { key: "domRate", group: "Related: moves between states", label: "Net domestic migration per 1,000", unit: "per_1000", period: `Year to July 1, ${domRateByState.period ?? ""}`, source: "Census PEP",
      description: "The same, per 1,000 residents." },
  ].filter((m) => maps[m.key].size);

  const in51 = new Set(STATES_51.map((s) => s.fips));
  const inflows = byGeo(inflowByState.values);
  const outflows = byGeo(outflowByState.values);
  const flowPairs = flows.values.map((f) => {
    const [dest, origin] = f.geoid.split(":");
    return { dest, origin, value: f.value };
  });
  const stateRows = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(stateMetrics.map((m) => [m.key, maps[m.key].get(s.fips) ?? null])),
  }));

  const single = (id: string, label: string, points: ChartPoint[], slot: 1 | 2 | 3 = 1) => [{ id, label, slot, points }];

  const office = (sector: boolean) =>
    encountersByAor
      .filter((r) => /Sector$/.test(r.geoName ?? r.geoid) === sector)
      .map((r) => ({ label: r.geoName ?? r.geoid, value: r.value }));
  const regionAgency = (agency: "usbp" | "ofo") =>
    Object.fromEntries(Object.entries(borderSeries).map(([key, v]) => [key, v.agency.filter((x) => x.id === agency)]));
  const ohssSeries = (rows: [string, string, number][]) =>
    rows.map(([metric, label, slot]) => ({ id: metric, label, slot: slot as SeriesSlot, points: fyPoints(metric) })).filter((x) => x.points.some((p) => p.value));

  return {
    stats: { ...stats, ...extra },
    border: {
      lastMonth,
      regions: REGIONS.map(({ key, label, subtitle }) => ({ key, label, subtitle })),
      series: borderSeries,
      byCitizenship: byCitizenship.map((r) => ({ label: tidyLabel(r.geoName ?? r.geoid), value: r.value })),
      byState: encountersByState.filter((r) => FIPS_TO_ABBR[r.geoid]).map((r) => ({ label: stateName(r.geoid), value: r.value })),
      byOffice: encountersByAor.map((r) => {
        const name = r.geoName ?? r.geoid;
        return { label: name, value: r.value, note: /Sector$/.test(name) ? "Border Patrol sector" : "Field Operations office" };
      }),
    },
    legal: {
      lprHistory: single("lpr", "New lawful permanent residents", toChartPoints(lpr)),
      lprSplit: [
        { id: "adj", label: "Already in the U.S. (adjusted status)", slot: 1 as const, points: toChartPoints(lprComponents.lpr_adjustments) },
        { id: "new", label: "Arrived from abroad with an immigrant visa", slot: 3 as const, points: toChartPoints(lprComponents.lpr_new_arrivals) },
      ],
      pathways: { period: lprByClass.period ?? "", items: pathways },
      byCountry: { period: lprByCountry.period ?? "", items: named(lprByCountry.values) },
      naturalizations: [
        { id: "filed", label: "Applications filed", slot: 2 as const, points: toChartPoints(natzApps) },
        { id: "natz", label: "People naturalized", slot: 1 as const, points: toChartPoints(naturalizations) },
      ],
      natzByCountry: { period: natzByCountry.period ?? "", items: named(natzByCountry.values) },
      naturalizedShare: single("ns", "Naturalized share of the foreign-born", toChartPoints(natzShare)),
    },
    temporary: {
      period: tempPeriod,
      i94: single("i94", "I-94 admissions", toChartPoints(i94)),
      groups: tempGroups,
      purpose: [
        { id: "work", label: "Temporary workers & trainees", slot: 1 as const, points: toChartPoints(groupSeries("Temporary workers & trainees")) },
        { id: "students", label: "Students", slot: 2 as const, points: toChartPoints(groupSeries("Students")) },
        { id: "exchange", label: "Exchange visitors", slot: 3 as const, points: toChartPoints(groupSeries("Exchange visitors")) },
      ],
      workVisas: WORK_VISAS.map(([code, label]) => ({ label, value: classAt(code, tempPeriod) }))
        .filter((v) => v.value)
        .sort((a, b) => b.value - a.value),
    },
    humanitarian: {
      refugees: single("ref", "Refugee arrivals", toChartPoints(refugees)),
      asylum: [
        { id: "aff", label: "Affirmative (USCIS asylum officers)", slot: 1 as const, points: toChartPoints(asylum.asylum_grants_affirmative) },
        { id: "def", label: "Defensive (immigration judges)", slot: 2 as const, points: toChartPoints(asylum.asylum_grants_defensive) },
      ],
      refugeesByCountry: { period: refugeesByCountry.period ?? "", items: named(refugeesByCountry.values) },
      asylumByCountry: { period: asylumByCountry.period ?? "", items: named(asylumByCountry.values) },
    },
    unauthorized: {
      series: single("ua", "Unauthorized immigrant population", toChartPoints(unauth)),
      // "All other countries" goes last, not by rank.
      byCountry: {
        period: unauthByCountry.period ?? "",
        items: [...named(unauthByCountry.values.filter((v) => v.geoid !== "all-other-countries")), ...named(unauthByCountry.values.filter((v) => v.geoid === "all-other-countries"))],
      },
      byState: {
        period: unauthByState.period ?? "",
        items: named(unauthByState.values),
        other: lastUnauth ? lastUnauth.value - unauthByState.values.reduce((t, v) => t + v.value, 0) : null,
      },
      byEntry: {
        period: unauthByEntry.period ?? "",
        // Chronological, not ranked.
        items: named(unauthByEntry.values).sort((a, b) => a.label.localeCompare(b.label)),
      },
    },
    population: {
      foreignBorn: [
        { id: "nat", label: "Naturalized U.S. citizens", slot: 1 as const, points: toChartPoints(acs.naturalized) },
        { id: "non", label: "Not U.S. citizens", slot: 2 as const, points: toChartPoints(acs.noncitizen) },
      ],
      foreignBornShare: single("fbs", "Foreign-born share", toChartPoints(acs.foreign_born_share)),
      longRun: single("fbs-long", "Foreign-born share", longRun),
      byCountry: { period: fbByCountry.period ?? "", items: named(fbByCountry.values) },
      byRegion: { period: fbByRegion.period ?? "", items: named(fbByRegion.values) },
      netMigration: single("nim", "Net international migration", toChartPoints(netMigration)),
      growth: [
        { id: "natural", label: "Natural increase (births minus deaths)", slot: 3 as const, points: toChartPoints(naturalChange) },
        { id: "nim", label: "Net international migration", slot: 1 as const, points: toChartPoints(netMigration.filter((p) => growthYears.has(p.period))) },
      ],
    },
    enforcement: {
      repatriations: [
        { id: "removals", label: "Removals", slot: 1 as const, points: toChartPoints(removals) },
        { id: "returns", label: "Returns", slot: 3 as const, points: toChartPoints(addSeries(repatriations.returns_administrative, repatriations.returns_enforcement)) },
        { id: "t42", label: "Title 42 expulsions", slot: 2 as const, points: toChartPoints(repatriations.expulsions_title_42) },
      ],
      removalsByStatus: [
        { id: "crim", label: "Known criminal conviction", slot: 2 as const, points: toChartPoints(removalsByStatus.removals_criminal) },
        { id: "non", label: "No known criminal conviction", slot: 1 as const, points: toChartPoints(removalsByStatus.removals_noncriminal) },
      ],
      removalsByCountry: { period: removalsByCountry.period ?? "", items: named(removalsByCountry.values) },
      detention: [
        { id: "none", label: "No criminal conviction", slot: 1 as const, points: toChartPoints(detention.detained_adp_no_conviction) },
        { id: "conv", label: "Criminal conviction", slot: 2 as const, points: toChartPoints(detention.detained_adp_convicted) },
      ],
      facilities: {
        period: facilities.period ?? "",
        items: facilities.values.map((r) => {
          const stay = alos.get(r.geoid);
          const where = [tidyLabel(String(r.metadata?.city ?? "")), FIPS_TO_ABBR[String(r.metadata?.state ?? "")]].filter(Boolean).join(", ");
          return {
            label: tidyLabel(r.geoName ?? r.geoid),
            value: r.value,
            note: [where, stay ? `avg. stay ${Math.round(stay)} days` : ""].filter(Boolean).join(" · "),
          };
        }),
      },
    },
    ports: {
      byRegion: regionAgency("ofo"),
      offices: office(false),
      paroles: ohssSeries([["swb_bookouts_ofo_paroles", "Paroled at southwest border ports", 3]]),
      cbpOne: single("cbp1", "CBP One appointments", toChartPoints(ohss.cbp_one_total)),
      cbpOneByCountry: OHSS.cbpOne
        .map((m) => ({ label: m === "cbp_one_other" ? "All other nationalities" : tidyLabel(m.replace("cbp_one_", "").replace(/_/g, " ")), value: sumAll(m), other: m === "cbp_one_other" }))
        .filter((x) => x.value)
        .sort((a, b) => Number(a.other) - Number(b.other) || b.value - a.value)
        .map(({ label, value }) => ({ label, value })),
      cbpOneRange: ohss.cbp_one_total.length ? `${formatPeriod(ohss.cbp_one_total[0].period)} – ${formatPeriod(ohss.cbp_one_total.at(-1)!.period)}` : "",
    },
    between: {
      byRegion: regionAgency("usbp"),
      sectors: office(true),
      bookouts: ohssSeries([
        ["swb_bookouts_usbp_t8_repatriations", "Returned or removed (Title 8)", 1],
        ["swb_bookouts_usbp_t42_expulsions", "Expelled (Title 42)", 2],
        ["swb_bookouts_usbp_transfers_to_ice", "Transferred to ICE custody", 5],
        ["swb_bookouts_usbp_transfers_to_hhs", "Unaccompanied children to HHS", 4],
        ["swb_bookouts_usbp_usbp_releases", "Released by Border Patrol", 3],
        ["swb_bookouts_usbp_migrant_protection_protocols", "Returned to Mexico to await court (MPP)", 6],
        ["swb_bookouts_usbp_other_outcomes", "Other outcomes", 7],
      ]),
    },
    courts: {
      caseload: [
        { id: "pending", label: "Cases pending (end of year)", slot: 1 as const, points: toChartPoints(eoir.pending_cases.filter((p) => !isPartial(p))) },
      ],
      flow: [
        { id: "receipts", label: "New cases received", slot: 2 as const, points: toChartPoints(eoirFull("initial_receipts")) },
        { id: "completions", label: "Cases completed", slot: 3 as const, points: toChartPoints(eoirFull("total_completions")) },
      ],
      asylumDecisions: [
        { id: "grants", label: "Granted", slot: 1 as const, points: toChartPoints(eoirFull("asylum_grants")) },
        { id: "denials", label: "Denied", slot: 2 as const, points: toChartPoints(eoirFull("asylum_denials")) },
        { id: "abandoned", label: "Abandoned", slot: 4 as const, points: toChartPoints(eoirFull("asylum_abandoned")) },
        { id: "withdrawn", label: "Withdrawn", slot: 5 as const, points: toChartPoints(eoirFull("asylum_withdrawn")) },
        { id: "closed", label: "Administratively closed", slot: 6 as const, points: toChartPoints(eoirFull("asylum_admin_closure")) },
        { id: "other", label: "Closed without a decision on the application", slot: 7 as const, points: toChartPoints(eoirFull("asylum_not_adjudicated")) },
      ],
      grantRates: [
        { id: "decided", label: "Of grants and denials", slot: 1 as const, points: toChartPoints(eoirFull("asylum_grant_rate")) },
        { id: "all", label: "Of every asylum completion", slot: 3 as const, points: toChartPoints(eoirFull("asylum_grant_rate_all")) },
      ],
      asylumFiled: [
        { id: "aff", label: "Referred by USCIS (affirmative)", slot: 1 as const, points: toChartPoints(eoirFull("asylum_filed_affirmative")) },
        { id: "def", label: "Filed in removal proceedings (defensive)", slot: 2 as const, points: toChartPoints(eoirFull("asylum_filed_defensive")) },
      ],
    },
    chnv: single("chnv", "Paroled through the CHNV process", toChartPoints(ohss.chnv_paroles_total)),
    fear: ohssSeries([
      ["credible_fear_positive_fear", "Fear found", 1],
      ["credible_fear_negative_fear", "No fear found", 2],
      ["credible_fear_administrative_closure", "Closed", 4],
    ]),
    arrests: {
      // OHSS split arrests without a conviction into pending charges and
      // neither from FY 2018; earlier years have only the combined count.
      byCriminality: [
        ...ohssSeries([
          ["ero_arrests_convicted_criminals_total_convicted", "Criminal conviction", 2],
          ["ero_arrests_pending_criminal_charges", "Pending criminal charges", 5],
          ["ero_arrests_other_immigration_violators", "No conviction or pending charges", 1],
        ]),
        {
          id: "nonCriminalEarly",
          label: "No conviction (not split before FY 2018)",
          slot: 9 as const,
          points: fyPoints("ero_arrests_non_criminal_total_non_criminal").filter((p) => !fy("ero_arrests_pending_criminal_charges").some((q) => periodToX(q.period) === p.x)),
        },
      ],
      bookins: ohssSeries([
        ["ice_bookins_by_arrester_border", "Arrested by CBP at the border", 3],
        ["ice_bookins_by_arrester_interior", "Arrested by ICE in the interior", 1],
      ]),
    },
    departures: {
      removalsByType: ohssSeries([
        ["dhs_repatriations_dhs_removals_expedited_removals", "Expedited removal", 1],
        ["dhs_repatriations_dhs_removals_reinstatements_of_removal_orders", "Reinstated prior order", 2],
        ["dhs_repatriations_dhs_removals_other_removals", "Other removals, mostly judge-ordered", 3],
      ]),
      returnsByType: ohssSeries([
        ["dhs_repatriations_dhs_enforcement_returns_voluntary_returns", "Voluntary returns", 1],
        ["dhs_repatriations_dhs_enforcement_returns_withdrawals", "Withdrew application at a port", 3],
        ["dhs_repatriations_dhs_enforcement_returns_other_enforcement_returns", "Other enforcement returns", 4],
        ["dhs_repatriations_dhs_administrative_returns_total_administrative_returns", "Administrative returns", 5],
        ["dhs_repatriations_total_repatriations_title_42_expulsions", "Title 42 expulsions", 2],
      ]),
      returnsHistory: [
        { id: "returns", label: "Returns", slot: 1 as const, points: toChartPoints(addSeries(repatriations.returns_administrative, repatriations.returns_enforcement)) },
        { id: "t42", label: "Title 42 expulsions", slot: 2 as const, points: toChartPoints(repatriations.expulsions_title_42) },
      ],
      voluntaryDeparture: ohssSeries([["dhs_repatriations_dhs_enforcement_returns_voluntary_departures", "Voluntary departures carried out", 1]]),
    },
    uscis: {
      petitionsPending: [
        { id: "i130", label: "Relative petitions (I-130)", slot: 1 as const, points: toChartPoints(uscis.uscis_i130_pending) },
        { id: "i140", label: "Employer petitions for permanent workers (I-140)", slot: 2 as const, points: toChartPoints(uscis.uscis_i140_pending) },
      ],
      petitionsReceived: [
        { id: "i130", label: "Relative petitions (I-130)", slot: 1 as const, points: toChartPoints(uscis.uscis_i130_received.filter((p) => !isPartial(p))) },
        { id: "i140", label: "Employer petitions (I-140)", slot: 2 as const, points: toChartPoints(uscis.uscis_i140_received.filter((p) => !isPartial(p))) },
      ],
      i485: [
        { id: "received", label: "Received", slot: 1 as const, points: toChartPoints(uscis.uscis_i485_received.filter((p) => !isPartial(p))) },
        { id: "approved", label: "Approved", slot: 3 as const, points: toChartPoints(uscis.uscis_i485_approved.filter((p) => !isPartial(p))) },
        { id: "denied", label: "Denied", slot: 2 as const, points: toChartPoints(uscis.uscis_i485_denied.filter((p) => !isPartial(p))) },
      ],
      i485Pending: single("i485p", "Green-card applications pending", toChartPoints(uscis.uscis_i485_pending)),
      i485ByCategory: { period: i485ByCategory.period ?? "", items: named(i485ByCategory.values) },
      changeStatus: [
        { id: "i539", label: "Extensions and changes of status (I-539)", slot: 1 as const, points: toChartPoints(uscis.uscis_i539_received.filter((p) => !isPartial(p))) },
        { id: "i129", label: "Worker petitions (I-129)", slot: 2 as const, points: toChartPoints(uscis.uscis_i129_received.filter((p) => !isPartial(p))) },
      ],
      i539Pending: single("i539p", "I-539 applications pending", toChartPoints(uscis.uscis_i539_pending)),
      i539Decisions: [
        { id: "approved", label: "Approved", slot: 3 as const, points: toChartPoints(uscis.uscis_i539_approved.filter((p) => !isPartial(p))) },
        { id: "denied", label: "Denied", slot: 2 as const, points: toChartPoints(uscis.uscis_i539_denied.filter((p) => !isPartial(p))) },
      ],
      i129Decisions: [
        { id: "approved", label: "Approved", slot: 3 as const, points: toChartPoints(uscis.uscis_i129_approved.filter((p) => !isPartial(p))) },
        { id: "denied", label: "Denied", slot: 2 as const, points: toChartPoints(uscis.uscis_i129_denied.filter((p) => !isPartial(p))) },
      ],
    },
    fromAbroad: {
      // Arrangements made before travel: an immigrant visa, refugee processing, or Visa Waiver travel authorization.
      arrivals: [
        { id: "iv", label: "Arrived with an immigrant visa", slot: 1 as const, points: toChartPoints(lprComponents.lpr_new_arrivals) },
        // Same source and years as the immigrant-visa count.
        {
          id: "ref",
          label: "Refugees admitted after processing abroad",
          slot: 3 as const,
          points: toChartPoints(refugees.filter((p) => lprComponents.lpr_new_arrivals.some((q) => q.period === p.period))),
        },
      ],
      visaWaiver: single(
        "vwp",
        "Visa Waiver Program admissions",
        toChartPoints(i94.map((p) => ({ ...p, value: classAt("wt", p.period) + classAt("wb", p.period) }))),
      ),
    },
    refugeeCeilings: [
      { id: "ceiling", label: "Ceiling set by the President", slot: 9 as const, points: toChartPoints(wraps.refugee_ceiling) },
      { id: "admitted", label: "Refugees admitted", slot: 3 as const, points: toChartPoints(fyOnly(wraps.refugee_admissions)) },
    ],
    overstays: {
      byType: Object.entries(overstaysByType).map(([geoid, points], i) => ({
        id: geoid,
        label: OVERSTAY_TYPES[geoid] ?? geoid,
        slot: (i + 1) as SeriesSlot,
        points: toChartPoints(points),
      })),
      rate: single("rate", "Suspected in-country overstay rate", toChartPoints(overstays.overstay_in_country_rate)),
    },
    lprPopulation: {
      series: [
        { id: "lpr", label: "Permanent residents", slot: 1 as const, points: toChartPoints(lprPop.lpr_population) },
        { id: "eligible", label: "Of them, eligible to naturalize", slot: 3 as const, points: toChartPoints(lprPop.lpr_eligible_to_naturalize) },
      ],
      byCountry: { period: lprPopByCountry.period ?? "", items: rankedLast(lprPopByCountry.values) },
      byState: { period: lprPopByState.period ?? "", items: rankedLast(lprPopByState.values) },
      byClass: { period: lprPopByClass.period ?? "", items: rankedLast(lprPopByClass.values) },
    },
    courtOutcomes: (() => {
      const v = (m: string) => last(outcomes[m])?.value ?? 0;
      const period = last(outcomes.decisions_relief)?.period ?? "";
      const items = [
        { label: "Removal ordered, person present", value: v("removal_orders") - v("removal_orders_in_absentia") },
        { label: "Removal ordered in absentia", value: v("removal_orders_in_absentia") },
        { label: "Case terminated or dismissed", value: v("decisions_termination") },
        { label: "Voluntary departure or withdrawal of application", value: v("decisions_voluntary_departure") },
        { label: "Relief granted", value: v("decisions_relief") },
      ];
      return { period, items: period ? items.filter((x) => x.value > 0) : [] };
    })(),
    outcomes: {
      protection: [
        { id: "ref", label: "Refugees admitted (approved abroad)", slot: 3 as const, points: toChartPoints(refugees) },
        { id: "aff", label: "Asylum granted by USCIS (affirmative)", slot: 1 as const, points: toChartPoints(asylum.asylum_grants_affirmative) },
        { id: "def", label: "Asylum granted by judges (defensive)", slot: 2 as const, points: toChartPoints(asylum.asylum_grants_defensive) },
      ],
      lprGroups: LPR_GROUPS.map(([key, label, codes], i) => ({ id: key, label, slot: (i + 1) as SeriesSlot, points: toChartPoints(lprGroupSeries(codes)) })),
    },
    states: { metrics: stateMetrics, rows: stateRows },
    domestic: {
      period: domByState.period ?? "",
      interstate: single("inter", "Moved between states", toChartPoints(interstate)),
      flows: {
        period: flows.period ?? "",
        corridors: flowPairs
          .filter((f) => in51.has(f.dest) && in51.has(f.origin))
          .slice(0, 10)
          .map((f) => ({ label: `${stateName(f.origin)} → ${stateName(f.dest)}`, value: f.value })),
        states: STATES_51.map((s) => ({
          fips: s.fips,
          name: s.name,
          inflow: inflows.get(s.fips) ?? null,
          outflow: outflows.get(s.fips) ?? null,
          origins: flowPairs.filter((f) => f.dest === s.fips).slice(0, 10).map((f) => ({ label: stateName(f.origin), value: f.value })),
          destinations: flowPairs.filter((f) => f.origin === s.fips).slice(0, 10).map((f) => ({ label: stateName(f.dest), value: f.value })),
          netDomestic: toChartPoints(domSeriesByState[s.fips] ?? []),
        })),
      },
    },
    abroad: {
      total: last(emigrants),
      series: single("emig", "U.S.-born people living abroad", toChartPoints(emigrants)),
      byCountry: {
        period: emigByCountry.period ?? "",
        items: emigByCountry.values.map((r) => ({
          label: r.geoid === "630" ? "Puerto Rico (U.S. territory)" : (r.geoName ?? r.geoid),
          value: r.value,
        })),
      },
      byRegion: { period: emigByRegion.period ?? "", items: named(emigByRegion.values) },
    },
    datasets: datasets.map((d) => ({ ...d, coverage: coverage[d.slug] ?? null })),
  };
}

export type ImmigrationData = Awaited<ReturnType<typeof loadImmigration>>;
