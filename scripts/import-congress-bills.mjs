// Imports bills for a Congress from the Congress.gov API into the `bills`
// table, resolving sponsors to `politician` entities by bioguideId (run
// `npm run backfill:members` first). Incremental: resumes from the last
// run's cursor (max `updateDate` seen) unless `--full`. Writes a
// `sync_runs` row.
//
// Self-contained (raw pg + neo4j-driver), matching scripts/import-fec-donors.mjs
// — plain Node can't import the app's bundler-resolved `src/lib` tree. The
// shared, tested mapping helpers come from src/lib/legislation/congress.ts.
//
// Usage:
//   npm run import:congress-bills
//   npm run import:congress-bills -- --congress=119 --full --limit=50
//
// Needs CONGRESS_GOV_API_KEY in .env.local (free at https://api.congress.gov/sign-up/).

process.loadEnvFile(".env.local");

import { Client } from "pg";
import neo4j from "neo4j-driver";
import {
  billExternalId,
  billNumberLabel,
  chamberForBillType,
  billStatusFromLatestAction,
  isAfterCursor,
} from "../src/lib/legislation/congress.ts";

const SOURCE = "congress-bills";
const API_BASE = "https://api.congress.gov/v3";
const PAGE_SIZE = 250;
const DELAY_MS = 200;

const apiKey = process.env.CONGRESS_GOV_API_KEY;
if (!apiKey) {
  console.error("CONGRESS_GOV_API_KEY is not set in .env.local");
  process.exit(1);
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const FULL = process.argv.includes("--full");
const SKIP_DETAILS = process.argv.includes("--skip-details");
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const now = new Date();
const CONGRESS = Number(arg("congress", Math.floor((now.getFullYear() - 1789) / 2) + 1));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}format=json&api_key=${apiKey}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  await sleep(DELAY_MS);
  return res.json();
}

