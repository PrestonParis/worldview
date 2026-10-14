// Everything /energy shows: energy prices (FRED), where U.S. electricity
// comes from and CO₂ emissions against other countries (Our World in Data),
// and U.S. and state temperatures (NOAA) — all from area_stats.

import { getCrossSection, getSeriesByGeo, getSeriesMany, type Point } from "@/lib/db/stats";
import { formatPeriod, formatSigned, formatValue } from "@/lib/format";
import { STATES_51 } from "@/lib/geo/states";
import { datasetsFor, extremes, last, rankStates, stateTable, toPoints, yearAgo } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const PRICES = "fred-energy-prices";
const OWID = "owid-energy";
const NOAA = "noaa-climate";
const ECON = "fred-economy";

const ELEC = ["elec_share_coal", "elec_share_gas", "elec_share_nuclear", "elec_share_hydro", "elec_share_wind", "elec_share_solar", "elec_share_oil", "elec_share_low_carbon"] as const;
const CO2 = ["co2_emissions", "co2_per_capita", "co2_share_global"] as const;
const PEERS: Record<string, string> = {
  USA: "United States", CHN: "China", IND: "India", EU27: "European Union", RUS: "Russia", JPN: "Japan", DEU: "Germany", GBR: "United Kingdom",
  FRA: "France", CAN: "Canada", WLD: "World",
};

// The 20th-century average, NOAA's usual baseline.
const baseline = (points: Point[]) => {
  const c20 = points.filter((p) => p.period >= "1901" && p.period <= "2000");
  return c20.length ? c20.reduce((t, p) => t + p.value, 0) / c20.length : null;
};
// Average of the latest `n` years.
const recent = (points: Point[], n = 10) => {
  const tail = points.slice(-n);
  return tail.length === n ? tail.reduce((t, p) => t + p.value, 0) / n : null;
};

