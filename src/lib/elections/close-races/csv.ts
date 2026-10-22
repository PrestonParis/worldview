// One CSV layout for the close-races report, used by the download route
// and the morning snapshot (scripts/sync-ga-results.mjs --snapshot), so the
// two files always match.

import type { CloseRaceRow, CloseRaceSort } from "./types.ts";

const NAME_FIXES: Record<string, string> = { Dekalb: "DeKalb", Mcduffie: "McDuffie", Mcintosh: "McIntosh" };

/** "baldwin-county-ga" → "Baldwin County". */
export function countyNameFromSlug(slug: string): string {
  return slug
    .replace(/-ga$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .map((w) => NAME_FIXES[w] ?? w)
    .join(" ");
}

export function countiesLabel(row: Pick<CloseRaceRow, "county" | "counties">): string | null {
  if (row.county) return row.county;
  return row.counties.length ? row.counties.map(countyNameFromSlug).join("; ") : null;
}

export const CLOSE_RACE_COLUMNS: { header: string; value: (row: CloseRaceRow) => string | number | null }[] = [
  { header: "rank", value: (r) => r.rank },
  { header: "race", value: (r) => r.name },
  { header: "level", value: (r) => r.level },
  { header: "county", value: (r) => countiesLabel(r) },
  { header: "municipality", value: (r) => r.municipality },
  { header: "election_kind", value: (r) => r.electionKind },
  { header: "primary_party", value: (r) => r.primaryParty },
  { header: "seats", value: (r) => r.voteFor },
  { header: "leader", value: (r) => r.leaderName },
  { header: "leader_party", value: (r) => r.leaderParty },
  { header: "leader_incumbent", value: (r) => (r.leaderIncumbent ? "yes" : "no") },
  { header: "leader_votes", value: (r) => r.leaderVotes },
  { header: "runner_up", value: (r) => r.runnerUpName },
  { header: "runner_up_party", value: (r) => r.runnerUpParty },
  { header: "runner_up_votes", value: (r) => r.runnerUpVotes },
  { header: "total_votes", value: (r) => r.totalVotes },
  { header: "margin_votes", value: (r) => r.marginVotes },
  { header: "margin_pct", value: (r) => (r.marginPct == null ? null : r.marginPct.toFixed(3)) },
  { header: "leader_share_pct", value: (r) => (r.leaderShare == null ? null : (r.leaderShare * 100).toFixed(2)) },
  { header: "decision_rule", value: (r) => r.decisionRule },
  { header: "reporting_units", value: (r) => r.reportingUnits },
  { header: "total_units", value: (r) => r.totalUnits },
  { header: "result_status", value: (r) => r.resultStatus },
  { header: "flags", value: (r) => r.flags.join("; ") },
  { header: "margin_change_votes", value: (r) => r.marginChange },
  { header: "source_updated_at", value: (r) => r.sourceUpdatedAt },
  { header: "worldview_updated_at", value: (r) => r.ingestedAt },
];

function cell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function closeRacesCsv(rows: CloseRaceRow[]): string {
  const lines = [CLOSE_RACE_COLUMNS.map((c) => c.header).join(",")];
  for (const row of rows) lines.push(CLOSE_RACE_COLUMNS.map((c) => cell(c.value(row))).join(","));
  return lines.join("\n") + "\n";
}

export function closeRacesFilename(electionId: string, sort: CloseRaceSort, at: Date): string {
  const stamp = at.toISOString().replace(/[:]/g, "").replace(/\..+$/, "Z");
  return `ga-close-races-${electionId}-by-${sort}-${stamp}.csv`;
}
