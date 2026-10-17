// Builds the race skeleton for a current election cycle (default 2026):
// one `elections` row per Senate / Governor / House seat on the ballot, an
// incumbent `candidacies` row for each, and — unless --no-fec — a `filed`
// candidacy for every FEC candidate who has raised money this cycle.
//
// Sources:
//   • Senate + House seats & incumbents: unitedstates/congress-legislators
//     (`legislators-current.yaml`), same crosswalk backfill:members uses.
//   • Senate specials: hardcoded (FL — Moody, OH — Husted; both appointed
//     and running in 2026). Update SPECIAL_SENATE when appointments change.
//   • Governor seats & incumbents: data/elections/2026-governors.csv.
//   • Challengers/open-seat candidates: OpenFEC /candidates/ (federal only).
//
// Idempotent: elections key on `cycle:<year>:<office>:<jur>`, incumbent
// candidacies on `cycle:<year>:inc:<bioguide>`, FEC candidacies on the
// (election, entity) pair. Re-runs update, never duplicate.
//
// Usage:
//   npm run scaffold:cycle
//   npm run scaffold:cycle -- --year=2026 --offices=senate,governor --dry-run
//   npm run scaffold:cycle -- --no-fec           (skeleton only)
//
// Needs FEC_API_KEY in .env.local for the challenger pass (skip with --no-fec).

process.loadEnvFile(".env.local");

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { addIdentifiers, upsertEntities } from "./lib/entities.mjs";
import { load as loadYaml } from "js-yaml";

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const DRY_RUN = process.argv.includes("--dry-run");
const NO_FEC = process.argv.includes("--no-fec");
const YEAR = Number(arg("year", "2026"));
const OFFICES = new Set(
  arg("offices", "senate,governor,house").split(",").map((s) => s.trim()),
);
const ELECTION_DATE = `${YEAR}-11-03T00:00:00Z`;

const LEGIS_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const FEC_DELAY = FEC_API_KEY === "DEMO_KEY" ? 4000 : 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Appointed senators running for the balance of a term in 2026.
const SPECIAL_SENATE = [
  { state: "Florida", state_po: "FL", name: "Ashley Moody", party: "Republican" },
  { state: "Ohio", state_po: "OH", name: "Jon Husted", party: "Republican" },
];

const STATE_NAME = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const STATES = new Set(Object.keys(STATE_NAME));
const HOUSE_SEATS = {
  AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,FL:28,GA:14,HI:2,ID:2,IL:17,IN:9,IA:4,
  KS:4,KY:6,LA:6,ME:2,MD:8,MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,
  NM:3,NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,SD:1,TN:9,TX:38,UT:4,
  VT:1,VA:11,WA:10,WV:2,WI:8,WY:1,
};

// ── helpers ──────────────────────────────────────────────────────────────
function parseCsv(raw) {
  const [head, ...lines] = raw.trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const vals = l.split(",");
    return Object.fromEntries(cols.map((c, i) => [c.trim(), (vals[i] ?? "").trim()]));
  });
}

