// Imports FEC bulk files (https://www.fec.gov/data/browse-data/?tab=bulk-data)
// for whole cycles: every candidate, every committee, and every committee ->
// candidate dollar. The data layer under Subpoena (docs/data-sources.md).
//
// Per cycle it reads, from .cache/fec/<cycle>/ (downloaded on first use):
//   cn      candidate master       -> fec_candidates
//   cm      committee master       -> fec_committees
//   weball  candidate totals       -> candidate_finance
//   pas2    committee -> candidate -> money_flows (summed per giver, candidate, kind)
//
// Entities: candidates who raised $5,000+ or took committee money, and every
// committee that gave or spent on a candidate, get an entity if the crosswalk
// doesn't already have one. Matching is by FEC id only, never by name (name
// matching once gave Sherrod Brown's ids to Shontel Brown); duplicates of
// existing people are left for scripts/merge-entities.mjs. Campaign
// committees aren't entities of their own: their money is the candidate's.
//
// Free-tier sizing: pas2 is ~700K rows a cycle but ~146K summed rows, so
// money_flows is the only per-cycle table of any size. With --lake the
// deduplicated itemized rows go to the lake as fec/pas2/<cycle>.parquet.
//
// Usage:
//   node scripts/import-fec-bulk.mjs [--cycles=2022,2024,2026] [--refresh] [--lake] [--dry-run]
//   ENV_FILE=.env.cloud node scripts/import-fec-bulk.mjs --cycles=2026

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { arg, chunk, fetchRetry, flag, runImport, upsertRows } from "./lib/bulk.mjs";
import { addIdentifiers, describeConflict, entityIdMap, newEntity, upsertEntities } from "./lib/entities.mjs";
import { closeLake, exportParquet } from "./lib/lake.mjs";

const now = new Date();
const currentCycle = now.getFullYear() + (now.getFullYear() % 2);
const CYCLES = arg("cycles", `${currentCycle - 4},${currentCycle - 2},${currentCycle}`)
  .split(",").map(Number).filter(Boolean).sort();
const REFRESH = flag("refresh");
const LAKE = flag("lake");
const DRY_RUN = flag("dry-run");
const MIN_RECEIPTS = 5000;

const CACHE = ".cache/fec";
const BULK = "https://www.fec.gov/files/bulk-downloads";

// Column layouts from https://www.fec.gov/campaign-finance-data/ data dictionaries.
const FILES = {
  cn: { zip: "cn", txt: "cn.txt", cols: "CAND_ID,CAND_NAME,CAND_PTY_AFFILIATION,CAND_ELECTION_YR,CAND_OFFICE_ST,CAND_OFFICE,CAND_OFFICE_DISTRICT,CAND_ICI,CAND_STATUS,CAND_PCC,CAND_ST1,CAND_ST2,CAND_CITY,CAND_ST,CAND_ZIP" },
  cm: { zip: "cm", txt: "cm.txt", cols: "CMTE_ID,CMTE_NM,TRES_NM,CMTE_ST1,CMTE_ST2,CMTE_CITY,CMTE_ST,CMTE_ZIP,CMTE_DSGN,CMTE_TP,CMTE_PTY_AFFILIATION,CMTE_FILING_FREQ,ORG_TP,CONNECTED_ORG_NM,CAND_ID" },
  weball: { zip: "weball", txt: (yy) => `weball${yy}.txt`, cols: "CAND_ID,CAND_NAME,CAND_ICI,PTY_CD,CAND_PTY_AFFILIATION,TTL_RECEIPTS,TRANS_FROM_AUTH,TTL_DISB,TRANS_TO_AUTH,COH_BOP,COH_COP,CAND_CONTRIB,CAND_LOANS,OTHER_LOANS,CAND_LOAN_REPAY,OTHER_LOAN_REPAY,DEBTS_OWED_BY,TTL_INDIV_CONTRIB,CAND_OFFICE_ST,CAND_OFFICE_DISTRICT,SPEC_ELECTION,PRIM_ELECTION,RUN_ELECTION,GEN_ELECTION,GEN_ELECTION_PRECENT,OTHER_POL_CMTE_CONTRIB,POL_PTY_CONTRIB,CVG_END_DT,INDIV_REFUNDS,CMTE_REFUNDS" },
  pas2: { zip: "pas2", txt: "itpas2.txt", cols: "CMTE_ID,AMNDT_IND,RPT_TP,TRANSACTION_PGI,IMAGE_NUM,TRANSACTION_TP,ENTITY_TP,NAME,CITY,STATE,ZIP_CODE,EMPLOYER,OCCUPATION,TRANSACTION_DT,TRANSACTION_AMT,OTHER_ID,CAND_ID,TRAN_ID,FILE_NUM,MEMO_CD,MEMO_TEXT,SUB_ID" },
};

