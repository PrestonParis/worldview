// Imports Senate LDA (Lobbying Disclosure Act) filings from the free
// lda.senate.gov REST API into `lobbying_registrations` / `lobbying_issues`.
// One filing = one registration (client → lobbying firm, with the year's
// reported income/expenses and the issues + bills named on its activities).
//
// Pilot set: PILOT_CLIENTS below. For each, filings are matched by
// `client_name` for the years in YEARS. Clients and registrants (firms) are
// matched to existing Neo4j entities by name; unmatched ones are created as
// `organization` entities. Bill numbers parsed out of activity descriptions
// are linked to existing `bills` rows when they match.
//
// Idempotent — each filing carries its `filing_uuid` as external_id (unique),
// so a re-run only inserts filings that are new.
//
// Usage: npm run import:lda-lobbying [-- --years=2023,2024] [-- --dry-run]
//   --all              sweep EVERY filing for the years (no client filter, no
//                      per-client cap) — ~100k filings/year; set LDA_API_KEY
//   --clients=A|B      override the pilot client list (pipe-separated)
//   --min-amount=N     with --all, skip filings reporting < $N income+expenses
//   ENV_FILE=.env.cloud targets cloud without swapping .env.local
//   Optional: LDA_API_KEY in .env.local for a higher rate limit
//   (anonymous works for this volume). Get one at lda.senate.gov/api/.

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { addIdentifiers, entityIdMap, upsertEntities } from "./lib/entities.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const yearsArg = process.argv.find((a) => a.startsWith("--years="));
const YEARS = yearsArg
  ? yearsArg.slice("--years=".length).split(",").map((y) => y.trim())
  : [String(new Date().getFullYear() - 1), String(new Date().getFullYear())];

const ALL = process.argv.includes("--all");
const clientsArg = process.argv.find((a) => a.startsWith("--clients="));
const minArg = process.argv.find((a) => a.startsWith("--min-amount="));
const MIN_AMOUNT = minArg ? Number(minArg.slice("--min-amount=".length)) : 0;

const LDA_API_KEY = process.env.LDA_API_KEY || "";
const LDA_BASE = "https://lda.senate.gov/api/v1";
const REQUEST_DELAY_MS = LDA_API_KEY ? 700 : 4500; // anon limit is ~15/min

