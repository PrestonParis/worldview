import { sql } from "drizzle-orm";
import { db } from "./client";
import { DIMENSIONS, type Measure } from "../elections/electorate";

// The electorate from the CPS Voting and Registration Supplement
// (area_stats source 'cps-voting', see scripts/import-cps-voting.mjs), for
// the nation or one state, every year on file.

export interface GroupStat {
  key: string;
  label: string;
  citizens: number | null;
  registered: number | null;
  voted: number | null;
  /** Respondents behind the voter estimate. */
  sample: number;
}

export interface ElectorateYear {
  year: number;
  citizens: number;
  registered: number;
  voted: number;
  dimensions: { key: string; label: string; votersOnly: boolean; groups: GroupStat[] }[];
}

export interface Electorate {
  geoid: string; // "US" or state FIPS
  geoName: string;
  years: ElectorateYear[]; // newest first
  states: { geoid: string; name: string }[];
}

export async function loadElectorate(geoid = "US"): Promise<Electorate | null> {
  const [rows, states] = await Promise.all([
    db.execute(sql`select period, metric, value, geo_name, metadata from area_stats
                   where source = 'cps-voting' and geoid = ${geoid}`),
    db.execute(sql`select distinct geoid, geo_name from area_stats
                   where source = 'cps-voting' and geo_level = 'state' order by geo_name`),
  ]);
  if (!rows.rows.length) return null;

  type Row = { period: string; metric: string; value: number | null; geo_name: string | null; metadata: { sample?: number } | null };
  const byYear = new Map<number, Map<string, Row>>();
  for (const r of rows.rows as Row[]) {
    const year = Number(r.period);
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year)!.set(r.metric, r);
  }

  const years = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, metrics]): ElectorateYear => {
      const val = (metric: string) => {
        const v = metrics.get(metric)?.value;
        return v == null ? null : Number(v);
      };
      const of = (measure: Measure, dim: string, group: string) => val(`${measure}_${dim}_${group}`);
      return {
        year,
        citizens: val("citizens_total") ?? 0,
        registered: val("registered_total") ?? 0,
        voted: val("voted_total") ?? 0,
        dimensions: DIMENSIONS.map((d) => ({
          key: d.key,
          label: d.label,
          votersOnly: !!d.votersOnly,
          groups: d.groups.map((g) => ({
            key: g.key,
            label: g.label,
            citizens: d.votersOnly ? null : of("citizens", d.key, g.key),
            registered: d.votersOnly ? null : of("registered", d.key, g.key),
            voted: of("voted", d.key, g.key),
            sample: Number(metrics.get(`voted_${d.key}_${g.key}`)?.metadata?.sample ?? 0),
          })),
        })),
      };
    });

  const anyRow = (rows.rows as Row[])[0];
  return {
    geoid,
    geoName: anyRow.geo_name ?? geoid,
    years,
    states: (states.rows as { geoid: string; geo_name: string }[]).map((s) => ({ geoid: s.geoid, name: s.geo_name })),
  };
}
