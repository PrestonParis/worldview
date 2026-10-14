// Everything /health-care shows: insurance coverage (ACS), drug overdose
// deaths (CDC), and how U.S. health outcomes and spending compare with other
// countries (World Bank) — all from area_stats.

import { getCrossSection, getSeriesByGeo, getSeriesMany } from "@/lib/db/stats";
import { formatPeriod, formatValue } from "@/lib/format";
import { datasetsFor, extremes, last, rankStates, stateTable, toPoints, yearAgo } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const ACS = "census-acs1-health";
const OD = "cdc-overdose-deaths";
const WB = "world-bank-health";
const PEP = "census-pep";

const PEERS: Record<string, string> = {
  USA: "United States", CAN: "Canada", MEX: "Mexico", GBR: "United Kingdom", FRA: "France", DEU: "Germany", ITA: "Italy", JPN: "Japan",
  KOR: "South Korea", AUS: "Australia", CHE: "Switzerland", SWE: "Sweden", NLD: "Netherlands", ESP: "Spain", ISR: "Israel", CHN: "China",
  OED: "OECD members", WLD: "World",
};
const US_COLOR = "var(--viz-series-2)";

// Each country's latest value. Countries report on different lags, so the
// newest year can be missing some of them; any value within two years of the
// newest counts, with its year noted when it differs.
async function peerRanking(metric: string, { exclude = ["WLD"] }: { exclude?: string[] } = {}) {
  const byGeo = await getSeriesByGeo(WB, metric, "country");
  const newest = Math.max(...Object.values(byGeo).map((pts) => Number(pts.at(-1)?.period ?? 0)));
  const items: RankedItem[] = Object.entries(byGeo)
    .filter(([iso]) => PEERS[iso] && !exclude.includes(iso))
    .flatMap(([iso, pts]) => {
      const p = pts.at(-1);
      if (!p || Number(p.period) < newest - 2) return [];
      return [{
        label: PEERS[iso], value: p.value, ...(Number(p.period) !== newest ? { note: p.period } : {}),
        color: iso === "USA" ? US_COLOR : iso === "OED" ? "var(--viz-muted)" : undefined,
      }];
    })
    .sort((a, b) => b.value - a.value);
  return { period: Number.isFinite(newest) ? String(newest) : null, items };
}