const PILOT_CLIENTS = [
  "Lockheed Martin",
  "Pfizer Inc.",
  "Amazon.com, Inc.",
  "Meta Platforms, Inc.",
  "The Boeing Company",
  "American Petroleum Institute",
  "Pharmaceutical Research and Manufacturers of America",
  "Comcast Corporation",
  "AT&T Inc.",
  "Blue Cross Blue Shield Association",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ldaFetch(path, params) {
  const url = new URL(`${LDA_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      headers: LDA_API_KEY ? { Authorization: `Token ${LDA_API_KEY}` } : {},
    });
    if (res.ok) {
      await sleep(REQUEST_DELAY_MS);
      return res.json();
    }
    if (res.status === 429 && attempt <= 6) {
      console.log(`    429 — waiting 60s (attempt ${attempt}/6)`);
      await sleep(60_000);
      continue;
    }
    throw new Error(`LDA ${path} -> ${res.status} ${await res.text()}`);
  }
}

const normName = (s) =>
  (s || "").toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

// "H.R. 1234", "S. 42", "H.J.Res. 7" → "HR1234" / "S42" / "HJRES7"
function billKeys(text) {
  const out = new Set();
  const re = /\b(H\.?\s?R\.?|S\.?|H\.?\s?J\.?\s?Res\.?|S\.?\s?J\.?\s?Res\.?|H\.?\s?Con\.?\s?Res\.?|S\.?\s?Con\.?\s?Res\.?)\s?(\d{1,5})\b/gi;
  let m;
  while ((m = re.exec(text || ""))) {
    out.add((m[1].replace(/[.\s]/g, "") + m[2]).toUpperCase());
  }
  return [...out];
}

async function main() {
  console.log(
    `LDA import — years ${YEARS.join(", ")} — key: ${LDA_API_KEY ? "set" : "anonymous (slow)"}${
      DRY_RUN ? "  [DRY RUN]" : ""
    }`,
  );

  let inserted = 0;
  let skipped = 0;
  let entitiesCreated = 0;
  let issuesInserted = 0;
  let billsLinked = 0;
  const problems = [];

  // Phase A — fetch every pilot client's filings up front (slow, LDA rate
  // limit), so the DB connection isn't held open and idle across it.
  const allFilings = [];
  const clients = ALL
    ? [null]
    : clientsArg
      ? clientsArg.slice("--clients=".length).split("|").map((c) => c.trim()).filter(Boolean)
      : PILOT_CLIENTS;
  for (const clientName of clients) {
    for (const year of YEARS) {
      let next = clientName
        ? `${LDA_BASE}/filings/?client_name=${encodeURIComponent(clientName)}&filing_year=${year}&page_size=25`
        : `${LDA_BASE}/filings/?filing_year=${year}&page_size=25`;
      let n = 0;
      try {
        while (next) {
          const u = new URL(next);
          const data = await ldaFetch("/filings/", Object.fromEntries(u.searchParams));
          for (const f of data.results || []) {
            const amount = Number(f.income || 0) + Number(f.expenses || 0);
            if (!ALL || amount >= MIN_AMOUNT) allFilings.push(f);
          }
          n += (data.results || []).length;
          next = data.next;
          if (ALL && n % 2500 < 25) console.log(`    ${year}: ${n} filings fetched`);
          if (!ALL && n >= 100) break; // pilot cap per client-year
        }
      } catch (err) {
        problems.push(`${clientName} ${year}: ${err.message}`);
        continue;
      }
      console.log(`${clientName} ${year}: ${n} filings`);
    }
  }
  console.log(`\n${allFilings.length} filings fetched — writing…`);
  if (DRY_RUN) {
    console.log("(dry run — stopping before any write)");
    return;
  }

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    // Entity name → id lookup (orgs + companies + lobbyist firms all live as
    // `organization`/`company` here).
    const { rows: orgRows } = await pg.query(
      "select id, name from entities where type in ('organization', 'company', 'lobbyist')",
    );
    const byNorm = new Map();
    for (const r of orgRows) byNorm.set(normName(r.name), r.id);
    // LDA's own client / registrant ids, matched before names.
    const byLdaId = { client: await entityIdMap(pg, "lda_client"), registrant: await entityIdMap(pg, "lda_registrant") };
    console.log(`  ${byNorm.size} candidate entities loaded`);

    // Known bills for linking.
    const billRes = await pg.query("select id, bill_number from bills");
    const billByKey = new Map();
    for (const b of billRes.rows) {
      for (const k of billKeys(b.bill_number)) billByKey.set(k, b.id);
    }
    console.log(`  ${billByKey.size} bill keys available for linking`);

    const srcRes = await pg.query(
      `insert into sources (title, url, publisher, source_type, notes)
       values ($1, 'https://lda.senate.gov/', 'U.S. Senate', 'filing', $2) returning id`,
      [
        `Senate LDA import (${new Date().toISOString().slice(0, 10)})`,
        `Lobbying disclosure filings for a pilot client set, years ${YEARS.join(", ")}.`,
      ],
    );
    const sourceId = srcRes.rows[0].id;

    async function resolveEntity(name, kind, ldaId) {
      const scheme = `lda_${kind}`;
      const key = ldaId === undefined || ldaId === null ? null : String(ldaId);
      let id = (key && byLdaId[kind].get(key)) || byNorm.get(normName(name));
      if (!id) {
        if (DRY_RUN) return null;
        id = randomUUID();
        await upsertEntities(pg, [
          {
            id,
            type: "organization",
            name,
            description:
              kind === "registrant"
                ? "Lobbying firm — created from Senate LDA filing data."
                : "Lobbying client — created from Senate LDA filing data.",
            metadata: JSON.stringify({ importedFrom: "senate-lda", ldaRole: kind }),
          },
        ]);
        byNorm.set(normName(name), id);
        entitiesCreated++;
      }
      if (key && !byLdaId[kind].has(key)) {
        await addIdentifiers(pg, [{ entityId: id, scheme, value: key }]);
        byLdaId[kind].set(key, id);
      }
      return id;
    }

    for (const f of allFilings) {
      const clientEntityId = await resolveEntity(f.client?.name || "Unknown client", "client", f.client?.id);
      const registrantEntityId = await resolveEntity(f.registrant?.name || "Unknown firm", "registrant", f.registrant?.id);
      if (!clientEntityId || !registrantEntityId) continue;

      const income = f.income != null ? Math.round(Number(f.income)) : null;
      const expenses = f.expenses != null ? Math.round(Number(f.expenses)) : null;
      const amount = income ?? expenses;
      const amountKind = income != null ? "income" : expenses != null ? "expenses" : null;

      const reg = await pg.query(
        `insert into lobbying_registrations
           (client_entity_id, registrant_entity_id, year, period, amount, amount_kind, source_record_id, notes, external_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (external_id) do nothing
         returning id`,
        [
          clientEntityId,
          registrantEntityId,
          Number(f.filing_year) || Number(YEARS[0]),
          f.filing_period_display || f.filing_period || null,
          amount,
          amountKind,
          sourceId,
          `LDA ${f.filing_type_display || f.filing_type || "filing"}`,
          f.filing_uuid,
        ],
      );
      if (!reg.rows || reg.rows.length === 0) {
        skipped++;
        continue;
      }
      inserted++;
      const registrationId = reg.rows[0].id;

      for (const act of f.lobbying_activities || []) {
        const keys = billKeys(act.description);
        const billId = keys.map((k) => billByKey.get(k)).find(Boolean) || null;
        if (billId) billsLinked++;
        await pg.query(
          `insert into lobbying_issues (registration_id, issue_code, issue_label, bill_id, description)
           values ($1,$2,$3,$4,$5)`,
          [
            registrationId,
            act.general_issue_code || null,
            act.general_issue_code_display || null,
            billId,
            (act.description || "").slice(0, 4000) || null,
          ],
        );
        issuesInserted++;
      }
    }

    console.log("\n--- Summary ---");
    console.log(`Registrations inserted: ${inserted}`);
    console.log(`Registrations skipped (already imported): ${skipped}`);
    console.log(`Entities created: ${entitiesCreated}`);
    console.log(`Issues inserted: ${issuesInserted}  (bills linked: ${billsLinked})`);
    if (problems.length) {
      console.log(`Problems (${problems.length}):`);
      for (const p of problems) console.log(`  - ${p}`);
    }
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