const COMMITTEE_TYPES = {
  C: "Communication cost filer", D: "Delegate committee", E: "Electioneering communication filer",
  H: "House campaign", I: "Independent expenditure filer", N: "PAC", O: "Super PAC",
  P: "Presidential campaign", Q: "PAC", S: "Senate campaign", U: "Single-candidate independent expenditure filer",
  V: "Hybrid PAC", W: "Hybrid PAC", X: "Party committee", Y: "Party committee", Z: "National party nonfederal account",
};
const ORG_TYPES = { C: "Corporate", L: "Labor", M: "Membership", T: "Trade association", V: "Cooperative", W: "Corporate" };
const DESIGNATIONS = { B: "lobbyist/registrant PAC", D: "leadership PAC", J: "joint fundraising committee" };

// --- names ------------------------------------------------------------------

const SMALL = new Set(["of", "the", "and", "for", "a", "an", "to", "in", "on", "at", "by", "or"]);
const UPPER = new Set([
  "PAC", "USA", "US", "AFL", "CIO", "SEIU", "NEA", "AFT", "UAW", "IBEW", "NRA", "AIPAC", "NRCC", "DCCC",
  "DSCC", "NRSC", "RNC", "DNC", "DGA", "RGA", "LLC", "LLP", "LP", "PC", "II", "III", "IV", "UPS", "AT&T",
  "BNSF", "CSX", "IBM", "GOP", "NAR", "AMA", "ABA", "ACLU", "NARAL", "EMILY'S", "PSE&G", "FEDPAC", "CWA",
]);
const VOWEL = /[AEIOUY]/;

