// Restores the donors behind contributions whose donor_entity_id points at
// no entity (rows imported before the graph moved into Postgres, whose donor
// entity was lost). Each row's FEC filing is found again through OpenFEC (the
// recipient's committees, filtered to the row's date and amount, matched on
// sub_id = external_id) and the donor is:
//   - an existing entity with the same FEC committee id: the rows move to it;
//   - otherwise recreated under the missing id, so the rows need no change.
// Rows whose filing can't be found are listed and left alone.
//
// Usage:
//   node scripts/repair-orphan-donors.mjs [--dry-run]
//   ENV_FILE=.env.cloud node scripts/repair-orphan-donors.mjs
// Needs FEC_API_KEY.

import { connectPg, fetchJson, flag, loadEnv, sleep } from "./lib/bulk.mjs";
import { addIdentifiers, entityIdMap, upsertEntities } from "./lib/entities.mjs";
import { describeCommittee } from "./lib/describe.mjs";

const DRY_RUN = flag("dry-run");

loadEnv();
const KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const fec = async (path, params) => {
  const url = new URL(`https://api.open.fec.gov/v1${path}`);
  for (const [k, v] of Object.entries({ api_key: KEY, per_page: "100", ...params })) url.searchParams.set(k, v);
  await sleep(KEY === "DEMO_KEY" ? 4000 : 300);
  return fetchJson(url, {}, { label: path });
};
const cycleOf = (date) => {
  const year = new Date(date).getUTCFullYear();
  return String(year + (year % 2));
};

const pg = await connectPg();
try {
  const { rows: orphans } = await pg.query(
    `select c.id, c.donor_entity_id, c.recipient_entity_id, c.amount, c.date, c.external_id
     from contributions c
     where not exists (select 1 from entities e where e.id = c.donor_entity_id)
     order by c.donor_entity_id`,
  );
  console.log(`${orphans.length} contributions point at ${new Set(orphans.map((o) => o.donor_entity_id)).size} missing donors`);

  const { rows: fecIds } = await pg.query(
    "select entity_id, value from entity_identifiers where scheme = 'fec_candidate' and entity_id = any($1::uuid[])",
    [[...new Set(orphans.map((o) => o.recipient_entity_id))]],
  );
  const committeesByRecipient = new Map();
  const committeesFor = async (recipientId) => {
    if (committeesByRecipient.has(recipientId)) return committeesByRecipient.get(recipientId);
    const ids = new Set();
    for (const { value } of fecIds.filter((f) => f.entity_id === recipientId)) {
      const res = await fec(`/candidate/${value}/committees/`, {});
      for (const c of res.results ?? []) ids.add(c.committee_id);
    }
    committeesByRecipient.set(recipientId, [...ids]);
    return [...ids];
  };

  const byCommittee = await entityIdMap(pg, "fec_committee");
  const found = new Map(); // missing donor id -> filing
  const unmatched = [];
  for (const o of orphans) {
    if (found.has(o.donor_entity_id)) continue;
    const day = new Date(o.date).toISOString().slice(0, 10);
    let filing = null;
    for (const committee of await committeesFor(o.recipient_entity_id)) {
      const res = await fec("/schedules/schedule_a/", {
        committee_id: committee,
        two_year_transaction_period: cycleOf(o.date),
        min_date: day,
        max_date: day,
        // Amounts were stored rounded to whole dollars.
        min_amount: String(Number(o.amount) - 1),
        max_amount: String(Number(o.amount) + 1),
      });
      filing = (res.results ?? []).find((r) => String(r.sub_id) === o.external_id) ?? null;
      if (filing) break;
    }
    if (filing) found.set(o.donor_entity_id, filing);
    else unmatched.push(o);
  }

  let recreated = 0;
  let moved = 0;
  for (const [missingId, f] of found) {
    const name = (f.contributor_name || "").trim() || "Unknown FEC contributor";
    const existing = f.contributor_id ? byCommittee.get(f.contributor_id) : null;
    const individual = f.entity_type === "IND";
    console.log(`  ${missingId} -> ${name}${existing ? ` (existing entity ${existing})` : ""}`);
    if (DRY_RUN) continue;
    if (existing) {
      const r = await pg.query("update contributions set donor_entity_id = $2 where donor_entity_id = $1", [missingId, existing]);
      moved += r.rowCount;
      continue;
    }
    await upsertEntities(pg, [
      {
        id: missingId,
        type: individual ? "donor" : "company",
        name,
        description: individual
          ? [f.contributor_occupation, f.contributor_employer, f.contributor_state].filter(Boolean).join(" · ") || "Individual political donor (FEC)."
          : describeCommittee(f.contributor_id),
        metadata: JSON.stringify({ importedFrom: "openfec-schedule_a", fecCommitteeId: f.contributor_id || undefined, restoredBy: "repair-orphan-donors" }),
      },
    ]);
    if (f.contributor_id) {
      await addIdentifiers(pg, [{ entityId: missingId, scheme: "fec_committee", value: f.contributor_id }]);
      byCommittee.set(f.contributor_id, missingId);
    }
    recreated++;
  }
  console.log(`\n${recreated} donors recreated, ${moved} rows moved to existing donors${DRY_RUN ? " (dry run)" : ""}`);
  if (unmatched.length) {
    console.log(`${unmatched.length} rows not found on OpenFEC:`);
    for (const o of unmatched) console.log(`  contribution ${o.id} (sub_id ${o.external_id}, ${o.amount} on ${new Date(o.date).toISOString().slice(0, 10)})`);
  }
} finally {
  await pg.end();
}
