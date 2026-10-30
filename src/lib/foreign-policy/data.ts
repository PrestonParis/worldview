import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const OMB = "omb-historical-tables";
const AID = "foreign-assistance";
const TRADE = "census-trade";

const fy = (period: string) => Number(period.replace(/^FY/, ""));
const annual = (points: Point[]): Series["points"] => points.flatMap((p) => {
  const year = fy(p.period);
  return Number.isFinite(year) ? [{ x: year, label: p.period.replace(/^FY/, "FY "), value: p.value }] : [];
});
const latest = (points: Point[]) => points.at(-1) ?? null;

export interface ForeignPolicyCountry {
  code: string;
  name: string;
  obligations: number | null;
  disbursements: number | null;
  exports: number | null;
  imports: number | null;
}

export async function loadForeignPolicy() {
  const [budget, aid, obligations, disbursements, exports, imports] = await Promise.all([
    getSeriesMany(OMB, ["outlays_national_defense", "outlays_international_affairs", "outlays_total"]),
    getSeriesMany(AID, ["obligations", "disbursements", "obligations_constant", "disbursements_constant"]),
    getCrossSection(AID, "obligations", "country"),
    getCrossSection(AID, "disbursements", "country"),
    getCrossSection(TRADE, "exports", "country"),
    getCrossSection(TRADE, "imports", "country"),
  ]);

  const maps = [obligations, disbursements, exports, imports].map((section) => new Map(section.values.map((v) => [v.geoid, v])));
  const codes = new Set(maps.flatMap((map) => [...map.keys()]));
  const countries: ForeignPolicyCountry[] = [...codes].map((code) => {
    const rows = maps.map((map) => map.get(code));
    return {
      code,
      name: rows.find(Boolean)?.geoName ?? code,
      obligations: rows[0]?.value ?? null,
      disbursements: rows[1]?.value ?? null,
      exports: rows[2]?.value ?? null,
      imports: rows[3]?.value ?? null,
    };
  }).sort((a, b) => (b.obligations ?? -Infinity) - (a.obligations ?? -Infinity) || a.name.localeCompare(b.name));

  const defenseNow = latest(budget.outlays_national_defense);
  const totalNow = defenseNow ? budget.outlays_total.find((p) => p.period === defenseNow.period) ?? null : null;
  const aidNow = latest(aid.obligations);
  const tradePeriod = exports.period ?? imports.period;
  const tradePartners = countries.filter((c) => c.exports !== null || c.imports !== null);

  return {
    headline: {
      defense: defenseNow,
      defenseShare: defenseNow && totalNow ? (defenseNow.value / totalNow.value) * 100 : null,
      aid: aidNow,
      aidRecipients: obligations.values.filter((v) => v.value > 0).length,
      tradePartners: tradePartners.length,
    },
    periods: {
      aid: obligations.period,
      disbursements: disbursements.period,
      trade: tradePeriod,
    },
    defense: [
      { id: "defense", label: "National defense", slot: 3, points: annual(budget.outlays_national_defense) },
      { id: "international", label: "International affairs", slot: 1, points: annual(budget.outlays_international_affairs) },
    ] satisfies Series[],
    assistance: [
      { id: "obligations", label: "Obligations", slot: 1, points: annual(aid.obligations) },
      { id: "disbursements", label: "Disbursements", slot: 2, points: annual(aid.disbursements) },
    ] satisfies Series[],
    assistanceReal: [
      { id: "obligations", label: "Obligations", slot: 1, points: annual(aid.obligations_constant) },
      { id: "disbursements", label: "Disbursements", slot: 2, points: annual(aid.disbursements_constant) },
    ] satisfies Series[],
    topRecipients: obligations.values.filter((v) => v.value > 0).slice(0, 20).map((v) => ({
      label: v.geoName ?? v.geoid,
      value: v.value,
      note: v.geoid,
    })) satisfies RankedItem[],
    topTrade: tradePartners.map((c) => ({
      label: c.name,
      value: (c.exports ?? 0) + (c.imports ?? 0),
      note: c.code,
    })).sort((a, b) => b.value - a.value).slice(0, 20) satisfies RankedItem[],
    countries,
  };
}
