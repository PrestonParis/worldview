// Loads a profile dossier (data/profiles/<slug>.json) into the structured
// profile records: sources, facts, relationships, events, statements and the
// editorial layer (summary, roles, chapters, ideas). With --fec, also pulls
// the subject's itemized FEC Schedule A contributions into `contributions`.
// docs/people/profile-model.md describes the model.
//
// Every record a dossier owns is keyed by the dossier ("profile:<slug>:...")
// so a re-run updates in place and removes what the file no longer lists.
// Counterpart entities are matched by FEC id or exact name before any is
// created, so re-runs never create duplicates.
//
// Usage: node scripts/import-profile.mjs --profile=peter-thiel [--fec] [--dry-run]
//        node scripts/import-profile.mjs --all [--fec]
//
// --fec-cache=<file> reads Schedule A from that file when it exists and
// writes the fetched rows there when it doesn't (the shared DEMO_KEY allows
// about 1,000 requests an hour).

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { arg, connectPg, fetchJson, finishRun, flag, loadEnv, sleep, startRun } from "./lib/bulk.mjs";
import { addIdentifiers, describeConflict, upsertEdges, upsertEntities } from "./lib/entities.mjs";
import { titleCase } from "./lib/names.mjs";
import { recipientKindOf } from "../src/lib/money/recipient-kinds.ts";
import { relationshipTypeBySlug } from "../src/lib/relationships.ts";

const DIR = "data/profiles";
const DRY_RUN = flag("dry-run");
const WITH_FEC = flag("fec");
// Read after loadEnv() so the key in .env.local / ENV_FILE is used.
const fecApiKey = () => process.env.FEC_API_KEY || "DEMO_KEY";
const SOURCE_TYPES = new Set(["primary", "secondary", "transcript", "article", "filing", "video", "official_statement"]);
const CATEGORIES = new Set(["career", "finance", "politics", "ideas", "legal", "personal"]);
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

const slugs = flag("all")
  ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  : [arg("profile")].filter(Boolean);
if (!slugs.length) throw new Error("Pass --profile=<slug> or --all");

// ── Validation ──────────────────────────────────────────────────────────
// Everything is checked before the database is touched: a citation to an
// unknown source or entity is an error, not a silent drop.
function validate(slug, d) {
  const errors = [];
  const sourceKeys = new Set(d.sources.map((s) => s.key));
  const entityKeys = new Set(Object.keys(d.entities));
  const cite = (where, keys) => {
    for (const key of keys ?? []) if (!sourceKeys.has(key)) errors.push(`${where}: unknown source "${key}"`);
  };
  if (!entityKeys.has(d.subject)) errors.push(`subject "${d.subject}" is not in entities`);
  for (const s of d.sources) {
    if (!SOURCE_TYPES.has(s.type)) errors.push(`source ${s.key}: bad type ${s.type}`);
    if (!s.url && !s.documentId) errors.push(`source ${s.key}: needs a url or documentId`);
    if (s.repeats && !sourceKeys.has(s.repeats)) errors.push(`source ${s.key}: repeats unknown ${s.repeats}`);
  }
  for (const r of d.roles ?? []) cite(`role ${r.label}`, r.sources);
  for (const f of d.facts ?? []) cite(`fact ${f.key}`, f.sources);
  for (const r of d.relationships ?? []) {
    cite(`relationship ${r.key}`, r.sources);
    if (!r.sources?.length) errors.push(`relationship ${r.key}: no evidence`);
    if (!relationshipTypeBySlug[r.relType]) errors.push(`relationship ${r.key}: unknown relType ${r.relType}`);
    for (const end of [r.source, r.target]) if (!entityKeys.has(end)) errors.push(`relationship ${r.key}: unknown entity ${end}`);
  }
  for (const e of d.events ?? []) {
    cite(`event ${e.key}`, e.sources);
    if (!e.sources?.length) errors.push(`event ${e.key}: no evidence`);
    if (!DATE_RE.test(e.date)) errors.push(`event ${e.key}: bad date ${e.date}`);
    if (!CATEGORIES.has(e.category)) errors.push(`event ${e.key}: bad category ${e.category}`);
    for (const [key] of e.participants ?? []) if (!entityKeys.has(key)) errors.push(`event ${e.key}: unknown participant ${key}`);
  }
  for (const s of d.statements ?? []) {
    cite(`statement ${s.key}`, [s.source]);
    if (!s.quote && !s.summary) errors.push(`statement ${s.key}: needs a quote or summary`);
    if (s.verbatim === false && !s.summary) errors.push(`statement ${s.key}: a non-verbatim quote needs a summary saying where the wording comes from`);
  }
  const statementKeys = new Set((d.statements ?? []).map((s) => s.key));
  for (const k of d.ideas?.featuredQuotes ?? []) if (!statementKeys.has(k)) errors.push(`ideas.featuredQuotes: unknown statement ${k}`);
  for (const t of d.ideas?.traditions ?? []) cite(`tradition ${t.label}`, t.sources);
  for (const i of d.ideas?.influences ?? []) cite(`influence ${i.name}`, i.sources);
  for (const w of d.ideas?.works ?? []) cite(`work ${w.title}`, [w.source]);
  for (const c of d.chapters ?? []) {
    for (const m of c.body.matchAll(/\[\[([^\]]+)\]\]/g)) cite(`chapter ${c.key}`, m[1].split(",").map((k) => k.trim()));
  }
  if (d.finance?.fec) cite("finance.fec", [d.finance.fec.source]);
  if (errors.length) throw new Error(`${slug}: ${errors.length} problem(s)\n  ${errors.join("\n  ")}`);
}