function titleWord(w, i) {
  if (!w) return w;
  const bare = w.replace(/[^A-Z&']/g, "");
  if (UPPER.has(bare) || (bare.length > 1 && !VOWEL.test(bare))) return w;
  const lower = w.toLowerCase();
  if (i > 0 && SMALL.has(lower)) return lower;
  return lower.replace(/(^|[-/(."'&])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/^Mc([a-z])/, (_, c) => `Mc${c.toUpperCase()}`);
}
// FEC's files carry "?" where filers typed curly quotes: (?ACME PAC?).
const titleCase = (s) => s.trim().replace(/\?([^?]+)\?/g, '"$1"').split(/\s+/).map(titleWord).join(" ");

// "SMITH, JOHN Q. JR." -> "John Q. Smith Jr."
function personName(raw) {
  const [last, rest = ""] = raw.split(",").map((s) => s.trim());
  const parts = rest.replace(/\b(MR|MRS|MS|DR|HON|REV)\.?(\s|$)/g, "").trim().split(/\s+/).filter(Boolean);
  const suffix = parts.length > 1 && /^(JR|SR|II|III|IV)\.?$/.test(parts.at(-1)) ? parts.pop() : null;
  return titleCase([...parts, last, suffix].filter(Boolean).join(" ")) || titleCase(raw);
}

// --- files ------------------------------------------------------------------

async function ensureFiles(cycle) {
  const yy = String(cycle).slice(2);
  const dir = path.join(CACHE, String(cycle));
  mkdirSync(dir, { recursive: true });
  for (const [key, f] of Object.entries(FILES)) {
    const txt = path.join(dir, typeof f.txt === "function" ? f.txt(yy) : f.txt);
    if (existsSync(txt) && !REFRESH) continue;
    const url = `${BULK}/${cycle}/${f.zip}${yy}.zip`;
    console.log(`  downloading ${url}`);
    const res = await fetchRetry(url, {}, { label: `${key}${yy}` });
    const zip = path.join(dir, `${f.zip}${yy}.zip`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  }
  const file = (key) => path.join(dir, typeof FILES[key].txt === "function" ? FILES[key].txt(yy) : FILES[key].txt);
  return file;
}

const readSql = (file, key) => {
  const cols = "{" + FILES[key].cols.split(",").map((c) => `'${c}':'VARCHAR'`).join(",") + "}";
  return `read_csv('${file.replaceAll("'", "''")}', delim='|', header=false, quote='', escape='', columns=${cols}, ignore_errors=true)`;
};

// Committee -> candidate transactions, latest filing of each transaction,
// memo lines dropped.
const pas2Sql = (file) => `
  select * exclude (rn) from (
    select *, row_number() over (
      partition by CMTE_ID, coalesce(TRAN_ID, SUB_ID)
      order by try_cast(FILE_NUM as bigint) desc nulls last, SUB_ID desc) as rn
    from ${readSql(file, "pas2")}
    where coalesce(MEMO_CD, '') <> 'X' and coalesce(CAND_ID, '') <> '' and coalesce(CMTE_ID, '') <> ''
  ) where rn = 1`;

const KIND_SQL = `case
  when TRANSACTION_TP in ('24K', '24Z') then 'contribution'
  when TRANSACTION_TP = '24C' then 'coordinated'
  when TRANSACTION_TP in ('24E', '24F') then 'ie_support'
  when TRANSACTION_TP in ('24A', '24N') then 'ie_oppose' end`;

// --- writes -----------------------------------------------------------------

// Merges cycle records into a master table: first/last cycle widen, and the
// descriptive fields follow the most recent cycle seen.
async function mergeMaster(pg, table, key, fields, rows, cycle) {
  let sent = 0;
  for (const batch of chunk(rows, 5000)) {
    const cols = [key, ...fields];
    const arrays = cols.map((c) => batch.map((r) => r[c] ?? null));
    await pg.query(
      `insert into ${table} as t (${cols.map((c) => `"${c}"`).join(", ")}, first_cycle, last_cycle)
       select *, $${cols.length + 1}::smallint, $${cols.length + 1}::smallint
       from unnest(${cols.map((_, i) => `$${i + 1}::text[]`).join(", ")})
       on conflict ("${key}") do update set
         first_cycle = least(t.first_cycle, excluded.first_cycle),
         last_cycle = greatest(t.last_cycle, excluded.last_cycle),
         ${fields.map((f) => `"${f}" = case when excluded.last_cycle >= t.last_cycle then excluded."${f}" else t."${f}" end`).join(",\n         ")},
         updated_at = now()
       where excluded.last_cycle >= t.last_cycle or excluded.first_cycle < t.first_cycle`,
      [...arrays, cycle],
    );
    sent += batch.length;
  }
  return sent;
}

// Replaces one cycle of money_flows: changed rows are rewritten, unchanged
// ones left alone (no dead tuples on a weekly re-run), vanished ones deleted.
async function replaceFlows(pg, cycle, flows) {
  await pg.query("begin");
  try {
    await pg.query(`create temp table flows_in (candidate_id text, kind text, committee_id text, total bigint, n integer) on commit drop`);
    for (const batch of chunk(flows, 10000)) {
      await pg.query(
        `insert into flows_in select * from unnest($1::text[], $2::text[], $3::text[], $4::bigint[], $5::integer[])`,
        [batch.map((f) => f.candidate_id), batch.map((f) => f.kind), batch.map((f) => f.committee_id), batch.map((f) => f.total), batch.map((f) => f.n)],
      );
    }
    const upserted = await pg.query(
      `insert into money_flows as t (candidate_id, cycle, kind, committee_id, total, n)
       select candidate_id, $1, kind, committee_id, total, n from flows_in
       on conflict (candidate_id, cycle, kind, committee_id) do update set total = excluded.total, n = excluded.n
       where (t.total, t.n) is distinct from (excluded.total, excluded.n)`,
      [cycle],
    );
    const deleted = await pg.query(
      `delete from money_flows m where m.cycle = $1 and not exists (
         select 1 from flows_in f where f.candidate_id = m.candidate_id and f.kind = m.kind and f.committee_id = m.committee_id)`,
      [cycle],
    );
    await pg.query("commit");
    return { written: upserted.rowCount, deleted: deleted.rowCount };
  } catch (err) {
    await pg.query("rollback");
    throw err;
  }
}

// --- main -------------------------------------------------------------------

await runImport(`fec-bulk-${CYCLES.join("-")}`, async (pg) => {
  const duck = await (await DuckDBInstance.create(":memory:")).connect();
  const all = async (sql) => (await duck.runAndReadAll(sql)).getRowObjects();
  const totals = { inserted: 0, updated: 0, skipped: 0 };

  let sourceId = null;
  if (!DRY_RUN) {
    const { rows } = await pg.query(
      `insert into sources (title, url, publisher, source_type, notes)
       values ($1, 'https://www.fec.gov/data/browse-data/?tab=bulk-data', 'Federal Election Commission', 'filing', $2)
       returning id`,
      [`FEC bulk data, ${CYCLES.join(", ")} (${now.toISOString().slice(0, 10)})`, "Candidate and committee masters, candidate totals (weball), committee contributions to candidates (pas2)."],
    );
    sourceId = rows[0].id;
  }

  const candidateEntity = await entityIdMap(pg, "fec_candidate");
  const committeeEntity = await entityIdMap(pg, "fec_committee");
  const conflicts = [];

  for (const cycle of CYCLES) {
    console.log(`\nCycle ${cycle}`);
    const file = await ensureFiles(cycle);

    // Masters.
    const candidates = await all(`
      select CAND_ID as candidate_id, CAND_NAME as name, CAND_PTY_AFFILIATION as party, CAND_OFFICE as office,
        CAND_OFFICE_ST as state, nullif(CAND_OFFICE_DISTRICT, '') as district, CAND_ICI as incumbent_challenge,
        CAND_PCC as principal_committee_id
      from ${readSql(file("cn"), "cn")} where CAND_ID is not null`);
    const committees = await all(`
      select CMTE_ID as committee_id, CMTE_NM as name, CMTE_DSGN as designation, CMTE_TP as committee_type,
        CMTE_PTY_AFFILIATION as party, CMTE_CITY as city, CMTE_ST as state, ORG_TP as org_type,
        CONNECTED_ORG_NM as connected_org, CAND_ID as candidate_id
      from ${readSql(file("cm"), "cm")} where CMTE_ID is not null and CMTE_NM is not null`);
    for (const c of candidates) if (!c.name) c.name = c.candidate_id;
    console.log(`  ${candidates.length} candidates, ${committees.length} committees`);

    // Money.
    const flows = (await all(`
      select CAND_ID as candidate_id, ${KIND_SQL} as kind, CMTE_ID as committee_id,
        round(sum(try_cast(TRANSACTION_AMT as double)))::bigint as total, count(*)::integer as n
      from (${pas2Sql(file("pas2"))}) where ${KIND_SQL} is not null
      group by all`)).map((f) => ({ ...f, total: Number(f.total) }));
    const finance = (await all(`
      select CAND_ID as candidate_id, CAND_NAME as name, CAND_ICI as ici, CAND_PTY_AFFILIATION as party,
        CAND_OFFICE_ST as state, nullif(CAND_OFFICE_DISTRICT, '') as district,
        round(try_cast(TTL_RECEIPTS as double))::bigint as receipts, round(try_cast(TTL_DISB as double))::bigint as disbursements,
        round(try_cast(COH_COP as double))::bigint as cash, round(try_cast(DEBTS_OWED_BY as double))::bigint as debts,
        round(try_cast(TTL_INDIV_CONTRIB as double))::bigint as indiv, round(try_cast(OTHER_POL_CMTE_CONTRIB as double))::bigint as pac,
        round(try_cast(POL_PTY_CONTRIB as double))::bigint as party_money,
        strftime(try_strptime(CVG_END_DT, '%m/%d/%Y'), '%Y-%m-%d') as coverage_end
      from ${readSql(file("weball"), "weball")} where CAND_ID is not null`)).map((f) => {
      for (const k of ["receipts", "disbursements", "cash", "debts", "indiv", "pac", "party_money"]) f[k] = f[k] === null ? null : Number(f[k]);
      return f;
    });
    const flowTotal = flows.filter((f) => f.kind === "contribution").reduce((s, f) => s + f.total, 0);
    console.log(`  ${flows.length} money flows ($${Math.round(flowTotal / 1e6)}M in direct contributions), ${finance.length} candidate totals`);

    if (DRY_RUN) continue;

    await mergeMaster(pg, "fec_candidates", "candidate_id",
      ["name", "party", "office", "state", "district", "incumbent_challenge", "principal_committee_id"], candidates, cycle);
    await mergeMaster(pg, "fec_committees", "committee_id",
      ["name", "designation", "committee_type", "party", "city", "state", "org_type", "connected_org", "candidate_id"], committees, cycle);

    // Candidate entities.
    const candInfo = new Map(candidates.map((c) => [c.candidate_id, c]));
    const recipients = new Set(flows.map((f) => f.candidate_id));
    const promote = new Map();
    for (const f of finance) if (Number(f.receipts) >= MIN_RECEIPTS || recipients.has(f.candidate_id)) promote.set(f.candidate_id, f);
    for (const id of recipients) if (!promote.has(id) && candInfo.has(id)) promote.set(id, null);
    const newPoliticians = [];
    for (const id of promote.keys()) {
      if (candidateEntity.has(id)) continue;
      const c = candInfo.get(id) ?? { name: promote.get(id)?.name ?? id, office: id[0] };
      const office = { H: "U.S. House", S: "U.S. Senate", P: "President" }[c.office ?? id[0]];
      const e = newEntity({
        type: "politician",
        name: personName(c.name),
        description: [office && `Candidate for ${office}`, c.state, c.district && c.office === "H" ? `District ${Number(c.district)}` : null].filter(Boolean).join(" · "),
        metadata: { party: c.party || undefined, state: c.state || undefined, district: c.district || undefined, office: c.office || undefined, importedFrom: "fec-bulk" },
      });
      e._fec = id;
      newPoliticians.push(e);
      candidateEntity.set(id, e.id);
    }
    for (const batch of chunk(newPoliticians, 2000)) {
      await upsertEntities(pg, batch);
      conflicts.push(...await addIdentifiers(pg, batch.map((e) => ({ entityId: e.id, scheme: "fec_candidate", value: e._fec }))));
    }
    console.log(`  candidates: ${promote.size} with money, ${newPoliticians.length} new entities`);

    // Committee entities: givers and spenders, except campaign committees.
    const cmInfo = new Map(committees.map((c) => [c.committee_id, c]));
    const isCampaign = (c) => c && (["P", "A"].includes(c.designation) || ["H", "S", "P"].includes(c.committee_type));
    const newOrgs = [];
    for (const id of new Set(flows.map((f) => f.committee_id))) {
      const c = cmInfo.get(id);
      if (!c || isCampaign(c) || committeeEntity.has(id)) continue;
      const kind = [ORG_TYPES[c.org_type], DESIGNATIONS[c.designation] ?? COMMITTEE_TYPES[c.committee_type]].filter(Boolean).join(" ");
      const connected = c.connected_org && !["NONE", "N/A", "NA"].includes(c.connected_org.toUpperCase()) ? titleCase(c.connected_org) : null;
      const e = newEntity({
        type: "organization",
        name: titleCase(c.name),
        description: [kind ? kind[0].toUpperCase() + kind.slice(1) : "Political committee", connected && `connected to ${connected}`, c.state].filter(Boolean).join(" · "),
        metadata: {
          committeeType: c.committee_type || undefined, designation: c.designation || undefined,
          orgType: c.org_type || undefined, connectedOrg: connected || undefined, party: c.party || undefined,
          state: c.state || undefined, importedFrom: "fec-bulk",
        },
      });
      e._fec = id;
      newOrgs.push(e);
      committeeEntity.set(id, e.id);
    }
    for (const batch of chunk(newOrgs, 2000)) {
      await upsertEntities(pg, batch);
      conflicts.push(...await addIdentifiers(pg, batch.map((e) => ({ entityId: e.id, scheme: "fec_committee", value: e._fec }))));
    }
    console.log(`  committees: ${newOrgs.length} new entities`);
    totals.inserted += newPoliticians.length + newOrgs.length;

    // Candidate totals.
    const financeRows = finance.filter((f) => promote.has(f.candidate_id) && candidateEntity.has(f.candidate_id)).map((f) => ({
      entity_id: candidateEntity.get(f.candidate_id),
      cycle,
      fec_candidate_id: f.candidate_id,
      party: f.party || null,
      office: f.candidate_id[0],
      state: f.state || null,
      district: f.district,
      incumbent_challenge: f.ici || null,
      total_receipts: f.receipts, total_disbursements: f.disbursements, cash_on_hand: f.cash, debts_owed: f.debts,
      individual_contributions: f.indiv, pac_contributions: f.pac, party_contributions: f.party_money,
      coverage_end_date: f.coverage_end,
      source_record_id: sourceId,
      external_id: `${f.candidate_id}-${cycle}`,
    }));
    await upsertRows(pg, "candidate_finance", Object.keys(financeRows[0] ?? { external_id: 1 }), financeRows, ["external_id"]);

    const { written, deleted } = await replaceFlows(pg, cycle, flows);
    console.log(`  money_flows: ${written} written, ${deleted} removed, ${flows.length - written} unchanged`);
    totals.updated += written;

    if (LAKE) {
      const out = await exportParquet(pg, {
        source: `fec-pas2-${cycle}`,
        objectPath: `fec/pas2/${cycle}.parquet`,
        query: `select CMTE_ID as committee_id, CAND_ID as candidate_id, TRANSACTION_TP as transaction_type, ENTITY_TP as entity_type,
            NAME as name, CITY as city, STATE as state, ZIP_CODE as zip, try_strptime(TRANSACTION_DT, '%m%d%Y')::date as date,
            try_cast(TRANSACTION_AMT as double) as amount, OTHER_ID as other_id, IMAGE_NUM as image_num, SUB_ID as sub_id
          from (${pas2Sql(file("pas2"))})`,
      });
      console.log(`  lake: ${out.path} ${out.rows} rows${out.changed ? "" : " (unchanged)"}`);
    }
  }

  if (conflicts.length) {
    console.log(`\n${conflicts.length} crosswalk conflicts (left as they were):`);
    for (const c of conflicts.slice(0, 10)) console.log(`  ${describeConflict(c)}`);
  }
  if (LAKE) await closeLake();
  duck.closeSync?.();
  return totals;
});
