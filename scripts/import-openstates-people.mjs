// Imports every current state legislator (Open States per-state CSVs) and
// every current statewide elected executive — governor, lieutenant governor,
// attorney general, secretary of state, ... (openstates/people YAML) — as
// `politician` entities.
//
//   entity props   openstatesId (unique), wikidataId, and the office keys
//                  govLevel='state', govState, govChamber ('upper' | 'lower' |
//                  'legislature' | 'executive'), govDistrict, govOffice —
//                  what src/lib/my-government/state.ts queries.
//   edges          person --serves-in--> "<State> Senate"/"House" org
//                  person --holds-office--> "Governor of <State>" etc.
//
// Matching: by openstatesId, then wikidataId. Never by name — state
// legislators share names with members of Congress and each other.
// A person no longer in the current files keeps their entity; only their
// edges' validTo and govOffice are cleared.
//
// Source: Open States (CC0), https://open.pluralpolicy.com/data/ — no key.
//
// Usage:
//   node scripts/import-openstates-people.mjs [--states=tx,fl] [--skip-executives]
//   ENV_FILE=.env.cloud node scripts/import-openstates-people.mjs

import { load as loadYaml } from "js-yaml";
import {
  arg,
  chunk,
  connectNeo4j,
  fetchJson,
  fetchRetry,
  flag,
  parseCsv,
  runImport,
} from "./lib/bulk.mjs";

const STATES = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
  pr: "Puerto Rico",
};

// Chamber org names. Defaults cover most states; overrides where the lower
// chamber isn't "House of Representatives".
const LOWER_NAME = {
  ca: "Assembly", ny: "Assembly", nv: "Assembly", nj: "General Assembly", wi: "Assembly",
  md: "House of Delegates", va: "House of Delegates", wv: "House of Delegates",
};
const chamberOrg = (st, chamber) => {
  const state = STATES[st];
  if (chamber === "upper") return `${state} Senate`;
  if (chamber === "legislature") return st === "dc" ? "Council of the District of Columbia" : `${state} Legislature`;
  return `${state} ${LOWER_NAME[st] ?? "House of Representatives"}`;
};

const titleCase = (s) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, "of");