// ── Entities ────────────────────────────────────────────────────────────
async function resolveEntities(pg, d) {
  const ids = {};
  const created = [];
  for (const [key, spec] of Object.entries(d.entities)) {
    if (spec.match?.identifier) {
      const [scheme, value] = spec.match.identifier;
      const { rows } = await pg.query("select entity_id from entity_identifiers where scheme = $1 and value = $2", [scheme, value]);
      if (!rows.length) throw new Error(`entity ${key}: no entity with ${scheme} ${value}`);
      ids[key] = rows[0].entity_id;
      continue;
    }
    const name = spec.match?.name ?? spec.create?.name;
    const type = spec.match?.type ?? spec.create?.type;
    const { rows } = await pg.query(
      "select id from entities where lower(name) = lower($1) and ($2::text is null or type = $2) order by created_at",
      [name, type ?? null],
    );
    if (rows.length > 1) console.warn(`  entity ${key}: ${rows.length} entities named "${name}", using the oldest`);
    if (rows.length) {
      ids[key] = rows[0].id;
      continue;
    }
    if (!spec.create) throw new Error(`entity ${key}: no entity named "${name}"`);
    const id = randomUUID();
    ids[key] = id;
    created.push(spec.create.name);
    if (!DRY_RUN) {
      await upsertEntities(pg, [
        {
          id,
          type: spec.create.type,
          name: spec.create.name,
          description: spec.create.description ?? "",
          website_url: spec.create.websiteUrl ?? "",
        },
      ]);
    }
  }
  return { ids, created };
}

// ── Sources ─────────────────────────────────────────────────────────────
async function upsertSources(pg, d, accessedAt) {
  const ids = {};
  for (const s of d.sources) {
    const { rows } = await pg.query(
      `insert into sources (source_key, title, url, publisher, source_type, published_at, notes, author, document_id, accessed_at, repeats_source_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (source_key) where source_key is not null do update set
         title = excluded.title, url = excluded.url, publisher = excluded.publisher,
         source_type = excluded.source_type, published_at = excluded.published_at, notes = excluded.notes,
         author = excluded.author, document_id = excluded.document_id, accessed_at = excluded.accessed_at,
         repeats_source_key = excluded.repeats_source_key, updated_at = now()
       returning id`,
      [
        s.key,
        s.title,
        s.url ?? null,
        s.publisher,
        s.type,
        s.publishedAt ? `${s.publishedAt}T12:00:00Z` : null,
        s.notes ?? null,
        s.author ?? null,
        s.documentId ?? null,
        s.accessedAt ?? accessedAt,
        s.repeats ?? null,
      ],
    );
    ids[s.key] = rows[0].id;
  }
  return ids;
}

