// Imports Voteview DW-NOMINATE ideology scores (one row per member per
// Congress per chamber) into `member_ideology`. Voteview carries bioguide
// ids, so rows resolve to politician entities by bioguideId, falling back to
// the icpsrId stamped by backfill-members.
//
// Source: https://voteview.com/data (Lewis, Poole, Rosenthal et al.) — free
// CSV, no key, refreshed within days of new roll calls.
//
// Usage:
//   node scripts/import-voteview.mjs [--from=95]
//   ENV_FILE=.env.cloud node scripts/import-voteview.mjs

import {
  arg,
  fetchRetry,
  int,
  num,
  parseCsv,
  runImport,
  str,
  upsertRows,
} from "./lib/bulk.mjs";
import { entityIdMap } from "./lib/entities.mjs";

const URL = "https://voteview.com/static/data/out/members/HSall_members.csv";
const FROM = Number(arg("from", "95"));

const CHAMBER = { House: "House", Senate: "Senate", President: "President" };

await runImport("voteview-members", async (pg) => {
  console.log(`Voteview members, Congress ${FROM}+`);
  const rows = parseCsv(await (await fetchRetry(URL)).text()).filter(
    (r) => Number(r.congress) >= FROM,
  );
  console.log(`  ${rows.length} member-congress rows`);

  const byBioguide = await entityIdMap(pg, "bioguide");
  const byIcpsr = await entityIdMap(pg, "icpsr");

  const out = rows.map((r) => ({
    congress: int(r.congress),
    chamber: CHAMBER[r.chamber] ?? r.chamber,
    icpsr: int(r.icpsr),
    bioguide_id: str(r.bioguide_id),
    entity_id: byBioguide.get(r.bioguide_id) ?? byIcpsr.get(String(int(r.icpsr))) ?? null,
    bioname: str(r.bioname),
    party_code: int(r.party_code),
    state_abbrev: str(r.state_abbrev),
    district_code: int(r.district_code),
    nominate_dim1: num(r.nominate_dim1),
    nominate_dim2: num(r.nominate_dim2),
    nokken_poole_dim1: num(r.nokken_poole_dim1),
    nokken_poole_dim2: num(r.nokken_poole_dim2),
    number_of_votes: int(r.nominate_number_of_votes),
  }));
  const linked = out.filter((r) => r.entity_id).length;
  const sent = await upsertRows(
    pg,
    "member_ideology",
    Object.keys(out[0]),
    out,
    ["congress", "chamber", "icpsr"],
  );
  console.log(`  upserted ${sent}, ${linked} linked to entities`);
  return { inserted: sent, skipped: out.length - linked };
});