const ONLY = arg("states", "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const STATE_CODES = Object.keys(STATES).filter((s) => !ONLY.length || ONLY.includes(s));
const TODAY = new Date().toISOString().slice(0, 10);

const blankProfile = {
  biography: "", imageUrl: "", websiteUrl: "", xUrl: "", facebookUrl: "",
  instagramUrl: "", youtubeUrl: "", linkedinUrl: "", highlights: "",
};

function legislatorRow(st, r) {
  const firstLink = (r.links || "").split(";").filter(Boolean)[0] ?? "";
  return {
    openstatesId: r.id,
    wikidataId: r.wikidata || null,
    name: r.name,
    description: `${STATES[st]} state ${r.current_chamber === "upper" ? "senator" : r.current_chamber === "legislature" ? "legislator" : "representative"}${r.current_district ? `, district ${r.current_district}` : ""} (${r.current_party}).`,
    govState: st.toUpperCase(),
    govChamber: r.current_chamber,
    govDistrict: r.current_district,
    govOffice: r.current_chamber === "upper" ? "State senator" : r.current_chamber === "legislature" ? "State legislator" : "State representative",
    party: r.current_party,
    email: r.email,
    phone: r.capitol_voice || r.district_voice,
    imageUrl: r.image || "",
    websiteUrl: firstLink,
    xUrl: r.twitter ? `https://x.com/${r.twitter}` : "",
    facebookUrl: r.facebook ? `https://www.facebook.com/${r.facebook}` : "",
    instagramUrl: r.instagram ? `https://www.instagram.com/${r.instagram}` : "",
    youtubeUrl: r.youtube ? `https://www.youtube.com/${r.youtube}` : "",
    org: chamberOrg(st, r.current_chamber),
    relType: "serves-in",
    label: "serves in",
    role: r.current_district ? `District ${r.current_district}` : "Member",
  };
}

async function fetchExecutives(states) {
  // One tree listing (unauthenticated GitHub API) instead of a call per state.
  const tree = await fetchJson(
    "https://api.github.com/repos/openstates/people/git/trees/main?recursive=1",
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (tree.truncated) console.log("  warning: GitHub tree listing truncated");
  const paths = tree.tree
    .map((t) => t.path)
    .filter((p) => /^data\/[a-z]{2}\/executive\/.+\.yml$/.test(p))
    .filter((p) => states.includes(p.split("/")[1]));
  console.log(`  ${paths.length} executive files`);
  const out = [];
  for (const batch of chunk(paths, 16)) {
    const docs = await Promise.all(
      batch.map(async (p) => {
        const res = await fetchRetry(`https://raw.githubusercontent.com/openstates/people/main/${p}`);
        return [p.split("/")[1], loadYaml(await res.text())];
      }),
    );
    for (const [st, doc] of docs) {
      const role = (doc.roles ?? []).find(
        (r) => !["upper", "lower", "legislature"].includes(r.type) && (!r.end_date || r.end_date >= TODAY),
      );
      if (!role) continue;
      const office = `${titleCase(role.type)}`;
      const wikidata = (doc.other_identifiers ?? []).find((i) => i.scheme === "wikidata")?.identifier;
      out.push({
        openstatesId: doc.id,
        wikidataId: wikidata ?? null,
        name: doc.name,
        description: `${office} of ${STATES[st]}${doc.party?.[0]?.name ? ` (${doc.party[0].name})` : ""}.`,
        govState: st.toUpperCase(),
        govChamber: "executive",
        govDistrict: "",
        govOffice: office,
        party: doc.party?.[0]?.name ?? "",
        email: doc.email ?? "",
        phone: doc.offices?.find((o) => o.voice)?.voice ?? "",
        imageUrl: doc.image ?? "",
        websiteUrl: doc.links?.[0]?.url ?? "",
        xUrl: "", facebookUrl: "", instagramUrl: "", youtubeUrl: "",
        org: `${office} of ${STATES[st]}`,
        relType: "holds-office",
        label: "holds office",
        role: office,
        validFrom: role.start_date ?? "",
      });
    }
  }
  return out;
}

await runImport("openstates-people", async () => {
  console.log(`Open States people — ${STATE_CODES.length} jurisdictions`);
  const people = [];
  for (const st of STATE_CODES) {
    const res = await fetchRetry(`https://data.openstates.org/people/current/${st}.csv`).catch(() => null);
    if (!res) {
      console.log(`  ${st}: no file`);
      continue;
    }
    const rows = parseCsv(await res.text()).filter((r) => r.id && r.name);
    people.push(...rows.map((r) => legislatorRow(st, r)));
  }
  console.log(`  ${people.length} legislators`);
  if (!flag("skip-executives")) people.push(...(await fetchExecutives(STATE_CODES)));
  console.log(`  ${people.length} people total`);

  const driver = connectNeo4j();
  const session = driver.session();
  try {
    await session.run(
      "CREATE CONSTRAINT entity_openstates_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.openstatesId IS UNIQUE",
    );
    await session.run("CREATE INDEX entity_govState IF NOT EXISTS FOR (e:Entity) ON (e.govState)");

    // Link to an existing entity by wikidataId first (e.g. a governor who
    // was already in the graph), so the MERGE below doesn't duplicate them.
    await session.run(
      `UNWIND $rows AS p
       WITH p WHERE p.wikidataId IS NOT NULL
       MATCH (e:Entity {wikidataId: p.wikidataId}) WHERE e.openstatesId IS NULL
       SET e.openstatesId = p.openstatesId`,
      { rows: people },
    );

    // Clear current-office keys first; the upsert re-sets them for everyone
    // still current, so departed officials drop out of My Government.
    await session.run(
      `MATCH (e:Entity) WHERE e.govLevel = 'state'
       SET e.govOffice = null, e.govChamber = null, e.govDistrict = null`,
    );

    let n = 0;
    for (const batch of chunk(people, 500)) {
      await session.run(
        `UNWIND $rows AS p
         MERGE (e:Entity {openstatesId: p.openstatesId})
         ON CREATE SET e.id = randomUUID(), e.type = 'politician', e.createdAt = datetime(),
           e += $blank, e.name = p.name, e.description = p.description
         SET e.govLevel = 'state', e.govState = p.govState, e.govChamber = p.govChamber,
             e.govDistrict = p.govDistrict, e.govOffice = p.govOffice,
             e.wikidataId = coalesce(e.wikidataId, p.wikidataId),
             e.metadata = CASE WHEN coalesce(e.metadata, '') = '' OR e.metadata CONTAINS '"source":"openstates"'
               THEN p.metadata ELSE e.metadata END,
             e.imageUrl = CASE WHEN coalesce(e.imageUrl, '') = '' THEN p.imageUrl ELSE e.imageUrl END,
             e.websiteUrl = CASE WHEN coalesce(e.websiteUrl, '') = '' THEN p.websiteUrl ELSE e.websiteUrl END,
             e.xUrl = CASE WHEN coalesce(e.xUrl, '') = '' THEN p.xUrl ELSE e.xUrl END,
             e.facebookUrl = CASE WHEN coalesce(e.facebookUrl, '') = '' THEN p.facebookUrl ELSE e.facebookUrl END,
             e.instagramUrl = CASE WHEN coalesce(e.instagramUrl, '') = '' THEN p.instagramUrl ELSE e.instagramUrl END,
             e.youtubeUrl = CASE WHEN coalesce(e.youtubeUrl, '') = '' THEN p.youtubeUrl ELSE e.youtubeUrl END,
             e.govEmail = p.email, e.govPhone = p.phone, e.govParty = p.party,
             e.updatedAt = datetime()
         MERGE (o:Entity {type: 'organization', name: p.org})
         ON CREATE SET o.id = randomUUID(), o.createdAt = datetime(), o += $blank,
           o.description = 'U.S. state government body.', o.metadata = '{"source":"openstates"}'
         SET o.updatedAt = datetime()
         MERGE (e)-[r:RELATED_TO {sourceKey: 'openstates:' + p.openstatesId + ':' + p.relType + ':' + p.org}]->(o)
         ON CREATE SET r.id = randomUUID(), r.createdAt = datetime(),
           r.validFrom = coalesce(p.validFrom, $today)
         SET r.relType = p.relType, r.label = p.label, r.role = p.role, r.validTo = '',
             r.notes = '', r.sourceRecordId = '', r.updatedAt = datetime()`,
        {
          rows: batch.map((p) => ({ ...p, metadata: JSON.stringify({ source: "openstates", party: p.party }) })),
          blank: blankProfile,
          today: TODAY,
        },
      );
      n += batch.length;
      process.stdout.write(`\r  upserted ${n}/${people.length}`);
    }
    console.log();

    const keys = people.map((p) => `openstates:${p.openstatesId}:${p.relType}:${p.org}`);
    const closed = await session.run(
      `MATCH ()-[r:RELATED_TO]->() WHERE r.sourceKey STARTS WITH 'openstates:'
         AND NOT r.sourceKey IN $keys AND coalesce(r.validTo, '') = ''
       SET r.validTo = $today RETURN count(r) AS n`,
      { keys, today: TODAY },
    );
    console.log(`  ${closed.records[0].get("n").toNumber()} former seats closed`);
    return { inserted: people.length };
  } finally {
    await session.close();
    await driver.close();
  }
});
