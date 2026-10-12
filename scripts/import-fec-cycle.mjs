// Broad FEC importer for a whole election cycle. Successor to
// import-fec-donors.mjs (which stays for its pilot `--refresh` path): this
// one takes its candidate spine from FEC's *own* candidate list, not a
// hardcoded name array — so it covers challengers and open seats, i.e. what
// a midterm actually is.
//
// Per candidate it writes:
//   • candidate_finance   — one row from /candidate/{id}/totals/ (7B),
//                           including the individual-vs-PAC split
//   • contributions       — the top PAC/committee receipts to the principal
//                           committee (7A), classified + geo-tagged.
//                           Individuals are opt-in only (--indiv-per=N):
//                           they'd create a `donor` Entity per name.
//
// Idempotent: contributions carry FEC `sub_id` as external_id (unique),
// candidate_finance is keyed on "{fecCandidateId}-{cycle}". Resumable: the
// last completed candidate_id is written to sync_runs.cursor, and a re-run
// with --resume skips past it.
//
// Usage:
//   npm run import:fec-cycle -- [--cycle=2026] [--office=H,S] [--states=OH,PA]
//     [--limit=N] [--pac-per=50] [--indiv-per=50]
//     [--totals-only] [--contributions-only] [--refresh] [--resume] [--dry-run]
//
// Needs FEC_API_KEY in .env.local (get one free at https://api.data.gov/signup/).

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import neo4j from "neo4j-driver";
import { load as loadYaml } from "js-yaml";
import {
  classifyCommitteeName,
  contributionTypeFromFec,
} from "../src/lib/money/industries.ts";

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const flag = (name) => process.argv.includes(`--${name}`);

const now = new Date();
const CYCLE = Number(arg("cycle", now.getFullYear() % 2 === 0 ? now.getFullYear() : now.getFullYear() + 1));
const OFFICES = arg("office", "H,S").split(",").map((s) => s.trim().toUpperCase());
const STATES = arg("states", "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const LIMIT = arg("limit", "") ? Number(arg("limit", "")) : Infinity;
const PAC_PER = Number(arg("pac-per", "50"));
// Individuals are OFF by default: importing them creates one `donor` Entity
// per contributor name, which floods the shared graph with one-gift
// nobodies. Per-candidate individual totals still land in candidate_finance.
// Opt in with --indiv-per=N for a specific race worth the marquee donors.
const INDIV_PER = Number(arg("indiv-per", "0"));
const TOTALS_ONLY = flag("totals-only");
const CONTRIB_ONLY = flag("contributions-only");
const REFRESH = flag("refresh");
const RESUME = flag("resume");
const DRY_RUN = flag("dry-run");

const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const LEGIS_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";

let delayMs = FEC_API_KEY === "DEMO_KEY" ? 4000 : 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fec(path, params = {}) {
  const url = new URL(`https://api.open.fec.gov/v1${path}`);
  url.searchParams.set("api_key", FEC_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      await sleep(delayMs);
      return res.json();
    }
    const body = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt <= 8) {
      delayMs = Math.min(delayMs * 2, 8000); // back off and stay slowed
      const wait = res.status === 429 ? 60_000 : 5_000 * attempt;
      console.log(`    ${res.status} on ${path} — waiting ${wait / 1000}s (attempt ${attempt}/8)`);
      await sleep(wait);
      continue;
    }
    throw new Error(`FEC ${path} -> ${res.status} ${body.slice(0, 200)}`);
  }
}