// Fetches a bill's Congress.gov sub-resources and replaces its child rows
// (cosponsors / actions / committees / related bills / text versions) and
// `subjects` wholesale in one transaction — mirrors replaceBillDetails in
// src/lib/db/billDetails.ts. ~5 extra API calls per bill; skip with
// --skip-details for a fast metadata-only pass.
async function importBillDetails(pg, api, bioguideMap, { billId, congress, type, number }) {
  const base = `/bill/${congress}/${type}/${number}`;
  const [subjectsRes, cosponsorsRes, actionsRes, committeesRes, relatedRes, textRes] =
    await Promise.all([
      api(`${base}/subjects?limit=250`).catch(() => ({})),
      api(`${base}/cosponsors?limit=250`).catch(() => ({})),
      api(`${base}/actions?limit=250`).catch(() => ({})),
      api(`${base}/committees`).catch(() => ({})),
      api(`${base}/relatedbills?limit=250`).catch(() => ({})),
      api(`${base}/text`).catch(() => ({})),
    ]);

  const subjects = (subjectsRes.subjects?.legislativeSubjects ?? [])
    .map((s) => s.name)
    .filter(Boolean)
    .join("\n");

  const cosponsors = (cosponsorsRes.cosponsors ?? [])
    .map((c) => ({
      entityId: c.bioguideId ? bioguideMap.get(c.bioguideId) : null,
      date: c.sponsorshipDate || null,
      isOriginal: Boolean(c.isOriginalCosponsor),
    }))
    .filter((c) => c.entityId);

  const actions = (actionsRes.actions ?? [])
    .filter((a) => a.actionDate && a.text)
    .map((a) => ({
      date: a.actionDate,
      chamber: a.sourceSystem?.name || a.chamber || null,
      text: String(a.text).slice(0, 2000),
      actionType: a.type || null,
    }));

  const committees = (committeesRes.committees ?? []).map((c) => ({
    name: c.name || "Unknown committee",
    chamber: c.chamber || null,
    activity: (c.activities ?? []).map((x) => x.name).filter(Boolean).join(", ") || null,
  }));

  const relations = (relatedRes.relatedBills ?? []).map((r) => ({
    relatedExternalId:
      r.congress && r.type && r.number
        ? `${r.congress}-${String(r.type).toLowerCase()}-${r.number}`
        : null,
    relatedBillNumber: r.type && r.number ? `${r.type} ${r.number}` : null,
    relatedTitle: r.title || null,
    relationshipType: (r.relationshipDetails ?? [])[0]?.type || null,
  }));

  const textVersions = (textRes.textVersions ?? []).flatMap((v) =>
    (v.formats ?? []).map((f) => ({
      versionType: v.type || null,
      date: v.date || null,
      format: f.type || null,
      url: f.url,
    })),
  );

  await pg.query("begin");
  try {
    await pg.query("update bills set subjects = $2 where id = $1", [billId, subjects || null]);
    for (const t of ["bill_cosponsors", "bill_actions", "bill_committees", "bill_relations", "bill_text_versions"]) {
      await pg.query(`delete from ${t} where bill_id = $1`, [billId]);
    }
    for (const c of cosponsors) {
      await pg.query(
        "insert into bill_cosponsors (bill_id, entity_id, date, is_original) values ($1,$2,$3,$4)",
        [billId, c.entityId, c.date ? new Date(c.date) : null, c.isOriginal],
      );
    }
    for (const a of actions) {
      await pg.query(
        "insert into bill_actions (bill_id, date, chamber, text, action_type) values ($1,$2,$3,$4,$5)",
        [billId, new Date(a.date), a.chamber, a.text, a.actionType],
      );
    }
    for (const c of committees) {
      await pg.query(
        "insert into bill_committees (bill_id, name, chamber, activity) values ($1,$2,$3,$4)",
        [billId, c.name, c.chamber, c.activity],
      );
    }
    for (const r of relations) {
      await pg.query(
        `insert into bill_relations
           (bill_id, related_external_id, related_bill_number, related_title, relationship_type)
         values ($1,$2,$3,$4,$5)
         on conflict (bill_id, related_external_id) do nothing`,
        [billId, r.relatedExternalId, r.relatedBillNumber, r.relatedTitle, r.relationshipType],
      );
    }
    for (const t of textVersions) {
      if (!t.url) continue;
      await pg.query(
        "insert into bill_text_versions (bill_id, version_type, date, format, url) values ($1,$2,$3,$4,$5)",
        [billId, t.versionType, t.date ? new Date(t.date) : null, t.format, t.url],
      );
    }
    await pg.query("commit");
  } catch (err) {
    await pg.query("rollback").catch(() => {});
    throw err;
  }
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let status = "ok";
  let errorMessage = null;
  let newCursor = null;

  const { rows: runRows } = await pg.query(
    "insert into sync_runs (source, status) values ($1, 'ok') returning id",
    [SOURCE],
  );
  const runId = runRows[0].id;

  try {
    const entityRes = await session.run(
      "MATCH (e:Entity {type: 'politician'}) WHERE e.bioguideId IS NOT NULL RETURN e.bioguideId AS b, e.id AS id",
    );
    const bioguideMap = new Map(entityRes.records.map((r) => [String(r.get("b")), String(r.get("id"))]));
    console.log(`${bioguideMap.size} politician entities carry a bioguideId`);

    const cursorRes = await pg.query(
      "select cursor from sync_runs where source = $1 and finished_at is not null order by started_at desc limit 1",
      [SOURCE],
    );
    const cursor = FULL ? null : (cursorRes.rows[0]?.cursor ?? null);
    newCursor = cursor;

    const srcRes = await pg.query(
      `insert into sources (title, url, publisher, source_type, notes)
       values ($1, $2, $3, 'official_statement', $4) returning id`,
      [
        `Congress.gov bill import — ${CONGRESS}th Congress (${now.toISOString().slice(0, 10)})`,
        "https://www.congress.gov/",
        "Library of Congress",
        "Bill metadata imported from the Congress.gov API.",
      ],
    );
    const sourceId = srcRes.rows[0].id;

    let offset = 0;
    let processed = 0;
    let stop = false;

    while (!stop) {
      const page = await api(`/bill/${CONGRESS}?sort=updateDate+desc&limit=${PAGE_SIZE}&offset=${offset}`);
      const items = page.bills ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const itemUpdate = item.updateDateIncludingText ?? item.updateDate ?? "";
        if (!isAfterCursor(itemUpdate, cursor)) {
          stop = true;
          break;
        }
        if (!newCursor || itemUpdate > newCursor) newCursor = itemUpdate;

        try {
          const detail = await api(`/bill/${item.congress}/${String(item.type).toLowerCase()}/${item.number}`);
          const b = detail.bill ?? {};
          const sponsorBioguide = b.sponsors?.[0]?.bioguideId ?? null;
          const sponsorEntityId = sponsorBioguide ? (bioguideMap.get(sponsorBioguide) ?? null) : null;
          const introducedDate =
            b.introducedDate || item.latestAction?.actionDate || itemUpdate.slice(0, 10);

          const res = await pg.query(
            `insert into bills
               (external_id, congress, bill_number, title, summary, status, chamber,
                introduced_date, sponsor_entity_id, policy_area, latest_action_date,
                latest_action_text, source_id, synced_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now(), now())
             on conflict (external_id) do update set
               title = excluded.title,
               summary = excluded.summary,
               status = excluded.status,
               chamber = excluded.chamber,
               sponsor_entity_id = excluded.sponsor_entity_id,
               policy_area = excluded.policy_area,
               latest_action_date = excluded.latest_action_date,
               latest_action_text = excluded.latest_action_text,
               source_id = excluded.source_id,
               synced_at = now(),
               updated_at = now()
             returning id, (xmax = 0) as inserted`,
            [
              billExternalId(item.congress, item.type, item.number),
              item.congress,
              billNumberLabel(item.type, item.number),
              (item.title ?? billNumberLabel(item.type, item.number)).slice(0, 600),
              null,
              billStatusFromLatestAction(item.latestAction?.text),
              chamberForBillType(item.type) || null,
              new Date(introducedDate),
              sponsorEntityId,
              b.policyArea?.name || null,
              item.latestAction?.actionDate ? new Date(item.latestAction.actionDate) : null,
              item.latestAction?.text || null,
              sourceId,
            ],
          );
          if (res.rows[0].inserted) inserted++;
          else updated++;

          if (!SKIP_DETAILS) {
            await importBillDetails(pg, api, bioguideMap, {
              billId: res.rows[0].id,
              congress: item.congress,
              type: String(item.type).toLowerCase(),
              number: item.number,
            });
          }
        } catch (err) {
          skipped++;
          status = "partial";
          console.log(`  skip ${item.type}${item.number}: ${err.message}`);
        }

        if (++processed >= LIMIT) {
          stop = true;
          break;
        }
      }
      offset += PAGE_SIZE;
    }

    // Resolve related-bill references now that more bills exist.
    if (!SKIP_DETAILS) {
      const linkRes = await pg.query(
        `update bill_relations br
         set related_bill_id = b.id
         from bills b
         where br.related_bill_id is null
           and br.related_external_id is not null
           and b.external_id = br.related_external_id`,
      );
      if (linkRes.rowCount) console.log(`  linked ${linkRes.rowCount} related-bill references`);
    }
  } catch (err) {
    status = "error";
    errorMessage = err.message;
    console.error(err);
  } finally {
    await pg.query(
      `update sync_runs set finished_at = now(), status = $2, rows_inserted = $3,
         rows_updated = $4, rows_skipped = $5, error = $6, cursor = $7 where id = $1`,
      [runId, status, inserted, updated, skipped, errorMessage, newCursor],
    );
    await session.close();
    await driver.close();
    await pg.end();
  }

  console.log(`\nbills: +${inserted} new, ~${updated} updated, ${skipped} skipped (status: ${status})`);
  process.exit(status === "error" ? 1 : 0);
}

main();