export async function loadEnergy() {
  const [prices, cpi, usa, chn, eu, ind, temps] = await Promise.all([
    getSeriesMany(PRICES, ["gas_price", "electricity_price", "oil_price", "natural_gas_price"]),
    getSeriesMany(ECON, ["cpi"]),
    getSeriesMany(OWID, [...ELEC, ...CO2], "country", "USA"),
    getSeriesMany(OWID, [...CO2], "country", "CHN"),
    getSeriesMany(OWID, [...CO2], "country", "EU27"),
    getSeriesMany(OWID, [...CO2], "country", "IND"),
    getSeriesMany(NOAA, ["avg_temperature"]),
  ]);
  if (!prices.gas_price.length && !usa.co2_emissions.length) return null;

  // ---- Prices, nominal and in today's dollars ----
  const cpiBy = new Map(cpi.cpi.map((p) => [p.period, p.value]));
  const cpiNow = last(cpi.cpi);
  const real = (pts: Point[]) => (cpiNow ? pts.flatMap((p) => (cpiBy.has(p.period) ? [{ ...p, value: (p.value * cpiNow.value) / cpiBy.get(p.period)! }] : [])) : []);
  const today = cpiNow ? formatPeriod(cpiNow.period) : "";
  const gas: Series[] = [
    { id: "nominal", label: "Price at the time", slot: 1, points: toPoints(prices.gas_price) },
    { id: "real", label: `In ${today} dollars`, slot: 2, points: toPoints(real(prices.gas_price)) },
  ];
  const electricity: Series[] = [
    { id: "nominal", label: "Price at the time", slot: 1, points: toPoints(prices.electricity_price) },
    { id: "real", label: `In ${today} dollars`, slot: 2, points: toPoints(real(prices.electricity_price)) },
  ];
  const oil: Series[] = [{ id: "oil", label: "West Texas Intermediate, per barrel", slot: 1, points: toPoints(prices.oil_price) }];
  const natgas: Series[] = [{ id: "gas", label: "Henry Hub, per million BTU", slot: 3, points: toPoints(prices.natural_gas_price) }];

  // ---- Electricity ----
  const renewables = usa.elec_share_hydro.map((p) => {
    const w = usa.elec_share_wind.find((q) => q.period === p.period)?.value ?? 0;
    const s = usa.elec_share_solar.find((q) => q.period === p.period)?.value ?? 0;
    return { ...p, value: p.value + w + s };
  });
  const mix: Series[] = [
    { id: "coal", label: "Coal", slot: 1, color: "var(--viz-muted)", points: toPoints(usa.elec_share_coal) },
    { id: "gas", label: "Natural gas", slot: 2, points: toPoints(usa.elec_share_gas) },
    { id: "nuclear", label: "Nuclear", slot: 3, points: toPoints(usa.elec_share_nuclear) },
    { id: "renewables", label: "Hydro, wind, and solar", slot: 1, points: toPoints(renewables) },
  ];
  const windSolar: Series[] = [
    { id: "wind", label: "Wind", slot: 1, points: toPoints(usa.elec_share_wind, 2000) },
    { id: "solar", label: "Solar", slot: 2, points: toPoints(usa.elec_share_solar, 2000) },
  ];

  // ---- Emissions ----
  const emissions: Series[] = [
    { id: "chn", label: "China", slot: 2, points: toPoints(chn.co2_emissions) },
    { id: "usa", label: "United States", slot: 1, points: toPoints(usa.co2_emissions) },
    { id: "eu", label: "European Union", slot: 3, points: toPoints(eu.co2_emissions) },
    { id: "ind", label: "India", slot: 1, color: "var(--viz-muted)", points: toPoints(ind.co2_emissions) },
  ];
  const share: Series[] = [{ id: "share", label: "U.S. share of global CO₂ emissions", slot: 1, points: toPoints(usa.co2_share_global) }];
  const perCapitaCross = await getCrossSection(OWID, "co2_per_capita", "country");
  const perCapita: RankedItem[] = perCapitaCross.values
    .filter((v) => PEERS[v.geoid])
    .map((v) => ({ label: PEERS[v.geoid], value: v.value, color: v.geoid === "USA" ? "var(--viz-series-2)" : v.geoid === "WLD" ? "var(--viz-muted)" : undefined }));

  // ---- Temperature ----
  const t = temps.avg_temperature;
  const base = baseline(t);
  const temperature: Series[] = [{ id: "temp", label: "Contiguous U.S. average temperature", slot: 2, points: toPoints(t) }];

  // ---- States ----
  const states = await stateTable([
    { source: NOAA, metric: "avg_temperature", label: "Average temperature", unit: "deg_f", group: "Temperature", sourceLabel: "NOAA" },
  ]);
  const byGeo = await getSeriesByGeo(NOAA, "avg_temperature", "state");
  states.metrics.push({
    key: "warming", label: "Last 10 years vs 20th-century average", unit: "deg_f", group: "Temperature", source: "NOAA",
    period: t.length ? `${t.at(-10)?.period}–${t.at(-1)?.period}` : "", description: "Average temperature over the latest 10 years minus the 1901–2000 average.",
  });
  for (const r of states.rows) {
    const pts = byGeo[STATES_51.find((s) => s.abbr === r.abbr)!.fips] ?? [];
    const b = baseline(pts);
    const n = recent(pts);
    r.values.warming = b !== null && n !== null ? Math.round((n - b) * 10) / 10 : null;
  }

  // ---- Headline + findings ----
  const gasNow = last(prices.gas_price);
  const lowCarbon = last(usa.elec_share_low_carbon);
  const co2 = last(usa.co2_emissions);
  const tNow = last(t);
  const headline = {
    gas: { point: gasNow, prior: yearAgo(prices.gas_price), spark: prices.gas_price.slice(-36).map((p) => p.value) },
    lowCarbon: { point: lowCarbon, spark: usa.elec_share_low_carbon.map((p) => p.value) },
    co2: { point: co2, spark: usa.co2_emissions.slice(-40).map((p) => p.value) },
    temp: { point: tNow, anomaly: tNow && base !== null ? tNow.value - base : null, spark: t.slice(-40).map((p) => p.value) },
  };

  const findings: string[] = [];
  const realGas = real(prices.gas_price);
  const gasPeak = extremes(realGas).max;
  if (gasNow && gasPeak) findings.push(`A gallon of regular gasoline averaged ${formatValue(gasNow.value, "usd_cents")} in ${formatPeriod(gasNow.period)}. Adjusted for inflation, the high was ${formatValue(gasPeak.value, "usd_cents")} in ${formatPeriod(gasPeak.period)}.`);
  const coalNow = last(usa.elec_share_coal);
  const gasShare = last(usa.elec_share_gas);
  const coalPeak = extremes(usa.elec_share_coal).max;
  if (coalNow && gasShare && coalPeak) findings.push(`Natural gas generated ${formatValue(gasShare.value, "percent")} of U.S. electricity in ${gasShare.period} and coal ${formatValue(coalNow.value, "percent")}, down from ${formatValue(coalPeak.value, "percent")} in ${coalPeak.period}.`);
  const ws = usa.elec_share_wind.at(-1);
  const sol = usa.elec_share_solar.at(-1);
  if (ws && sol) findings.push(`Wind and solar together supplied ${formatValue(ws.value + sol.value, "percent")} of electricity in ${ws.period}.`);
  const co2Peak = extremes(usa.co2_emissions).max;
  if (co2 && co2Peak) {
    findings.push(`U.S. CO₂ emissions were ${(co2.value / 1e9).toFixed(1)} billion tonnes in ${co2.period}, ${Math.round((1 - co2.value / co2Peak.value) * 100)}% below their ${co2Peak.period} peak.`);
  }
  const chnNow = last(chn.co2_emissions);
  if (co2 && chnNow) findings.push(`China emitted ${formatValue(chnNow.value / co2.value, "times")} as much CO₂ as the U.S. in ${chnNow.period}; per person, the U.S. emitted ${formatValue(last(usa.co2_per_capita)?.value, "tonnes_per_person")} tonnes and China ${formatValue(last(chn.co2_per_capita)?.value, "tonnes_per_person")}.`);
  const tRecent = recent(t);
  if (tNow && base !== null && tRecent !== null) {
    findings.push(`The contiguous U.S. averaged ${formatValue(tRecent, "deg_f")} over the 10 years to ${tNow.period}, ${formatSigned(tRecent - base, "deg_f")} against the 20th-century average of ${formatValue(base, "deg_f")}.`);
  }

  return {
    headline,
    findings,
    gas,
    electricity,
    oil,
    natgas,
    mix,
    windSolar,
    emissions,
    share,
    perCapita: perCapita.sort((a, b) => b.value - a.value),
    perCapitaYear: perCapitaCross.period,
    temperature,
    baseline: base,
    states,
    warmingHigh: rankStates(states.rows, "warming"),
    datasets: await datasetsFor([PRICES, OWID, NOAA]),
  };
}