const normTokens = (s) =>
  (s || "").toLowerCase().replace(/[.,'"]/g, "").split(/\s+/).filter(Boolean);
async function fetchAllCandidates() {
  const out = [];
  for (const office of OFFICES) {
    let page = 1;
    let pages = 1;
    do {
      const data = await fec("/candidates/", {
        cycle: String(CYCLE),
        office,
        per_page: "100",
        page: String(page),
        sort: "name",
        candidate_status: "C", // current cycle candidates
      });
      pages = data.pagination?.pages ?? 1;
      for (const r of data.results || []) {
        if (STATES.length && !STATES.includes((r.state || "").toUpperCase())) continue;
        out.push(r);
      }
      page += 1;
    } while (page <= pages);
  }
  // Stable order for resumable cursoring.
  out.sort((a, b) => (a.candidate_id < b.candidate_id ? -1 : 1));
  return out;
}

async function main() {
  console.log(
    `FEC cycle import — cycle ${CYCLE}, offices ${OFFICES.join("/")}` +
      (STATES.length ? `, states ${STATES.join(",")}` : "") +
      (LIMIT !== Infinity ? `, limit ${LIMIT}` : "") +
      (TOTALS_ONLY ? ", totals only" : CONTRIB_ONLY ? ", contributions only" : "") +
      (DRY_RUN ? "  [DRY RUN]" : "") +
      `  — key: ${FEC_API_KEY === "DEMO_KEY" ? "DEMO_KEY (slow)" : "personal"}`,
  );

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  const counts = { candidates: 0, financeUpserts: 0, contribInserted: 0, contribSkipped: 0, contribRefreshed: 0, entitiesCreated: 0, entitiesLinked: 0 };
  const problems = [];
  let syncRunId = null;

  try {
    // Resume cursor.
    let resumeAfter = "";
    if (RESUME) {
      const { rows } = await pg.query(
        `select cursor from sync_runs where source = 'fec-cycle' and cursor is not null
         order by started_at desc limit 1`,
      );
      resumeAfter = rows[0]?.cursor || "";
      if (resumeAfter) console.log(`  resuming after candidate ${resumeAfter}`);
    }

    if (!DRY_RUN) {
      const { rows } = await pg.query(
        `insert into sync_runs (source, status) values ('fec-cycle', 'partial') returning id`,
      );
      syncRunId = rows[0].id;
    }

    // Crosswalk: FEC candidate id -> {first,last,state}.
    console.log("Fetching congress-legislators crosswalk...");
    const legislators = loadYaml(await (await fetch(LEGIS_URL)).text());
    const fecToLegis = new Map();
    for (const l of legislators) {
      const term = (l.terms || [])[l.terms.length - 1] || {};
      for (const fid of l.id?.fec || []) {
        fecToLegis.set(fid, { first: l.name.first, last: l.name.last, state: term.state, bioguide: l.id?.bioguide });
      }
    }

    // Politician entities, indexed for resolution.
    const entRes = await session.run(
      "MATCH (e:Entity {type: 'politician'}) RETURN e.id AS id, e.name AS name, e.metadata AS metadata",
    );
    const byFecId = new Map();
    const byBioguide = new Map();
    const byName = new Map();
    for (const rec of entRes.records) {
      const id = rec.get("id");
      const name = rec.get("name") || "";
      let meta = {};
      try { meta = JSON.parse(rec.get("metadata") || "{}"); } catch { /* ignore */ }
      if (meta.fecCandidateId) byFecId.set(meta.fecCandidateId, id);
      const bg = meta.bioguide || meta.bioguideId;
      if (bg) byBioguide.set(bg, id);
      // Keyed on the full first name: an initial alone merged different
      // people (Sherrod, Scott, and Shontel Brown all became "brown|s").
      const toks = normTokens(name);
      if (toks.length >= 2) {
        byName.set(`${toks[toks.length - 1]}|${toks[0]}|${(meta.state || "").toUpperCase()}`, id);
        byName.set(`${toks[toks.length - 1]}|${toks[0]}|`, id); // state-less fallback
      }
    }
    console.log(`  ${entRes.records.length} politician entities (${byFecId.size} already FEC-linked)`);

    // Companies (PAC donors) index.
    const coRes = await session.run(
      "MATCH (e:Entity) WHERE e.type IN ['company','organization'] RETURN e.id AS id, e.name AS name",
    );
    const companyByName = new Map();
    for (const r of coRes.records) companyByName.set((r.get("name") || "").toLowerCase(), r.get("id"));
    // Donors (individuals) index — populated lazily as we go.
    const donorByKey = new Map();

    let sourceId = null;
    if (!DRY_RUN) {
      const { rows: srcRows } = await pg.query(
        `insert into sources (title, url, publisher, source_type, notes)
         values ($1, 'https://www.fec.gov/data/', 'Federal Election Commission', 'filing', $2)
         returning id`,
        [
          `FEC cycle ${CYCLE} import (${now.toISOString().slice(0, 10)})`,
          `Candidate totals + top PAC/individual receipts, cycle ${CYCLE}, offices ${OFFICES.join("/")}.`,
        ],
      );
      sourceId = srcRows[0].id;
    }

    async function resolvePolitician(cand) {
      const fid = cand.candidate_id;
      let id = byFecId.get(fid);
      if (id) return { id, created: false, needsLink: false };
      const cw = fecToLegis.get(fid);
      if (cw?.bioguide && byBioguide.has(cw.bioguide)) id = byBioguide.get(cw.bioguide);
      if (!id) {
        const toks = normTokens(cand.name); // FEC name is "LAST, FIRST"
        const last = toks[0];
        const first = toks[1] || "";
        id = first
          ? byName.get(`${last}|${first}|${(cand.state || "").toUpperCase()}`) || byName.get(`${last}|${first}|`)
          : undefined;
      }
      if (id) {
        byFecId.set(fid, id);
        return { id, created: false, needsLink: true };
      }
      if (DRY_RUN) return { id: null, created: false, needsLink: false };
      const newId = randomUUID();
      const [last, first] = (cand.name || "").split(",").map((s) => s.trim());
      const display = first ? `${first} ${last}` : cand.name;
      await session.run(
        `CREATE (e:Entity {
           id: $id, type: 'politician', name: $name, description: $description,
           biography: '', imageUrl: '', websiteUrl: '', xUrl: '', facebookUrl: '',
           instagramUrl: '', youtubeUrl: '', linkedinUrl: '', highlights: '',
           metadata: $metadata, createdAt: datetime(), updatedAt: datetime()
         })`,
        {
          id: newId,
          name: display,
          description: [cand.party, cand.office_full || cand.office, cand.state, cand.district && `District ${cand.district}`]
            .filter(Boolean)
            .join(" · "),
          metadata: JSON.stringify({
            fecCandidateId: fid,
            party: cand.party || undefined,
            state: cand.state || undefined,
            district: cand.district || undefined,
            office: cand.office || undefined,
            incumbentChallenge: cand.incumbent_challenge || undefined,
            importedFrom: "openfec-candidates",
          }),
        },
      );
      byFecId.set(fid, newId);
      counts.entitiesCreated++;
      return { id: newId, created: true, needsLink: false };
    }

    async function linkFecId(entityId, fid, cand) {
      if (DRY_RUN) return;
      const r = await session.run("MATCH (e:Entity {id:$id}) RETURN e.metadata AS m", { id: entityId });
      let m = {};
      try { m = JSON.parse(r.records[0]?.get("m") || "{}"); } catch { /* ignore */ }
      m.fecCandidateId = fid;
      if (cand.state && !m.state) m.state = cand.state;
      if (cand.district && !m.district) m.district = cand.district;
      await session.run("MATCH (e:Entity {id:$id}) SET e.metadata=$m, e.updatedAt=datetime()", {
        id: entityId,
        m: JSON.stringify(m),
      });
      counts.entitiesLinked++;
    }

    async function resolveDonor(c) {
      const isIndividual = String(c.is_individual) === "true" || c.entity_type === "IND";
      const name = (c.contributor_name || "").trim();
      if (!name) return null;
      if (isIndividual) {
        const key = `${name.toLowerCase()}|${(c.contributor_state || "").toUpperCase()}`;
        if (donorByKey.has(key)) return donorByKey.get(key);
        if (DRY_RUN) return null;
        const id = randomUUID();
        await session.run(
          `CREATE (e:Entity {
             id: $id, type: 'donor', name: $name, description: $description,
             biography: '', imageUrl: '', websiteUrl: '', xUrl: '', facebookUrl: '',
             instagramUrl: '', youtubeUrl: '', linkedinUrl: '', highlights: '',
             metadata: $metadata, createdAt: datetime(), updatedAt: datetime()
           })`,
          {
            id,
            name,
            description: [c.contributor_occupation, c.contributor_employer, c.contributor_state]
              .filter(Boolean)
              .join(" · ") || "Individual political donor (FEC).",
            metadata: JSON.stringify({
              importedFrom: "openfec-schedule_a",
              state: c.contributor_state || undefined,
              employer: c.contributor_employer || undefined,
              occupation: c.contributor_occupation || undefined,
            }),
          },
        );
        donorByKey.set(key, id);
        counts.entitiesCreated++;
        return id;
      }
      // PAC / committee
      const existing = companyByName.get(name.toLowerCase());
      if (existing) return existing;
      if (DRY_RUN) return null;
      const id = randomUUID();
      await session.run(
        `CREATE (e:Entity {
           id: $id, type: 'company', name: $name,
           description: 'Political committee — imported from FEC Schedule A data.',
           biography: '', imageUrl: '', websiteUrl: '', xUrl: '', facebookUrl: '',
           instagramUrl: '', youtubeUrl: '', linkedinUrl: '', highlights: '',
           metadata: $metadata, createdAt: datetime(), updatedAt: datetime()
         })`,
        { id, name, metadata: JSON.stringify({ fecCommitteeId: c.contributor_id || null, importedFrom: "openfec-schedule_a" }) },
      );
      companyByName.set(name.toLowerCase(), id);
      counts.entitiesCreated++;
      return id;
    }

    console.log(`\nFetching FEC candidate list for cycle ${CYCLE}...`);
    const candidates = (await fetchAllCandidates()).filter((c) => c.candidate_id > resumeAfter);
    console.log(`  ${candidates.length} candidates to process\n`);

    for (const cand of candidates) {
      if (counts.candidates >= LIMIT) break;
      counts.candidates++;
      const { id: entityId, needsLink } = await resolvePolitician(cand);
      if (!entityId) continue;
      if (needsLink) await linkFecId(entityId, cand.candidate_id, cand);

      // 7B — totals
      if (!CONTRIB_ONLY) {
        try {
          const t = (await fec(`/candidate/${cand.candidate_id}/totals/`, { cycle: String(CYCLE) })).results?.[0];
          if (t && !DRY_RUN) {
            const ext = `${cand.candidate_id}-${CYCLE}`;
            const vals = [
              entityId, CYCLE, cand.candidate_id, cand.party || null, cand.office || null,
              cand.state || null, cand.district || null, cand.incumbent_challenge || null,
              Math.round(t.receipts ?? 0) || null,
              Math.round(t.disbursements ?? 0) || null,
              Math.round(t.last_cash_on_hand_end_period ?? t.cash_on_hand_end_period ?? 0) || null,
              Math.round(t.last_debts_owed_by_committee ?? t.debts_owed_by_committee ?? 0) || null,
              Math.round(t.individual_contributions ?? 0) || null,
              Math.round(t.other_political_committee_contributions ?? 0) || null,
              Math.round(t.political_party_committee_contributions ?? 0) || null,
              t.coverage_end_date || null, sourceId, ext,
            ];
            await pg.query(
              `insert into candidate_finance
                 (entity_id, cycle, fec_candidate_id, party, office, state, district, incumbent_challenge,
                  total_receipts, total_disbursements, cash_on_hand, debts_owed,
                  individual_contributions, pac_contributions, party_contributions,
                  coverage_end_date, source_record_id, external_id)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
               on conflict (external_id) do update set
                 total_receipts = excluded.total_receipts,
                 total_disbursements = excluded.total_disbursements,
                 cash_on_hand = excluded.cash_on_hand,
                 debts_owed = excluded.debts_owed,
                 individual_contributions = excluded.individual_contributions,
                 pac_contributions = excluded.pac_contributions,
                 party_contributions = excluded.party_contributions,
                 coverage_end_date = excluded.coverage_end_date,
                 party = excluded.party, office = excluded.office, state = excluded.state,
                 district = excluded.district, incumbent_challenge = excluded.incumbent_challenge,
                 updated_at = now()`,
              vals,
            );
            counts.financeUpserts++;
          }
        } catch (err) {
          problems.push(`${cand.name} totals: ${err.message}`);
        }
      }

      // 7A — top receipts to the principal committee
      if (!TOTALS_ONLY) {
        let committeeId = cand.principal_committees?.[0]?.committee_id;
        if (!committeeId) {
          try {
            const cm = await fec(`/candidate/${cand.candidate_id}/committees/`, {
              cycle: String(CYCLE),
              designation: "P",
              per_page: "1",
            });
            committeeId = cm.results?.[0]?.committee_id;
          } catch (err) {
            problems.push(`${cand.name} committee: ${err.message}`);
          }
        }
        if (committeeId) {
          for (const [isIndividual, perPage] of [["false", PAC_PER], ["true", INDIV_PER]]) {
            if (perPage <= 0) continue;
            let rows = [];
            try {
              rows = (await fec("/schedules/schedule_a/", {
                committee_id: committeeId,
                two_year_transaction_period: String(CYCLE),
                sort: "-contribution_receipt_amount",
                per_page: String(Math.min(perPage, 100)),
                is_individual: isIndividual,
              })).results || [];
            } catch (err) {
              problems.push(`${cand.name} schedule_a(${isIndividual}): ${err.message}`);
              continue;
            }
            for (const c of rows) {
              const amount = Math.round(c.contribution_receipt_amount || 0);
              if (amount <= 0 || !c.contribution_receipt_date || !c.sub_id) continue;
              if (DRY_RUN) { counts.contribInserted++; continue; }
              const donorId = await resolveDonor(c);
              if (!donorId) continue;
              const industry = classifyCommitteeName(c.contributor_name);
              const conflict = REFRESH
                ? `do update set contribution_type=excluded.contribution_type, donor_state=excluded.donor_state,
                     donor_city=excluded.donor_city, donor_zip=excluded.donor_zip,
                     donor_industry=excluded.donor_industry, employer=excluded.employer,
                     occupation=excluded.occupation`
                : `do nothing`;
              const res = await pg.query(
                `insert into contributions
                   (donor_entity_id, recipient_entity_id, amount, currency, date, source_record_id, notes, external_id,
                    contribution_type, donor_state, donor_city, donor_zip, donor_industry, employer, occupation)
                 values ($1,$2,$3,'USD',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 on conflict (external_id) ${conflict}
                 returning (xmax = 0) as inserted`,
                [
                  donorId, entityId, amount, c.contribution_receipt_date, sourceId,
                  `FEC ${c.entity_type_desc || c.entity_type || "contribution"}`,
                  String(c.sub_id),
                  contributionTypeFromFec(c.entity_type),
                  c.contributor_state || null, c.contributor_city || null, c.contributor_zip || null,
                  industry, c.contributor_employer || null, c.contributor_occupation || null,
                ],
              );
              if (res.rows.length === 0) counts.contribSkipped++;
              else if (res.rows[0].inserted) counts.contribInserted++;
              else counts.contribRefreshed++;
            }
          }
        }
      }

      if (syncRunId) {
        await pg.query(
          `update sync_runs set cursor = $1, rows_inserted = $2, rows_updated = $3, rows_skipped = $4
           where id = $5`,
          [cand.candidate_id, counts.contribInserted + counts.financeUpserts, counts.contribRefreshed, counts.contribSkipped, syncRunId],
        );
      }
      if (counts.candidates % 25 === 0) {
        console.log(
          `  ${counts.candidates} candidates · ${counts.financeUpserts} finance · ` +
            `${counts.contribInserted} contribs (+${counts.contribRefreshed} refreshed) · ${counts.entitiesCreated} new entities`,
        );
      }
    }

    if (syncRunId) {
      await pg.query(
        `update sync_runs set status = 'ok', finished_at = now(),
           error = $1 where id = $2`,
        [problems.length ? `${problems.length} problems (see log)` : null, syncRunId],
      );
    }

    console.log("\n--- Summary ---");
    console.log(`Candidates processed:     ${counts.candidates}`);
    console.log(`candidate_finance upserts:${counts.financeUpserts}`);
    console.log(`Contributions inserted:   ${counts.contribInserted}`);
    console.log(`Contributions refreshed:  ${counts.contribRefreshed}`);
    console.log(`Contributions skipped:    ${counts.contribSkipped}`);
    console.log(`Entities created:         ${counts.entitiesCreated}  (linked FEC id to ${counts.entitiesLinked})`);
    if (problems.length) {
      console.log(`\nProblems (${problems.length}):`);
      for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
      if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
    }
  } catch (err) {
    if (syncRunId) {
      await pg.query(`update sync_runs set status = 'error', finished_at = now(), error = $1 where id = $2`, [
        String(err).slice(0, 500),
        syncRunId,
      ]);
    }
    throw err;
  } finally {
    await session.close();
    await driver.close();
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
