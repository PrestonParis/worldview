// Georgia candidate registrations → public campaign contacts for Writ's
// close-races report (docs/elections/ga-close-races.md, "Candidate contacts").
// Independent of the results ingest: it never blocks or slows
// sync:ga-results, and the report works without it.
//
// Sources (both keyless or already-keyed public APIs):
//   - Georgia Government Transparency and Campaign Finance Commission
//     (PeachFile, peachfile.ethics.ga.gov): every state, county and municipal
//     candidate registration, with the committee's and the filer's published
//     email and phone. The API rejects pages over 100 rows. Mailing addresses
//     are never stored: many are home addresses.
//   - FEC (api.open.fec.gov, FEC_API_KEY): U.S. Senate and House candidates,
//     with the principal campaign committee's website and email.
//
// Then every candidate option on a {cycle} ballot in tracked_contests is
// matched to at most one registration by office, district and county first,
// then name (src/lib/elections/close-races/candidates.ts). Ambiguous
// candidates are left unmatched and counted.
//
// Usage:
//   npm run sync:ga-candidates                    (fetch both sources, match)
//   npm run sync:ga-candidates -- --match-only    (re-match stored registrations)
//   npm run sync:ga-candidates -- --skip-profiles (search lists only; keep stored contacts)
//   npm run sync:ga-candidates -- --dry-run       (fetch + match, write nothing, print a sample)
//   ENV_FILE=.env.cloud npm run sync:ga-candidates

import { arg, connectPg, fetchRetry, finishRun, flag, loadEnv, sleep, startRun, upsertRows } from "./lib/bulk.mjs";
import {
  circuitOf,
  contestDistrict,
  matchCandidate,
  normalizeDistrict,
  officeFamily,
  parseBallotName,
  parseRegistryName,
} from "../src/lib/elections/close-races/candidates.ts";

loadEnv();

const CYCLE = Number(arg("cycle", 2026));
const DRY_RUN = flag("dry-run");
const MATCH_ONLY = flag("match-only");
const SKIP_PROFILES = flag("skip-profiles");
const PEACH_API = "https://api-peachfile.ethics.ga.gov/api/";
const PEACH_PROFILE = (guid) => `https://peachfile.ethics.ga.gov/public/cf/candidateprofile?gd=${guid}`;
const FEC_API = "https://api.open.fec.gov/v1/";
const PAGE = 100; // PeachFile's WAF rejects larger pages.

const PARTY = { Republican: "R", Democrat: "D", Libertarian: "L", "Non-Partisan": "NP", Other: null, REP: "R", DEM: "D", LIB: "L", GRE: "G", IND: "I" };
const CIRCUIT_OFFICES = new Set(["district_attorney", "superior_court"]);

