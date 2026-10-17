// Brings a cycle's races up to date from Wikipedia's overview pages:
// general-election candidates (who the nominees actually are), whether the
// incumbent is running (open seats), and the latest Cook / Inside Elections /
// Sabato ratings. Covers Senate (incl. specials), governors, and every House
// district. Parsing lives in scripts/lib/wiki-races.mjs.
//
// Writes:
//   candidacies   one 'nominee' row per general-election candidate (matched
//                 to an existing politician entity, else a new one); earlier
//                 nominee rows no longer on the ballot become 'withdrew', a
//                 retiring incumbent's row becomes 'not_running'
//   elections     open_seat
//   race_ratings  source cook / inside-elections / sabato, keyed like
//                 scripts/import-race-ratings.mjs (rating:<source>:<race>:<asOf>)
//
// Re-runnable: everything is keyed, a second run with the same pages is a
// no-op apart from updated_at.
//
// Usage:
//   node scripts/sync-wiki-races.mjs [--year=2026] [--dry-run]
//   ENV_FILE=.env.cloud node scripts/sync-wiki-races.mjs

import { randomUUID } from "node:crypto";
import { arg, fetchJson, flag, runImport, STATE_NAME_TO_ABBR } from "./lib/bulk.mjs";
import { upsertEntities } from "./lib/entities.mjs";
import { parseRaceRow, parseRatingsTable, tableAfter, tableRows } from "./lib/wiki-races.mjs";

const YEAR = Number(arg("year", "2026"));
const DRY_RUN = flag("dry-run");
const SOURCE_URL = {
  cook: "https://www.cookpolitical.com/ratings",
  "inside-elections": "https://insideelections.com/ratings",
  sabato: "https://centerforpolitics.org/crystalball/",
};

async function wikitext(page) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "parse", page, prop: "wikitext", format: "json", formatversion: "2" });
  const data = await fetchJson(url, {}, { label: page });
  if (!data.parse) throw new Error(`Wikipedia page not found: ${page}`);
  return data.parse.wikitext;
}

const races = (table) =>
  table ? tableRows(table).map((cells) => parseRaceRow(cells, STATE_NAME_TO_ABBR)).filter(Boolean) : [];

// Every table from `marker` on (the House page has one per state).
function racesFrom(text, marker) {
  const out = [];
  let from = text.indexOf(marker);
  while (from !== -1) {
    const table = tableAfter(text, "{|", from);
    if (!table) break;
    out.push(...races(table));
    from = text.indexOf(table, from) + table.length;
  }
  return out;
}

// "Dan J. Sullivan Jr." -> { first: "dan", last: "sullivan", key: "dan sullivan" }
function nameParts(name) {
  const tokens = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^(jr|sr|ii|iii|iv)$/.test(token));
  // FEC-style "LAST, FIRST" was already flipped on import, so first/last
  // are the outer tokens. `full` keeps middle names and initials: a match
  // across the whole graph must not merge namesakes (Dan J. vs Dan S.
  // Sullivan); within one race, `first`/`last` are enough.
  const first = tokens[0] ?? "";
  const last = tokens.at(-1) ?? "";
  return { first, last, full: tokens.join(" ") };
}

function sameperson(a, b) {
  const x = nameParts(a);
  const y = nameParts(b);
  if (!x.last || x.last !== y.last) return false;
  return x.first.startsWith(y.first.slice(0, 3)) || y.first.startsWith(x.first.slice(0, 3));
}

// Raw FEC names ("OSSOFF, T. JONATHAN") read badly; Wikipedia's is better.
const looksRaw = (name) => Boolean(name) && (name.includes(",") || name === name.toUpperCase());

