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
import { FIPS_TO_ABBR, STATES_51, stateName } from "@/lib/geo/states";
import { formatPeriod, pctChange, tidyLabel } from "@/lib/format";
import { shiftMonth, toChartPoints, trailingSum, valueAt, type ChartPoint } from "@/lib/stats/series";

const last = (p: Point[]) => p.at(-1) ?? null;
const prev = (p: Point[]) => p.at(-2) ?? null;
const named = (values: AreaValue[]) => values.map((r) => ({ label: r.geoName ?? r.geoid, value: r.value }));
const byPeriod = (p: Point[]) => new Map(p.map((x) => [x.period, x.value]));
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
  const [lpr, lprComponents, naturalizations, natzApps, natzShare, lprByClass, lprByCountry, natzByCountry, lprByState, natzByState] =
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
    ]);
  // Pathways: the seven largest classes, the rest folded into "All other".
  const classes = named(lprByClass.values).map((c) =>
    c.label.startsWith("Certain Iraqis and Afghans") ? { ...c, label: "Iraqi & Afghan special immigrants (U.S. government employees)" } : c,
  );
  const pathways = [
    ...classes.slice(0, 7),
    ...(classes.length > 7 ? [{ label: "All other classes", value: classes.slice(7).reduce((t, c) => t + c.value, 0) }] : []),
  ];

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
  const [netMigration, naturalChange, population, acs, fbByCountry, fbByRegion] = await Promise.all([
    getSeries("census-pep", "international_migration"),
    getSeries("census-pep", "natural_change"),
    getSeries("census-pep", "population"),
    getSeriesMany("census-acs1-immigration", ["foreign_born", "foreign_born_share", "naturalized", "noncitizen"]),
    getCrossSection("census-acs1-immigration", "foreign_born_by_country", "country", { geoidPrefix: "US:" }),
    getCrossSection("census-acs1-immigration", "foreign_born_by_region", "region", { geoidPrefix: "US:" }),
  ]);
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

  const datasets = await listDatasets({ topic: "immigration" });
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
  const domRanked = domByState.values.filter((v) => in51.has(v.geoid));
  const stateRows = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(stateMetrics.map((m) => [m.key, maps[m.key].get(s.fips) ?? null])),
  }));

  const single = (id: string, label: string, points: ChartPoint[], slot: 1 | 2 | 3 = 1) => [{ id, label, slot, points }];

  return {
    stats,
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
    states: { metrics: stateMetrics, rows: stateRows },
    domestic: {
      period: domByState.period ?? "",
      gains: domRanked.filter((v) => v.value > 0).map((v) => ({ label: stateName(v.geoid), value: v.value })),
      losses: domRanked
        .filter((v) => v.value < 0)
        .reverse()
        .map((v) => ({ label: stateName(v.geoid), value: -v.value })),
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