const clean = (v) => {
  const s = v == null ? "" : String(v).trim();
  return s && !/^(redacted|n\/?a|none|null)$/i.test(s) ? s : null;
};
const email = (v) => (clean(v) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(clean(v)) ? clean(v).toLowerCase() : null);
const phone = (v) => {
  const digits = String(v ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null;
};
const website = (v) => {
  const s = clean(v);
  if (!s || !/\.[a-z]{2,}/i.test(s)) return null;
  return (/^https?:\/\//i.test(s) ? s : `https://${s}`).toLowerCase();
};

async function peach(path, body) {
  const res = await fetchRetry(`${PEACH_API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: "https://peachfile.ethics.ga.gov" },
    body: JSON.stringify(body),
    timeoutMs: 60_000,
  }, { label: `peachfile ${path}` });
  const json = await res.json();
  if (json.succeeded === false) throw new Error(`peachfile ${path}: ${json.error?.message ?? "failed"}`);
  return json.data;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ── PeachFile ────────────────────────────────────────────────────────────

async function fetchPeachFile() {
  const cycles = (await peach("PublicLookup/GetElectionLookup", {})).filter((e) => String(e.code) === String(CYCLE));
  console.log(`  PeachFile ${CYCLE} cycles: ${cycles.map((c) => c.name).join("; ")}`);
  const rows = [];
  for (const cycle of cycles) {
    for (let page = 1; ; page++) {
      const data = await peach("PublicFilerDetails/GetCandidateDetails", { pageNumber: page, pageSize: PAGE, filerTypeCode: "CAN", electionCycle: String(cycle.value) });
      const items = data?.items ?? [];
      rows.push(...items);
      if (items.length < PAGE) break;
      await sleep(250);
    }
  }
  const unique = [...new Map(rows.map((r) => [r.guid, r])).values()];
  console.log(`  PeachFile: ${unique.length} registrations`);

  let profiles = new Map();
  if (!SKIP_PROFILES) {
    let done = 0;
    const got = await pool(unique, 3, async (r) => {
      try {
        const p = await peach("PublicFilerDetails/GetFilerDetailsById", { filerRegistrationGuid: r.guid });
        if (++done % 200 === 0) console.log(`    ${done}/${unique.length} profiles`);
        await sleep(100);
        return [r.guid, p];
      } catch (err) {
        console.warn(`    profile ${r.guid}: ${err.message}`);
        return [r.guid, null];
      }
    });
    profiles = new Map(got);
  }

  return unique.map((r) => {
    const family = officeFamily(r.office ?? "");
    const byCircuit = CIRCUIT_OFFICES.has(family);
    const p = profiles.get(r.guid);
    const ballot = clean(r.ballotFullName) ?? clean(p?.ballotFullName);
    return {
      source: "ga-gtcfc",
      external_id: `ga-gtcfc:${r.guid}`,
      state: "GA",
      cycle_year: CYCLE,
      election_cycle: r.electionCycleName,
      name: r.filerName,
      ballot_name: ballot,
      first_name: clean(r.candidateFirstName),
      middle_name: clean(r.candidateMiddleName),
      last_name: clean(r.candidateLastName) ?? r.filerName.split(",")[0].trim(),
      party: PARTY[r.partyAffiliation] ?? null,
      office: r.office,
      office_family: family,
      // DAs and superior court judges run by judicial circuit, which the
      // registry gives as the jurisdiction.
      district: byCircuit ? circuitOf(r.jurisdiction) : normalizeDistrict(r.districtName),
      jurisdiction: byCircuit || /^(State|Statewide)$/.test(r.districtType ?? "") ? null : clean(r.jurisdiction),
      registration_status: r.filerStatus,
      committee_name: clean(r.committeeName) ?? clean(p?.committeeName),
      website: null,
      campaign_email: email(p?.candidateCommitteeEmail),
      campaign_phone: phone(p?.candidateCommitteePhone),
      filer_email: email(p?.email),
      filer_phone: phone(p?.phone),
      source_url: PEACH_PROFILE(r.guid),
      fetched_at: new Date(),
      _profile: Boolean(p),
    };
  });
}

// ── FEC ──────────────────────────────────────────────────────────────────

async function fec(path, params) {
  const q = new URLSearchParams({ api_key: process.env.FEC_API_KEY, ...params });
  return (await fetchRetry(`${FEC_API}${path}?${q}`, {}, { label: `fec ${path}` })).json();
}

async function fetchFec() {
  if (!process.env.FEC_API_KEY) {
    console.warn("  FEC_API_KEY not set; skipping federal candidates");
    return [];
  }
  const candidates = [];
  for (const office of ["S", "H"]) {
    for (let page = 1; ; page++) {
      const json = await fec("candidates/search/", { state: "GA", election_year: String(CYCLE), office, per_page: "100", page: String(page) });
      candidates.push(...json.results);
      if (page >= json.pagination.pages) break;
    }
  }
  const rows = [];
  for (const c of candidates) {
    const committeeId = c.principal_committees?.[0]?.committee_id;
    const committee = committeeId ? (await fec(`committee/${committeeId}/`, {})).results?.[0] : null;
    const name = parseRegistryName(c.name);
    rows.push({
      source: "fec",
      external_id: `fec:${c.candidate_id}`,
      state: "GA",
      cycle_year: CYCLE,
      election_cycle: `${CYCLE} federal`,
      name: c.name,
      ballot_name: null,
      first_name: name.givens[0] ?? null,
      middle_name: name.givens.slice(1).join(" ") || null,
      last_name: name.last,
      party: PARTY[c.party] ?? null,
      office: c.office === "S" ? "U.S. Senate" : "U.S. House",
      office_family: c.office === "S" ? "us_senate" : "us_house",
      district: c.office === "S" ? null : normalizeDistrict(c.district),
      jurisdiction: null,
      registration_status: c.candidate_inactive ? "Inactive" : "Active",
      committee_name: committee?.name ?? null,
      website: website(committee?.website),
      campaign_email: email(committee?.email),
      campaign_phone: null, // FEC phones are the treasurer's or custodian's, not a campaign line.
      filer_email: null,
      filer_phone: null,
      source_url: `https://www.fec.gov/data/candidate/${c.candidate_id}/`,
      fetched_at: new Date(),
    });
    await sleep(150);
  }
  console.log(`  FEC: ${rows.length} GA candidates`);
  return rows;
}

// ── matching ─────────────────────────────────────────────────────────────

function toRegistration(row) {
  const names = [parseRegistryName(row.name)];
  if (row.ballot_name) names.push(parseRegistryName(row.ballot_name));
  if (row.first_name && row.last_name) names.push(parseBallotName(`${row.first_name} ${row.last_name}`));
  return {
    id: row.id ?? row.external_id,
    names,
    officeFamily: row.office_family,
    district: row.district,
    jurisdiction: row.jurisdiction,
    active: !/terminated|inactive/i.test(row.registration_status ?? ""),
  };
}

