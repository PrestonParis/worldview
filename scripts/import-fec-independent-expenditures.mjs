// Imports FEC Schedule E (independent expenditures — super PAC / party /
// group spending for or against a candidate) into `independent_expenditures`.
//
// Only periodic-report rows (is_notice=false, most_recent=true), so 24/48-
// hour notices that are later re-reported aren't double counted. That means
// the last few weeks before a filing deadline lag until the periodic report
// lands.
//
// Candidates resolve to entities through the `fecCandidateIds` crosswalk
// (backfill-members) and the `fecCandidateId` metadata the fec-cycle importer
// stamps.
//
// Usage:
//   node scripts/import-fec-independent-expenditures.mjs [--cycle=2026] [--min-amount=0]
//   ENV_FILE=.env.cloud node scripts/import-fec-independent-expenditures.mjs --cycle=2024

import {
  arg,
  connectNeo4j,
  entityIdMap,
  fetchJson,
  num,
  runImport,
  sleep,
  str,
  upsertRows,
} from "./lib/bulk.mjs";

const now = new Date();
const CYCLE = Number(arg("cycle", String(now.getFullYear() + (now.getFullYear() % 2))));
const MIN = arg("min-amount", "");

await runImport(`fec-schedule-e-${CYCLE}`, async (pg) => {
  const key = process.env.FEC_API_KEY || "DEMO_KEY";
  const delay = key === "DEMO_KEY" ? 4000 : 250;
  console.log(`FEC Schedule E, cycle ${CYCLE}${key === "DEMO_KEY" ? " (DEMO_KEY — slow)" : ""}`);

  const driver = connectNeo4j();
  const byFec = await entityIdMap(driver, "fecCandidateIds");
  const session = driver.session();
  try {
    // fec-cycle stores its candidate id inside the metadata JSON.
    const res = await session.run(
      `MATCH (e:Entity {type: 'politician'}) WHERE e.metadata CONTAINS 'fecCandidateId'
       RETURN e.id AS id, e.metadata AS m`,
    );
    for (const r of res.records) {
      try {
        const fid = JSON.parse(r.get("m")).fecCandidateId;
        if (fid && !byFec.has(fid)) byFec.set(fid, r.get("id"));
      } catch {
        /* hand-edited metadata */
      }
    }
  } finally {
    await session.close();
    await driver.close();
  }

  let lastIndex = null;
  let lastDate = null;
  let total = 0;
  let linked = 0;
  for (;;) {
    const url = new URL("https://api.open.fec.gov/v1/schedules/schedule_e/");
    url.searchParams.set("api_key", key);
    url.searchParams.set("cycle", String(CYCLE));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("is_notice", "false");
    url.searchParams.set("most_recent", "true");
    url.searchParams.set("sort", "-expenditure_date");
    if (MIN) url.searchParams.set("min_amount", MIN);
    if (lastIndex) {
      url.searchParams.set("last_index", lastIndex);
      if (lastDate) url.searchParams.set("last_expenditure_date", lastDate);
    }
    const page = await fetchJson(url, {}, { label: "schedule_e" });
    const results = page.results ?? [];
    if (!results.length) break;
    const rows = results
      .filter((r) => r.sub_id)
      .map((r) => {
        const entity = r.candidate_id ? byFec.get(r.candidate_id) ?? null : null;
        if (entity) linked++;
        return {
          external_id: String(r.sub_id),
          cycle: CYCLE,
          committee_id: str(r.committee_id),
          committee_name: str(r.committee?.name ?? r.committee_name),
          spender_entity_id: null,
          candidate_id: str(r.candidate_id),
          candidate_name: str(r.candidate_name),
          candidate_entity_id: entity,
          candidate_office: str(r.candidate_office),
          candidate_state: str(r.candidate_office_state),
          candidate_district: str(r.candidate_office_district),
          candidate_party: str(r.candidate_party),
          support_oppose: str(r.support_oppose_indicator),
          amount: num(r.expenditure_amount) ?? 0,
          expenditure_date: str(r.expenditure_date)?.slice(0, 10) ?? null,
          purpose: str(r.expenditure_description),
          payee_name: str(r.payee_name),
        };
      });
    if (rows.length) {
      total += await upsertRows(pg, "independent_expenditures", Object.keys(rows[0]), rows, ["external_id"]);
    }
    process.stdout.write(`\r  ${total} / ${page.pagination?.count ?? "?"} rows`);
    lastIndex = page.pagination?.last_indexes?.last_index;
    lastDate = page.pagination?.last_indexes?.last_expenditure_date;
    if (!lastIndex) break;
    await sleep(delay);
  }
  console.log(`\n  ${linked} rows linked to candidate entities`);
  return { inserted: total, skipped: total - linked };
});