async function setEvidence(pg, recordType, recordId, sourceIds) {
  await pg.query("delete from record_evidence where record_type = $1 and record_id = $2", [recordType, recordId]);
  for (const sourceId of new Set(sourceIds)) {
    await pg.query(
      "insert into record_evidence (record_type, record_id, source_id) values ($1, $2, $3) on conflict do nothing",
      [recordType, recordId, sourceId],
    );
  }
}

// ── The dossier ─────────────────────────────────────────────────────────
async function importDossier(pg, slug, d) {
  const prefix = `profile:${slug}:`;
  const { ids, created } = await resolveEntities(pg, d);
  const subjectId = ids[d.subject];
  console.log(`${slug}: subject ${subjectId}${created.length ? `; creating ${created.join(", ")}` : ""}`);
  if (DRY_RUN) {
    console.log(
      `  would write ${d.sources.length} sources, ${d.facts.length} facts, ${d.relationships.length} relationships, ` +
        `${d.events.length} events, ${d.statements.length} statements, ${d.chapters.length} chapters`,
    );
    return { subjectId, d };
  }

  const src = await upsertSources(pg, d, d.sourcesVerifiedAt);
  const srcIds = (keys) => (keys ?? []).map((k) => src[k]);

  await pg.query(
    `insert into entity_profiles (entity_id, summary, roles, chapters, ideas, coverage, editorial_reviewed_at, sources_verified_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (entity_id) do update set summary = excluded.summary, roles = excluded.roles, chapters = excluded.chapters,
       ideas = excluded.ideas, coverage = excluded.coverage, editorial_reviewed_at = excluded.editorial_reviewed_at,
       sources_verified_at = excluded.sources_verified_at, updated_at = now()`,
    [
      subjectId,
      d.summary,
      JSON.stringify(d.roles ?? []),
      JSON.stringify(d.chapters ?? []),
      JSON.stringify(d.ideas ?? {}),
      JSON.stringify({ money: d.finance?.coverage ?? "" }),
      d.reviewedAt,
      d.sourcesVerifiedAt,
    ],
  );

  // Facts: the dossier owns the subject's whole fact list.
  await pg.query("delete from entity_facts where entity_id = $1 and not (fact_key = any($2))", [
    subjectId,
    d.facts.map((f) => f.key),
  ]);
  for (const [sort, f] of d.facts.entries()) {
    const { rows } = await pg.query(
      `insert into entity_facts (entity_id, fact_key, label, value, detail, as_of, sort, featured)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (entity_id, fact_key) do update set label = excluded.label, value = excluded.value,
         detail = excluded.detail, as_of = excluded.as_of, sort = excluded.sort, featured = excluded.featured, updated_at = now()
       returning id`,
      [subjectId, f.key, f.label, f.value, f.detail ?? "", f.asOf ?? null, sort, Boolean(f.featured)],
    );
    await setEvidence(pg, "fact", rows[0].id, srcIds(f.sources));
  }

  // Relationships.
  const edgeKeys = d.relationships.map((r) => `${prefix}${r.key}`);
  await upsertEdges(
    pg,
    d.relationships.map((r) => ({
      source_key: `${prefix}${r.key}`,
      source_entity_id: ids[r.source],
      target_entity_id: ids[r.target],
      label: r.relType.replaceAll("-", " "),
      rel_type: r.relType,
      role: r.role ?? "",
      valid_from: r.from ?? "",
      valid_to: r.until ?? "",
      notes: r.notes ?? "",
    })),
    { keepValidFrom: false },
  );
  await pg.query("delete from entity_edges where source_key like $1 and not (source_key = any($2))", [`${prefix}%`, edgeKeys]);
  for (const r of d.relationships) {
    const { rows } = await pg.query(
      `update entity_edges set status = $2, prominence = $3, source_record_id = $4 where source_key = $1 returning id`,
      [`${prefix}${r.key}`, r.status ?? "verified", r.prominence ?? 0, src[r.sources[0]]],
    );
    await setEvidence(pg, "edge", rows[0].id, srcIds(r.sources));
  }

  // Events and their participants.
  const eventKeys = d.events.map((e) => `${prefix}${e.key}`);
  await pg.query("delete from entity_events where event_key like $1 and not (event_key = any($2))", [`${prefix}%`, eventKeys]);
  for (const e of d.events) {
    const { rows } = await pg.query(
      `insert into entity_events (event_key, subject_entity_id, date_start, date_end, title, summary, category, significance, chapter_key, status, status_note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (event_key) do update set subject_entity_id = excluded.subject_entity_id, date_start = excluded.date_start,
         date_end = excluded.date_end, title = excluded.title, summary = excluded.summary, category = excluded.category,
         significance = excluded.significance, chapter_key = excluded.chapter_key, status = excluded.status,
         status_note = excluded.status_note, updated_at = now()
       returning id`,
      [
        `${prefix}${e.key}`,
        subjectId,
        e.date,
        e.date_end ?? "",
        e.title,
        e.summary ?? "",
        e.category,
        e.significance ?? 2,
        e.chapter ?? "",
        e.status ?? "verified",
        e.statusNote ?? "",
      ],
    );
    const eventId = rows[0].id;
    await pg.query("delete from entity_event_participants where event_id = $1", [eventId]);
    for (const [key, role] of e.participants ?? []) {
      await pg.query(
        "insert into entity_event_participants (event_id, entity_id, role) values ($1, $2, $3) on conflict do nothing",
        [eventId, ids[key], role ?? ""],
      );
    }
    await setEvidence(pg, "event", eventId, srcIds(e.sources));
  }

  // Statements (claims).
  const claimKeys = d.statements.map((s) => `${prefix}${s.key}`);
  await pg.query("delete from claims where claim_key like $1 and not (claim_key = any($2))", [`${prefix}%`, claimKeys]);
  for (const s of d.statements) {
    const precision = s.datePrecision ?? (s.date.length === 4 ? "year" : s.date.length === 7 ? "month" : "day");
    const iso = precision === "year" ? `${s.date}-07-01` : precision === "month" ? `${s.date}-15` : s.date;
    const { rows } = await pg.query(
      `insert into claims (claim_key, speaker_entity_id, date, venue, quote, topic, issue, stance_kind, summary, date_precision, source_id, verbatim)
       values ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11)
       on conflict (claim_key) where claim_key is not null do update set speaker_entity_id = excluded.speaker_entity_id,
         date = excluded.date, venue = excluded.venue, quote = excluded.quote, topic = excluded.topic, issue = excluded.issue,
         stance_kind = excluded.stance_kind, summary = excluded.summary, date_precision = excluded.date_precision,
         source_id = excluded.source_id, verbatim = excluded.verbatim, updated_at = now()
       returning id`,
      [
        `${prefix}${s.key}`,
        subjectId,
        `${iso}T12:00:00Z`,
        s.venue ?? null,
        s.quote ?? "",
        s.issue,
        s.stance ?? "explicit",
        s.summary ?? null,
        precision,
        src[s.source],
        s.verbatim !== false,
      ],
    );
    await setEvidence(pg, "claim", rows[0].id, srcIds([s.source]));
  }

  console.log(
    `  ${d.sources.length} sources, ${d.facts.length} facts, ${d.relationships.length} relationships, ` +
      `${d.events.length} events, ${d.statements.length} statements, ${d.chapters.length} chapters`,
  );
  return { subjectId, d, src };
}