await runImport("wikipedia-races", async (pg) => {
  console.log(`Wikipedia races ${YEAR}${DRY_RUN ? " (dry run)" : ""}`);
  const [senate, governors, house, houseRatings] = await Promise.all([
    wikitext(`${YEAR} United States Senate elections`),
    wikitext(`${YEAR} United States gubernatorial elections`),
    wikitext(`${YEAR} United States House of Representatives elections`),
    wikitext(`${YEAR} United States House of Representatives election ratings`),
  ]);

  const offices = [
    {
      prefix: "senate",
      races: [
        ...races(tableAfter(senate, "=== Elections leading to the next Congress ===")),
        ...races(tableAfter(senate, "=== Special elections during the preceding Congress ===")),
      ],
      ratings: parseRatingsTable(tableAfter(senate, "== Predictions =="), STATE_NAME_TO_ABBR),
    },
    {
      prefix: "governor",
      races: races(tableAfter(governors, "=== States ===")),
      ratings: parseRatingsTable(tableAfter(governors, "== Predictions =="), STATE_NAME_TO_ABBR),
    },
    {
      prefix: "house",
      // State sections only — the "Special elections" table above them lists
      // 2025–26 specials, not this cycle's general.
      races: racesFrom(house, "\n==Alabama=="),
      ratings: parseRatingsTable(tableAfter(houseRatings, "===Latest published ratings"), STATE_NAME_TO_ABBR),
    },
  ];
  for (const office of offices) {
    console.log(`  ${office.prefix}: ${office.races.length} races, ${office.ratings.length} rated`);
  }

  const { rows: electionRows } = await pg.query(
    "SELECT id, external_id FROM elections WHERE cycle = $1 AND external_id LIKE 'cycle:%'",
    [YEAR],
  );
  const electionByExt = new Map(electionRows.map((row) => [row.external_id, row.id]));
  const { rows: candidacyRows } = await pg.query(
    `SELECT c.id, c.election_id, c.candidate_entity_id, c.incumbent, c.status, c.external_id
       FROM candidacies c JOIN elections e ON e.id = c.election_id WHERE e.cycle = $1`,
    [YEAR],
  );
  const candidaciesByElection = new Map();
  for (const row of candidacyRows) {
    candidaciesByElection.set(row.election_id, [...(candidaciesByElection.get(row.election_id) ?? []), row]);
  }

  const counts = {
    races: 0, missingRaces: 0, openSeats: 0, nominees: 0, entitiesCreated: 0,
    entitiesRenamed: 0, retired: 0, redistricted: 0, ratings: 0,
  };
  const { rows: politicians } = await pg.query("select id, name from entities where type = 'politician'");
  const nameById = new Map(politicians.map((p) => [p.id, p.name]));
  const byKey = new Map();
  for (const p of politicians) {
    const key = nameParts(p.name).full;
    byKey.set(key, [...(byKey.get(key) ?? []), p.id]);
  }

  async function createPolitician(candidate, state) {
    const id = randomUUID();
    counts.entitiesCreated += 1;
    if (flag("verbose")) console.log(`    new entity ${state}: ${candidate.name} (${candidate.party})`);
    nameById.set(id, candidate.name);
    if (DRY_RUN) return id;
    await upsertEntities(pg, [
      {
        id,
        type: "politician",
        name: candidate.name,
        description: [candidate.party, `${YEAR} candidate`, state].filter(Boolean).join(" · "),
        metadata: JSON.stringify({
          party: candidate.party || undefined,
          state,
          wikipedia: candidate.link || undefined,
          importedFrom: "wikipedia-races",
        }),
      },
    ]);
    nameById.set(id, candidate.name);
    const key = nameParts(candidate.name).full;
    byKey.set(key, [...(byKey.get(key) ?? []), id]);
    return id;
  }

  // Everyone holding a seat going into the cycle, for telling a member
  // apart from a namesake when the scaffold's incumbent is stale.
  const sitting = new Set(candidacyRows.filter((row) => row.incumbent).map((row) => row.candidate_entity_id));

  // Wikipedia's incumbent for the race -> entity: the scaffold's incumbent
  // when it is the same person, else a unique name match (preferring a
  // sitting member). Redistricting can move members between seats, so the
  // scaffold's row is checked, not trusted.
  function resolveIncumbent(race, existing) {
    if (!race.incumbent) return null;
    // Same seat and same surname is the same member, whatever the first
    // name ("Jim Risch" vs "James E. Risch").
    const scaffolded = existing.find(
      (row) => row.incumbent && nameParts(nameById.get(row.candidate_entity_id) ?? "").last === nameParts(race.incumbent.name).last,
    );
    if (scaffolded) return scaffolded.candidate_entity_id;
    const matches = byKey.get(nameParts(race.incumbent.name).full) ?? [];
    if (matches.length === 1) return matches[0];
    const member = matches.find((id) => sitting.has(id));
    if (member) return member;
    // A member moved by redistricting, stored with a middle initial
    // ("Linda T. Sánchez"): match first + last among sitting members only.
    const sittingMatches = [...sitting].filter((id) => sameperson(nameById.get(id) ?? "", race.incumbent.name));
    return sittingMatches.length === 1 ? sittingMatches[0] : null;
  }

  for (const office of offices) {
    for (const race of office.races) {
      const ext = `cycle:${YEAR}:${office.prefix}:${race.key}`;
      const electionId = electionByExt.get(ext);
      if (!electionId) {
        counts.missingRaces += 1;
        console.log(`    no scaffolded race for ${ext}`);
        continue;
      }
      counts.races += 1;
      const existing = candidaciesByElection.get(electionId) ?? [];
      const incumbentEntityId = resolveIncumbent(race, existing);
      const used = new Set();

      // Which ballot line is the sitting member: by wiki link when any line
      // links to them (keeps Alaska's two Dan Sullivans apart), else by
      // name ("Frank J. Mrvan" for the incumbent "Frank Mrvan").
      const linked = race.incumbent && race.candidates.some((c) => c.link && c.link === race.incumbent.link);
      const isIncumbentLine = (c) =>
        Boolean(race.incumbent) && (linked ? c.link === race.incumbent.link : sameperson(c.name, race.incumbent.name));
      const ordered = [...race.candidates].sort((a, b) => Number(isIncumbentLine(b)) - Number(isIncumbentLine(a)));

      for (const candidate of ordered) {
        let entityId = null;
        if (incumbentEntityId && isIncumbentLine(candidate) && !used.has(incumbentEntityId)) entityId = incumbentEntityId;
        // Loose (first + last) matching only against rows this sync did not
        // create — the scaffold's incumbent and FEC filings. Our own earlier
        // rows must match the full name, so one bad match can't stick.
        entityId ??= existing.find((row) => {
          if (used.has(row.candidate_entity_id) || row.candidate_entity_id === incumbentEntityId) return false;
          const name = nameById.get(row.candidate_entity_id) ?? "";
          return row.external_id?.startsWith("wiki:")
            ? nameParts(name).full === nameParts(candidate.name).full
            : sameperson(name, candidate.name);
        })?.candidate_entity_id ?? null;
        if (!entityId) {
          const matches = (byKey.get(nameParts(candidate.name).full) ?? []).filter((id) => !used.has(id));
          if (matches.length === 1) entityId = matches[0];
        }
        entityId ??= await createPolitician(candidate, race.key.slice(0, 2));
        used.add(entityId);

        const currentName = nameById.get(entityId) ?? "";
        if (looksRaw(currentName) && currentName !== candidate.name) {
          counts.entitiesRenamed += 1;
          if (flag("verbose")) console.log(`    rename ${race.key}: ${currentName} -> ${candidate.name}`);
          if (!DRY_RUN) await pg.query("update entities set name = $2, updated_at = now() where id = $1", [entityId, candidate.name]);
          nameById.set(entityId, candidate.name);
        }

        counts.nominees += 1;
        if (DRY_RUN) continue;
        await pg.query(
          `INSERT INTO candidacies (id, election_id, candidate_entity_id, party, incumbent, status, withdrew, external_id)
           VALUES ($1, $2, $3, $4, $5, 'nominee', false, $6)
           ON CONFLICT (election_id, candidate_entity_id)
           DO UPDATE SET party = EXCLUDED.party, incumbent = EXCLUDED.incumbent, status = 'nominee', withdrew = false`,
          [
            randomUUID(), electionId, entityId, candidate.party || null,
            entityId === incumbentEntityId,
            `wiki:${ext}:${entityId}`,
          ],
        );
      }

      // Rows not on the general-election ballot: a retiring incumbent, an
      // earlier nominee who dropped out, or — after mid-decade redistricting
      // — a member the scaffold placed here who now sits in another seat.
      for (const row of existing) {
        if (used.has(row.candidate_entity_id)) continue;
        if (row.incumbent && incumbentEntityId && row.candidate_entity_id !== incumbentEntityId) {
          counts.redistricted += 1;
          if (!DRY_RUN) await pg.query("UPDATE candidacies SET incumbent = false, status = 'redistricted' WHERE id = $1", [row.id]);
          continue;
        }
        if (!["nominee", "primary_winner"].includes(row.status)) continue;
        const status = row.incumbent ? "not_running" : "withdrew";
        if (row.incumbent) counts.retired += 1;
        if (!DRY_RUN) await pg.query("UPDATE candidacies SET status = $1 WHERE id = $2", [status, row.id]);
      }

      const incumbentRunning = race.candidates.some(isIncumbentLine);
      if (!incumbentRunning) counts.openSeats += 1;
      if (!DRY_RUN) {
        await pg.query("UPDATE elections SET open_seat = $1, updated_at = now() WHERE id = $2", [!incumbentRunning, electionId]);
      }
    }

    for (const { key, ratings } of office.ratings) {
      const ext = `cycle:${YEAR}:${office.prefix}:${key}`;
      const electionId = electionByExt.get(ext);
      if (!electionId) continue;
      for (const { source, rating, asOf } of ratings) {
        counts.ratings += 1;
        if (DRY_RUN) continue;
        await pg.query(
          `INSERT INTO race_ratings (election_id, source, rating, as_of, url, notes, external_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (election_id, source, as_of) DO UPDATE SET rating = EXCLUDED.rating`,
          [
            electionId, source, rating, asOf, SOURCE_URL[source],
            "Transcribed via Wikipedia's ratings table",
            `rating:${source}:${ext}:${asOf}`,
          ],
        );
      }
    }
  }
  console.log("  ", counts);
  return { inserted: counts.nominees + counts.ratings, updated: counts.races };
});