function nameKey(name) {
  // "Robert B. Aderholt" / "Aderholt, Robert" → "robert aderholt"
  let s = name.replace(/"+/g, " ").replace(/\s+/g, " ").trim();
  let first;
  let last;
  if (s.includes(",")) {
    const [l, r] = s.split(",");
    last = l.trim();
    first = (r ?? "").trim().split(" ")[0] ?? "";
  } else {
    const parts = s.split(" ");
    last = parts.pop();
    first = parts[0] ?? "";
  }
  const norm = (x) => x.toLowerCase().replace(/[^a-z]/g, "");
  return `${norm(first)} ${norm(last)}`.trim();
}

function houseJur(po, district) {
  const d = String(district);
  return `${po}-${d === "0" ? "AL" : d.padStart(2, "0")}`;
}

async function fecCandidates(office) {
  const out = [];
  let page = 1;
  let pages = 1;
  do {
    const url = new URL("https://api.open.fec.gov/v1/candidates/");
    url.searchParams.set("api_key", FEC_API_KEY);
    url.searchParams.set("election_year", String(YEAR));
    url.searchParams.set("office", office); // "S" | "H"
    url.searchParams.set("has_raised_funds", "true");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FEC ${office} p${page} → ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.results);
    pages = json.pagination.pages;
    page++;
    await sleep(FEC_DELAY);
  } while (page <= pages);
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `Scaffolding ${YEAR} — ${[...OFFICES].join(", ")}${NO_FEC ? " (no FEC)" : ""}${DRY_RUN ? "  [DRY RUN]" : ""}`,
  );

  const legis = loadYaml(await (await fetch(LEGIS_URL)).text());
  const current = (l) => l.terms[l.terms.length - 1];
  const senators = legis.filter((l) => current(l).type === "sen");
  const reps = legis.filter((l) => current(l).type === "rep");
  console.log(`  crosswalk: ${senators.length} senators, ${reps.length} reps`);

  const govRows = OFFICES.has("governor")
    ? parseCsv(fs.readFileSync("data/elections/2026-governors.csv", "utf8"))
    : [];

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const report = {
    elections: 0,
    incumbents: 0,
    fecCandidacies: 0,
    entitiesCreated: [],
    ambiguous: [],
    fecUnmatched: [],
  };

  // Entity index: by bioguide, and by name key.
  const { rows: politicians } = await pg.query(
    `select e.id, e.name, i.value as bio from entities e
     left join entity_identifiers i on i.entity_id = e.id and i.scheme = 'bioguide'
     where e.type = 'politician'`,
  );
  const byBio = new Map();
  const byName = new Map();
  for (const r of politicians) {
    const id = r.id;
    if (r.bio) byBio.set(r.bio, id);
    const k = nameKey(r.name);
    if (k) (byName.get(k) ?? byName.set(k, []).get(k)).push(id);
  }

  async function resolveEntity({ bioguide, name, party, meta }) {
    if (bioguide && byBio.has(bioguide)) return byBio.get(bioguide);
    const k = nameKey(name);
    const hits = byName.get(k) ?? [];
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      report.ambiguous.push({ name, key: k, matches: hits.length });
      return null;
    }
    const id = randomUUID();
    if (!DRY_RUN) {
      await upsertEntities(pg, [
        {
          id,
          type: "politician",
          name,
          description: `${YEAR} candidate — imported by scaffold-cycle.`,
          metadata: JSON.stringify({ source: "scaffold-cycle", party, ...meta }),
        },
      ]);
      if (bioguide) await addIdentifiers(pg, [{ entityId: id, scheme: "bioguide", value: bioguide }]);
    }
    if (bioguide) byBio.set(bioguide, id);
    (byName.get(k) ?? byName.set(k, []).get(k)).push(id);
    report.entitiesCreated.push(name);
    return id;
  }

  async function upsertElection(e) {
    if (DRY_RUN) {
      report.elections++;
      return "00000000-0000-0000-0000-000000000000";
    }
    const { rows } = await pg.query(
      `INSERT INTO elections
         (id, name, office, jurisdiction, level, election_type, status,
          election_date, cycle, seat_class, open_seat, external_id, notes)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,'scheduled',$6,$7,$8,$9,$10,$11)
       ON CONFLICT (external_id) DO UPDATE SET
         name=EXCLUDED.name, open_seat=EXCLUDED.open_seat,
         seat_class=EXCLUDED.seat_class, cycle=EXCLUDED.cycle, updated_at=now()
       RETURNING id`,
      [e.name, e.office, e.jurisdiction, e.level, e.electionType, ELECTION_DATE,
       YEAR, e.seatClass ?? null, e.openSeat ?? false, e.extId,
       "Scaffolded for the 2026 cycle."],
    );
    report.elections++;
    return rows[0].id;
  }

  async function upsertIncumbentCandidacy(electionId, entityId, party, extId) {
    if (DRY_RUN || !entityId) {
      if (entityId) report.incumbents++;
      return;
    }
    await pg.query(
      `INSERT INTO candidacies
         (id, election_id, candidate_entity_id, party, incumbent, status, external_id)
       VALUES (gen_random_uuid(),$1,$2,$3,true,'nominee',$4)
       ON CONFLICT (election_id, candidate_entity_id) DO UPDATE SET
         incumbent=true, status='nominee',
         party=COALESCE(candidacies.party, EXCLUDED.party)`,
      [electionId, entityId, party || null, extId],
    );
    report.incumbents++;
  }

  // ── Senate ─────────────────────────────────────────────────────────────
  if (OFFICES.has("senate")) {
    const class2 = senators.filter((s) => current(s).class === 2);
    for (const s of class2) {
      const t = current(s);
      const state = STATE_NAME[t.state] ?? t.state;
      const eid = await upsertElection({
        name: `${state} — U.S. Senate ${YEAR}`,
        office: "U.S. Senate", jurisdiction: state, level: "federal",
        electionType: "general", seatClass: 2,
        extId: `cycle:${YEAR}:senate:${t.state}`,
      });
      const entId = await resolveEntity({
        bioguide: s.id.bioguide, name: s.name.official_full, party: t.party,
      });
      await upsertIncumbentCandidacy(eid, entId, t.party, `cycle:${YEAR}:inc:${s.id.bioguide}`);
    }
    for (const sp of SPECIAL_SENATE) {
      const eid = await upsertElection({
        name: `${sp.state} — U.S. Senate ${YEAR} (special)`,
        office: "U.S. Senate", jurisdiction: sp.state, level: "federal",
        electionType: "special",
        extId: `cycle:${YEAR}:senate:${sp.state_po}:special`,
      });
      const entId = await resolveEntity({ name: sp.name, party: sp.party });
      await upsertIncumbentCandidacy(eid, entId, sp.party, `cycle:${YEAR}:inc:special:${sp.state_po}`);
    }
  }

  // ── Governor ───────────────────────────────────────────────────────────
  if (OFFICES.has("governor")) {
    for (const g of govRows) {
      const eid = await upsertElection({
        name: `${g.state} — Governor ${YEAR}`,
        office: "Governor", jurisdiction: g.state, level: "state",
        electionType: "general", openSeat: g.open_seat === "true",
        extId: `cycle:${YEAR}:governor:${g.state_po}`,
      });
      if (g.incumbent_name && g.open_seat !== "true") {
        const entId = await resolveEntity({
          name: g.incumbent_name, party: g.incumbent_party,
        });
        await upsertIncumbentCandidacy(
          eid, entId, g.incumbent_party, `cycle:${YEAR}:inc:gov:${g.state_po}`,
        );
      }
    }
  }

  // ── House ──────────────────────────────────────────────────────────────
  if (OFFICES.has("house")) {
    const scaffolded = new Set();
    for (const rep of reps) {
      const t = current(rep);
      if (!STATES.has(t.state)) continue; // skip territories/DC delegate
      const jur = houseJur(t.state, t.district);
      scaffolded.add(jur);
      const eid = await upsertElection({
        name: `${jur} — U.S. House ${YEAR}`,
        office: "U.S. House", jurisdiction: jur, level: "federal",
        electionType: "general",
        extId: `cycle:${YEAR}:house:${jur}`,
      });
      const entId = await resolveEntity({
        bioguide: rep.id.bioguide, name: rep.name.official_full, party: t.party,
      });
      await upsertIncumbentCandidacy(eid, entId, t.party, `cycle:${YEAR}:inc:${rep.id.bioguide}`);
    }
    // The current-legislators roster omits vacant seats. A federal general
    // election still exists in all 435 districts, so scaffold those seats
    // without inventing an incumbent.
    for (const [state, seats] of Object.entries(HOUSE_SEATS)) {
      for (let district = 1; district <= seats; district++) {
        const jur = houseJur(state, district);
        if (scaffolded.has(jur)) continue;
        await upsertElection({
          name: `${jur} — U.S. House ${YEAR}`,
          office: "U.S. House", jurisdiction: jur, level: "federal",
          electionType: "general", openSeat: true,
          extId: `cycle:${YEAR}:house:${jur}`,
        });
      }
    }
  }

  // ── FEC challenger pass ────────────────────────────────────────────────
  if (!NO_FEC) {
    const offMap = { senate: "S", house: "H" };
    for (const [name, code] of Object.entries(offMap)) {
      if (!OFFICES.has(name)) continue;
      console.log(`  FEC: fetching ${YEAR} ${name} candidates…`);
      const cands = await fecCandidates(code);
      console.log(`    ${cands.length} with funds raised`);
      for (const c of cands) {
        const po = c.state;
        const candIds =
          code === "S"
            ? [`cycle:${YEAR}:senate:${po}`, `cycle:${YEAR}:senate:${po}:special`]
            : [`cycle:${YEAR}:house:${houseJur(po, c.district ?? "0")}`];
        if (DRY_RUN) {
          report.fecCandidacies++;
          continue;
        }
        const { rows } = await pg.query(
          "SELECT id FROM elections WHERE external_id = ANY($1) LIMIT 1",
          [candIds],
        );
        if (rows.length === 0) {
          report.fecUnmatched.push(`${c.name} (${po}${code === "H" ? "-" + c.district : ""})`);
          continue;
        }
        const entId = await resolveEntity({
          name: c.name, party: c.party_full || c.party,
          meta: { fecCandidateId: c.candidate_id },
        });
        if (!entId) continue;
        await pg.query(
          `INSERT INTO candidacies
             (id, election_id, candidate_entity_id, party, incumbent, status, fec_candidate_id, external_id)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,'filed',$5,$6)
           ON CONFLICT (election_id, candidate_entity_id) DO UPDATE SET
             fec_candidate_id=EXCLUDED.fec_candidate_id,
             party=COALESCE(candidacies.party, EXCLUDED.party),
             status=COALESCE(candidacies.status, 'filed')`,
          [
            rows[0].id, entId, c.party_full || c.party || null,
            c.incumbent_challenge === "I",
            c.candidate_id, `cycle:${YEAR}:fec:${c.candidate_id}`,
          ],
        );
        report.fecCandidacies++;
      }
    }
  }

  // Auto-link the prior comparable race. For the Senate that's the same seat
  // six years back (a state has two seats in different classes, so
  // "next-earliest in this state" would grab the *other* seat); for everyone
  // else it's the next-earliest race in the same jurisdiction.
  if (!DRY_RUN) {
    await pg.query(
      `UPDATE elections e SET prior_election_id = p.id, updated_at = now()
       FROM elections p
       WHERE e.cycle = $1 AND e.prior_election_id IS NULL
         AND e.office = 'U.S. Senate' AND p.office = 'U.S. Senate'
         AND p.jurisdiction = e.jurisdiction AND p.cycle = e.cycle - 6`,
      [YEAR],
    );
    await pg.query(
      `UPDATE elections e SET prior_election_id = p.id, updated_at = now()
       FROM elections p
       WHERE e.cycle = $1 AND e.prior_election_id IS NULL AND e.office <> 'U.S. Senate'
         AND p.office = e.office AND p.jurisdiction = e.jurisdiction AND p.id <> e.id
         AND p.election_date = (
           SELECT max(p2.election_date) FROM elections p2
           WHERE p2.office = e.office AND p2.jurisdiction = e.jurisdiction
             AND p2.election_date < e.election_date)`,
      [YEAR],
    );
  }

  console.log("\n--- Summary ---");
  console.log(`Elections upserted:   ${report.elections}`);
  console.log(`Incumbent candidacies:${report.incumbents}`);
  console.log(`FEC candidacies:      ${report.fecCandidacies}`);
  console.log(`Entities created:     ${report.entitiesCreated.length}`);
  console.log(`Ambiguous (skipped):  ${report.ambiguous.length}`);
  console.log(`FEC unmatched seats:  ${report.fecUnmatched.length}`);
  if (report.ambiguous.length) {
    for (const a of report.ambiguous.slice(0, 15)) console.log(`  ? ${a.name} (${a.matches})`);
  }
  if (report.fecUnmatched.length) {
    console.log("  (no scaffolded election for:)");
    for (const u of report.fecUnmatched.slice(0, 15)) console.log(`  - ${u}`);
  }
  if (DRY_RUN) console.log("\nDRY RUN — nothing written.");

  await pg.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