// ── FEC Schedule A ──────────────────────────────────────────────────────
// Name search on Schedule A is fuzzy (THIEL, PETER also returns THIELE and
// THIELEN), and other people share the name. A row belongs to the subject
// only if the name matches exactly and either the employer matches or the
// filing address is one of the subject's known cities; each row records
// which test it passed.
async function fetchScheduleA(contributorName) {
  const rows = [];
  let cursor = "";
  for (;;) {
    const url =
      `https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${fecApiKey()}` +
      `&contributor_name=${encodeURIComponent(contributorName)}&is_individual=true&per_page=100` +
      `&sort=-contribution_receipt_amount${cursor}`;
    const page = await fetchJson(url, {}, { label: "FEC schedule_a" });
    rows.push(...page.results);
    const last = page.pagination?.last_indexes;
    if (!last || !page.results.length) break;
    cursor = `&last_index=${last.last_index}&last_contribution_receipt_amount=${last.last_contribution_receipt_amount}`;
    await sleep(fecApiKey() === "DEMO_KEY" ? 1500 : 300);
  }
  return rows;
}

async function importFec(pg, { subjectId, d, src }) {
  const cfg = d.finance.fec;
  const name = new RegExp(cfg.namePattern);
  const employer = new RegExp(cfg.employerPattern);
  const cities = new Set(cfg.cities);
  const cache = arg("fec-cache");
  let raw;
  if (cache && fs.existsSync(cache)) {
    raw = JSON.parse(fs.readFileSync(cache, "utf8"));
  } else {
    raw = await fetchScheduleA(cfg.contributorName);
    if (cache) fs.writeFileSync(cache, JSON.stringify(raw));
  }
  const matched = raw.flatMap((r) => {
    if (!name.test(r.contributor_name ?? "")) return [];
    const job = `${r.contributor_employer ?? ""} ${r.contributor_occupation ?? ""}`;
    if (employer.test(job)) return [{ r, basis: "employer" }];
    if (cities.has(r.contributor_city)) return [{ r, basis: "city" }];
    return [];
  });
  console.log(`  FEC: ${raw.length} rows for "${cfg.contributorName}", ${matched.length} matched to the subject`);

  // Recipients: a candidate committee resolves to the candidate; anything
  // else to the committee's own entity, created on first sight.
  const committeeIds = [...new Set(matched.map(({ r }) => r.committee_id))];
  const candidateIds = [...new Set(matched.flatMap(({ r }) => r.committee?.candidate_ids ?? []))];
  const lookup = async (scheme, values) => {
    const { rows } = await pg.query(
      "select value, entity_id from entity_identifiers where scheme = $1 and value = any($2)",
      [scheme, values],
    );
    return new Map(rows.map((row) => [row.value, row.entity_id]));
  };
  const byCommittee = await lookup("fec_committee", committeeIds);
  const byCandidate = await lookup("fec_candidate", candidateIds);
  const newCommittees = new Map();
  const recipientFor = (r) => {
    const c = r.committee ?? {};
    const kind = recipientKindOf(c.committee_type, c.designation);
    if (kind === "candidate") {
      for (const cand of c.candidate_ids ?? []) if (byCandidate.has(cand)) return byCandidate.get(cand);
    }
    if (byCommittee.has(r.committee_id)) return byCommittee.get(r.committee_id);
    if (!newCommittees.has(r.committee_id)) newCommittees.set(r.committee_id, { id: randomUUID(), name: titleCase(c.name ?? r.committee_id) });
    return newCommittees.get(r.committee_id).id;
  };

  const rows = matched.map(({ r, basis }) => {
    const c = r.committee ?? {};
    return {
      external_id: String(r.sub_id),
      recipient: recipientFor(r),
      amount: Math.round(r.contribution_receipt_amount),
      date: `${r.contribution_receipt_date}T12:00:00Z`,
      notes: [r.memo_text, `Identity match: ${basis}`].filter(Boolean).join(" · "),
      donor_state: r.contributor_state ?? null,
      donor_city: r.contributor_city ?? null,
      donor_zip: r.contributor_zip ?? null,
      employer: r.contributor_employer ?? null,
      occupation: r.contributor_occupation ?? null,
      receipt_type: r.receipt_type ?? null,
      memo_code: r.memo_code ?? null,
      cycle: r.two_year_transaction_period ?? null,
      committee_id: r.committee_id,
      recipient_kind: recipientKindOf(c.committee_type, c.designation),
      recipient_party: c.party ?? null,
    };
  });
  if (DRY_RUN) {
    const counted = rows.filter((row) => row.memo_code !== "X");
    console.log(`  would upsert ${rows.length} contributions (${counted.length} counted, $${counted.reduce((t, row) => t + row.amount, 0).toLocaleString()})`);
    return { inserted: 0 };
  }

  if (newCommittees.size) {
    await upsertEntities(
      pg,
      [...newCommittees.values()].map((c) => ({ id: c.id, type: "organization", name: c.name, description: "Federal political committee (FEC)." })),
    );
    const conflicts = await addIdentifiers(
      pg,
      [...newCommittees.entries()].map(([committeeId, c]) => ({ entityId: c.id, scheme: "fec_committee", value: committeeId })),
    );
    for (const conflict of conflicts) console.warn(`  identifier conflict: ${describeConflict(conflict)}`);
  }
  const sourceId = src[cfg.source];
  let inserted = 0;
  for (const row of rows) {
    const { rows: out } = await pg.query(
      `insert into contributions (donor_entity_id, recipient_entity_id, amount, currency, date, source_record_id, notes,
         contribution_type, donor_state, donor_city, donor_zip, employer, occupation, external_id,
         receipt_type, memo_code, cycle, committee_id, recipient_kind, recipient_party)
       values ($1, $2, $3, 'USD', $4, $5, $6, 'individual', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       on conflict (external_id) do update set donor_entity_id = excluded.donor_entity_id,
         recipient_entity_id = excluded.recipient_entity_id, amount = excluded.amount, date = excluded.date,
         source_record_id = excluded.source_record_id, notes = excluded.notes, receipt_type = excluded.receipt_type,
         memo_code = excluded.memo_code, cycle = excluded.cycle, committee_id = excluded.committee_id,
         recipient_kind = excluded.recipient_kind, recipient_party = excluded.recipient_party, updated_at = now()
       returning (xmax = 0) as inserted`,
      [
        subjectId, row.recipient, row.amount, row.date, sourceId, row.notes, row.donor_state, row.donor_city,
        row.donor_zip, row.employer, row.occupation, row.external_id, row.receipt_type, row.memo_code, row.cycle,
        row.committee_id, row.recipient_kind, row.recipient_party,
      ],
    );
    if (out[0].inserted) inserted++;
  }
  const counted = rows.filter((row) => row.memo_code !== "X");
  console.log(
    `  ${rows.length} contributions (${inserted} new, ${newCommittees.size} committees created); ` +
      `${counted.length} counted lines total $${counted.reduce((t, row) => t + row.amount, 0).toLocaleString()}`,
  );
  return { inserted, updated: rows.length - inserted };
}

// ── Main ────────────────────────────────────────────────────────────────
loadEnv();
const dossiers = slugs.map((slug) => {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), "utf8"));
  validate(slug, d);
  return [slug, d];
});
const pg = await connectPg();
try {
  for (const [slug, d] of dossiers) {
    if (DRY_RUN) {
      const result = await importDossier(pg, slug, d);
      if (WITH_FEC && d.finance?.fec) await importFec(pg, result);
      continue;
    }
    await pg.query("begin");
    const result = await importDossier(pg, slug, d);
    await pg.query("commit");
    if (WITH_FEC && d.finance?.fec) {
      const runId = await startRun(pg, `fec-person:${slug}`);
      try {
        await finishRun(pg, runId, await importFec(pg, result));
      } catch (err) {
        await finishRun(pg, runId, { status: "error", error: String(err?.stack ?? err).slice(0, 4000) });
        throw err;
      }
    }
  }
} catch (err) {
  await pg.query("rollback").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await pg.end();
}