async function loadOptions(pg) {
  const { rows } = await pg.query(
    `select o.id as option_id, o.name, o.party, c.id as contest_id, c.name as contest, c.office, c.scope,
            c.county, c.counties, c.municipality, c.source_election_id, c.level
       from tracked_contest_options o join tracked_contests c on c.id = o.contest_id
      where c.removed_at is null and not c.is_referendum and not o.is_write_in
        and extract(year from c.election_date) = $1`,
    [CYCLE],
  );
  return rows;
}

const countyName = (slug) =>
  slug
    .replace(/-county-ga$/, "")
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function targetFor(o) {
  const family = officeFamily(o.contest) ?? officeFamily(o.office);
  return {
    name: o.name,
    officeFamily: family,
    district: CIRCUIT_OFFICES.has(family) ? circuitOf(o.contest) : contestDistrict(o.contest),
    counties: o.county ? [o.county] : (o.counties ?? []).map(countyName),
    municipality: o.municipality,
    local: o.scope !== "state",
  };
}

function matchAll(options, registrations) {
  const byFamily = new Map();
  for (const r of registrations) {
    const reg = toRegistration(r);
    byFamily.set(reg.officeFamily, [...(byFamily.get(reg.officeFamily) ?? []), reg]);
  }
  const matches = [];
  const tally = {};
  for (const o of options) {
    const target = targetFor(o);
    const result = matchCandidate(target, byFamily.get(target.officeFamily) ?? []);
    const key = `${o.level}:${result.kind}`;
    tally[key] = (tally[key] ?? 0) + 1;
    if (result.kind === "verified" || result.kind === "probable") {
      matches.push({ option_id: o.option_id, candidate_id: result.registrationId, confidence: result.kind, evidence: result.evidence, _o: o });
    }
  }
  return { matches, tally };
}

function printTally(tally) {
  const levels = [...new Set(Object.keys(tally).map((k) => k.split(":")[0]))].sort();
  console.log("  level          verified probable ambiguous   none");
  for (const level of levels) {
    const n = (k) => String(tally[`${level}:${k}`] ?? 0).padStart(8);
    console.log(`  ${level.padEnd(14)}${n("verified")} ${n("probable")} ${n("ambiguous")} ${n("none")}`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  "source", "external_id", "state", "cycle_year", "election_cycle", "name", "ballot_name", "first_name", "middle_name",
  "last_name", "party", "office", "office_family", "district", "jurisdiction", "registration_status", "committee_name",
  "website", "campaign_email", "campaign_phone", "filer_email", "filer_phone", "source_url", "fetched_at",
];

async function main() {
  const pg = DRY_RUN ? null : await connectPg();
  const runId = pg ? await startRun(pg, "ga-candidates") : null;
  try {
    let registrations;
    if (MATCH_ONLY) {
      registrations = (await pg.query("select * from tracked_candidates where state = 'GA' and cycle_year = $1", [CYCLE])).rows;
    } else {
      const [peachRows, fecRows] = await Promise.all([fetchPeachFile(), fetchFec()]);
      let fetched = [...peachRows, ...fecRows];
      if (SKIP_PROFILES && pg) {
        // Keep stored contacts for registrations whose profile wasn't fetched.
        const stored = new Map((await pg.query("select external_id, campaign_email, campaign_phone, filer_email, filer_phone from tracked_candidates")).rows.map((r) => [r.external_id, r]));
        fetched = fetched.map((r) => (r._profile === false && stored.has(r.external_id) ? { ...r, ...stored.get(r.external_id), external_id: r.external_id } : r));
      }
      const withContact = fetched.filter((r) => r.website || r.campaign_email || r.campaign_phone || r.filer_email || r.filer_phone).length;
      console.log(`  ${fetched.length} registrations, ${withContact} with a published contact`);
      if (pg) {
        await upsertRows(pg, "tracked_candidates", COLUMNS, fetched, ["external_id"], { batchSize: 300 });
        registrations = (await pg.query("select * from tracked_candidates where state = 'GA' and cycle_year = $1", [CYCLE])).rows;
      } else registrations = fetched;
    }

    const options = pg ? await loadOptions(pg) : [];
    const { matches, tally } = matchAll(options, registrations);
    console.log(`  ${options.length} candidate options on ${CYCLE} ballots; ${matches.length} matched`);
    printTally(tally);

    if (pg) {
      await pg.query("begin");
      await pg.query(
        `delete from tracked_candidate_matches m using tracked_contest_options o, tracked_contests c
          where m.option_id = o.id and o.contest_id = c.id and extract(year from c.election_date) = $1`,
        [CYCLE],
      );
      if (matches.length) await upsertRows(pg, "tracked_candidate_matches", ["option_id", "candidate_id", "confidence", "evidence"], matches, ["option_id", "candidate_id"], { touchUpdatedAt: false });
      await pg.query("commit");
      await finishRun(pg, runId, { inserted: matches.length, updated: registrations.length });
    }
  } catch (err) {
    if (pg) {
      await pg.query("rollback").catch(() => {});
      await finishRun(pg, runId, { status: "error", error: String(err?.stack ?? err).slice(0, 4000) });
    }
    throw err;
  } finally {
    await pg?.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