export async function loadHealth() {
  const [acs, od, us, oecd, can, jpn] = await Promise.all([
    getSeriesMany(ACS, ["uninsured_rate", "uninsured_children_rate", "medicaid_share", "medicare_share"]),
    getSeriesMany(OD, ["overdose_deaths", "overdose_deaths_opioids", "overdose_deaths_synthetic_opioids", "overdose_deaths_stimulants", "overdose_deaths_cocaine"]),
    ...["USA", "OED", "CAN", "JPN"].map((iso) =>
      getSeriesMany(WB, ["life_expectancy", "infant_mortality", "health_spending_share_gdp", "health_spending_per_capita"], "country", iso),
    ),
  ]);
  if (!acs.uninsured_rate.length && !od.overdose_deaths.length) return null;

  // ---- Coverage ----
  const coverage: Series[] = [
    { id: "uninsured", label: "Uninsured", slot: 2, points: toPoints(acs.uninsured_rate) },
    { id: "kids", label: "Uninsured children", slot: 3, points: toPoints(acs.uninsured_children_rate) },
  ];
  const publicCoverage: Series[] = [
    { id: "medicaid", label: "Medicaid and other means-tested coverage", slot: 1, points: toPoints(acs.medicaid_share) },
    { id: "medicare", label: "Medicare", slot: 3, points: toPoints(acs.medicare_share) },
  ];

  // ---- Overdoses ----
  const overdoses: Series[] = [{ id: "all", label: "All drug overdose deaths", slot: 1, points: toPoints(od.overdose_deaths) }];
  const byDrug: Series[] = [
    { id: "synthetic", label: "Synthetic opioids (mostly fentanyl)", slot: 2, points: toPoints(od.overdose_deaths_synthetic_opioids) },
    { id: "stimulants", label: "Methamphetamine and other stimulants", slot: 1, points: toPoints(od.overdose_deaths_stimulants) },
    { id: "cocaine", label: "Cocaine", slot: 3, points: toPoints(od.overdose_deaths_cocaine) },
  ];

  // ---- Compared with other countries ----
  const compare = (metric: "life_expectancy" | "health_spending_share_gdp" | "infant_mortality", from = 1980): Series[] => [
    { id: "usa", label: "United States", slot: 2, points: toPoints(us[metric], from) },
    { id: "oecd", label: "OECD members", slot: 1, color: "var(--viz-muted)", points: toPoints(oecd[metric], from) },
    { id: "can", label: "Canada", slot: 1, points: toPoints(can[metric], from) },
    { id: "jpn", label: "Japan", slot: 3, points: toPoints(jpn[metric], from) },
  ];
  const lifeCompare = compare("life_expectancy");
  const spendCompare = compare("health_spending_share_gdp", 2000);
  const [lifeRank, spendRank, perPersonRank, infantRank] = await Promise.all([
    peerRanking("life_expectancy"),
    peerRanking("health_spending_share_gdp"),
    peerRanking("health_spending_per_capita", { exclude: ["WLD", "OED"] }),
    peerRanking("infant_mortality"),
  ]);

  // ---- States ----
  const states = await stateTable([
    { source: ACS, metric: "uninsured_rate", label: "Uninsured", unit: "percent", group: "Coverage", sourceLabel: "American Community Survey" },
    { source: ACS, metric: "uninsured_children_rate", label: "Uninsured children", unit: "percent", group: "Coverage", sourceLabel: "American Community Survey" },
    { source: ACS, metric: "medicaid_share", label: "Covered by Medicaid", unit: "percent", group: "Coverage", sourceLabel: "American Community Survey", description: "Medicaid, CHIP, and other means-tested public coverage." },
    { source: ACS, metric: "medicare_share", label: "Covered by Medicare", unit: "percent", group: "Coverage", sourceLabel: "American Community Survey" },
    { source: OD, metric: "overdose_deaths", label: "Overdose deaths", unit: "deaths", group: "Overdoses", sourceLabel: "CDC NCHS", description: "12 months ending in the month shown." },
  ]);
  // Deaths per 100,000 residents, on the latest population estimate.
  const pop = await getCrossSection(PEP, "population", "state");
  const popByName = new Map(pop.values.map((v) => [v.geoName, v.value]));
  const odMetric = states.metrics.find((m) => m.key === "overdose_deaths")!;
  states.metrics.push({
    key: "overdose_rate", label: "Overdose deaths per 100,000", unit: "per_100k", group: "Overdoses", source: "CDC NCHS, Census population estimates",
    period: odMetric.period, description: `12 months ending ${odMetric.period}, per 100,000 residents (population as of July 1, ${pop.period}).`,
  });
  for (const r of states.rows) {
    const p = popByName.get(r.name);
    r.values.overdose_rate = r.values.overdose_deaths !== null && p ? Math.round((r.values.overdose_deaths / p) * 1e6) / 10 : null;
  }

  // ---- Headline + findings ----
  const un = last(acs.uninsured_rate);
  const un0 = acs.uninsured_rate[0] ?? null;
  const odNow = last(od.overdose_deaths);
  const odYearAgo = yearAgo(od.overdose_deaths);
  const odPeak = extremes(od.overdose_deaths).max;
  const life = last(us.life_expectancy);
  const spend = last(us.health_spending_share_gdp);
  const headline = {
    uninsured: { point: un, spark: acs.uninsured_rate.map((p) => p.value) },
    overdoses: { point: odNow, prior: odYearAgo, spark: od.overdose_deaths.slice(-48).map((p) => p.value) },
    life: { point: life, spark: us.life_expectancy.slice(-30).map((p) => p.value) },
    spend: { point: spend, spark: us.health_spending_share_gdp.map((p) => p.value) },
  };

  const findings: string[] = [];
  if (un && un0) findings.push(`${formatValue(un.value, "percent")} of Americans had no health insurance in ${un.period}, down from ${formatValue(un0.value, "percent")} in ${un0.period}.`);
  const mc = last(acs.medicaid_share);
  if (mc) findings.push(`${formatValue(mc.value, "percent")} were covered by Medicaid or another means-tested public program in ${mc.period}.`);
  if (odNow && odPeak) {
    findings.push(
      `${formatValue(odNow.value, "deaths")} people died of drug overdoses in the 12 months to ${formatPeriod(odNow.period)}${odYearAgo ? `, against ${formatValue(odYearAgo.value, "deaths")} a year earlier` : ""}; the peak was ${formatValue(odPeak.value, "deaths")} in the 12 months to ${formatPeriod(odPeak.period)}.`,
    );
  }
  const syn = last(od.overdose_deaths_synthetic_opioids);
  if (syn && odNow && syn.period === odNow.period) findings.push(`Synthetic opioids, mostly fentanyl, were involved in ${Math.round((syn.value / odNow.value) * 100)}% of those deaths.`);
  const lifeOecd = last(oecd.life_expectancy);
  if (life && lifeOecd) {
    const pos = lifeRank.items.filter((i) => i.label !== "OECD members").findIndex((i) => i.label === "United States") + 1;
    const n = lifeRank.items.filter((i) => i.label !== "OECD members").length;
    findings.push(`Life expectancy at birth was ${formatValue(life.value, "years")} years in the U.S. in ${life.period} and ${formatValue(lifeOecd.value, "years")} across OECD members; the U.S. ranked ${pos} of the ${n} countries shown.`);
  }
  const spendPc = perPersonRank.items.find((i) => i.label === "United States");
  if (spend && spendPc) findings.push(`The U.S. spent ${formatValue(spend.value, "percent")} of GDP on health care in ${spend.period}, ${formatValue(spendPc.value, "usd")} per person.`);

  return {
    headline,
    findings,
    coverage,
    publicCoverage,
    overdoses,
    byDrug,
    lifeCompare,
    spendCompare,
    lifeRank,
    spendRank,
    perPersonRank,
    infantRank,
    states,
    uninsuredHigh: rankStates(states.rows, "uninsured_rate"),
    overdoseHigh: rankStates(states.rows, "overdose_rate"),
    datasets: await datasetsFor([ACS, OD, WB, PEP]),
  };
}
