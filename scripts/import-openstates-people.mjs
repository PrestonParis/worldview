// Imports every current state legislator (Open States per-state CSVs) and
// every current statewide elected executive — governor, lieutenant governor,
// attorney general, secretary of state, ... (openstates/people YAML) — as
// `politician` entities.
//
//   crosswalk      openstates (unique) and wikidata ids
//   entity_offices source 'openstates', level 'state', with state, chamber
//                  ('upper' | 'lower' | 'legislature' | 'executive'),
//                  district, office, party, email, phone — what
//                  src/lib/my-government/state.ts queries.
//   edges          person --serves-in--> "<State> Senate"/"House" org
//                  person --holds-office--> "Governor of <State>" etc.
//
// Matching: by openstatesId, then wikidataId. Never by name — state
// legislators share names with members of Congress and each other.
// A person no longer in the current files keeps their entity; only their
// edges' validTo and their office row's office/chamber/district are cleared.
//
// Source: Open States (CC0), https://open.pluralpolicy.com/data/ — no key.
//
// Usage:
//   node scripts/import-openstates-people.mjs [--states=tx,fl] [--skip-executives]
//   ENV_FILE=.env.cloud node scripts/import-openstates-people.mjs

import { load as loadYaml } from "js-yaml";
import { randomUUID } from "node:crypto";
import {
  arg,
  chunk,
  fetchJson,
  fetchRetry,
  flag,
  parseCsv,
  runImport,
} from "./lib/bulk.mjs";
import { addIdentifiers, entityIdMap, upsertEdges, upsertEntities, upsertOffices } from "./lib/entities.mjs";

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

await runImport("openstates-people", async (pg) => {
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

  // Match by Open States id, then by Wikidata id for an entity that has no
  // Open States id yet (e.g. a governor who was already in the graph).
  const byOpenstates = await entityIdMap(pg, "openstates");
  const byWikidata = await entityIdMap(pg, "wikidata");
  const linked = new Set(byOpenstates.values());
  const ids = new Map();
  for (const p of people) {
    let id = byOpenstates.get(p.openstatesId);
    if (!id && p.wikidataId) {
      const candidate = byWikidata.get(p.wikidataId);
      if (candidate && !linked.has(candidate)) id = candidate;
    }
    if (id) linked.add(id);
    ids.set(p.openstatesId, id ?? null);
  }

  const metadataOf = (p) => JSON.stringify({ source: "openstates", party: p.party });
  const created = people.filter((p) => !ids.get(p.openstatesId));
  for (const p of created) ids.set(p.openstatesId, randomUUID());
  await upsertEntities(
    pg,
    created.map((p) => ({
      id: ids.get(p.openstatesId),
      type: "politician",
      name: p.name,
      description: p.description,
      image_url: p.imageUrl,
      website_url: p.websiteUrl,
      x_url: p.xUrl,
      facebook_url: p.facebookUrl,
      instagram_url: p.instagramUrl,
      youtube_url: p.youtubeUrl,
      metadata: metadataOf(p),
    })),
  );
  // Existing entities: refresh metadata this importer wrote and fill blank
  // profile links; hand-edited values stay.
  const existing = people.filter((p) => !created.includes(p));
  for (const batch of chunk(existing, 500)) {
    await pg.query(
      `update entities e set
         metadata = case when e.metadata = '' or e.metadata like '%"source":"openstates"%' then u.metadata else e.metadata end,
         image_url = case when e.image_url = '' then u.image_url else e.image_url end,
         website_url = case when e.website_url = '' then u.website_url else e.website_url end,
         x_url = case when e.x_url = '' then u.x_url else e.x_url end,
         facebook_url = case when e.facebook_url = '' then u.facebook_url else e.facebook_url end,
         instagram_url = case when e.instagram_url = '' then u.instagram_url else e.instagram_url end,
         youtube_url = case when e.youtube_url = '' then u.youtube_url else e.youtube_url end,
         updated_at = now()
       from jsonb_to_recordset($1::jsonb) as u(id uuid, metadata text, image_url text, website_url text,
                                                x_url text, facebook_url text, instagram_url text, youtube_url text)
       where e.id = u.id
         and (e.metadata, e.image_url, e.website_url, e.x_url, e.facebook_url, e.instagram_url, e.youtube_url)
             is distinct from (
               case when e.metadata = '' or e.metadata like '%"source":"openstates"%' then u.metadata else e.metadata end,
               case when e.image_url = '' then u.image_url else e.image_url end,
               case when e.website_url = '' then u.website_url else e.website_url end,
               case when e.x_url = '' then u.x_url else e.x_url end,
               case when e.facebook_url = '' then u.facebook_url else e.facebook_url end,
               case when e.instagram_url = '' then u.instagram_url else e.instagram_url end,
               case when e.youtube_url = '' then u.youtube_url else e.youtube_url end)`,
      [JSON.stringify(batch.map((p) => ({
        id: ids.get(p.openstatesId),
        metadata: metadataOf(p),
        image_url: p.imageUrl,
        website_url: p.websiteUrl,
        x_url: p.xUrl,
        facebook_url: p.facebookUrl,
        instagram_url: p.instagramUrl,
        youtube_url: p.youtubeUrl,
      })))],
    );
  }
  await addIdentifiers(pg, people.flatMap((p) => [
    { entityId: ids.get(p.openstatesId), scheme: "openstates", value: p.openstatesId },
    { entityId: ids.get(p.openstatesId), scheme: "wikidata", value: p.wikidataId },
  ]));

  // Only the states imported this run are cleared and closed (--states).
  const importedStates = STATE_CODES.map((st) => st.toUpperCase());

  // Clear current-office keys and re-set them for everyone still current in
  // one transaction, so departed officials drop out of My Government
  // without the lookup ever seeing an empty state.
  await pg.query("begin");
  try {
    await pg.query(
      "update entity_offices set office = null, chamber = null, district = null where source = 'openstates' and state = any($1::text[])",
      [importedStates],
    );
    await upsertOffices(pg, "openstates", people.map((p) => ({
      entity_id: ids.get(p.openstatesId),
      level: "state",
      state: p.govState,
      chamber: p.govChamber,
      district: p.govDistrict,
      office: p.govOffice,
      party: p.party,
      email: p.email,
      phone: p.phone,
    })));
    await pg.query("commit");
  } catch (err) {
    await pg.query("rollback");
    throw err;
  }

  // Chamber and office organizations, found by name.
  const orgNames = [...new Set(people.map((p) => p.org))];
  const { rows: orgRows } = await pg.query(
    "select distinct on (name) id, name from entities where type = 'organization' and name = any($1::text[]) order by name, created_at",
    [orgNames],
  );
  const orgs = new Map(orgRows.map((r) => [r.name, r.id]));
  const newOrgs = orgNames.filter((name) => !orgs.has(name)).map((name) => ({ id: randomUUID(), name }));
  await upsertEntities(pg, newOrgs.map((o) => ({
    id: o.id,
    type: "organization",
    name: o.name,
    description: "U.S. state government body.",
    metadata: '{"source":"openstates"}',
  })));
  for (const o of newOrgs) orgs.set(o.name, o.id);

  const edges = people.map((p) => ({
    source_key: `openstates:${p.openstatesId}:${p.relType}:${p.org}`,
    source_entity_id: ids.get(p.openstatesId),
    target_entity_id: orgs.get(p.org),
    rel_type: p.relType,
    label: p.label,
    role: p.role,
    valid_from: p.validFrom || TODAY,
    valid_to: "",
  }));
  await upsertEdges(pg, edges);
  console.log(`  ${created.length} people and ${newOrgs.length} organizations created, ${existing.length} updated`);

  const closed = await pg.query(
    `update entity_edges set valid_to = $2, updated_at = now()
     where source_key like 'openstates:%' and not (source_key = any($1::text[])) and valid_to = ''
       and source_entity_id in (
         select entity_id from entity_offices where source = 'openstates' and state = any($3::text[]))`,
    [edges.map((e) => e.source_key), TODAY, importedStates],
  );
  console.log(`  ${closed.rowCount} former seats closed`);
  return { inserted: created.length, updated: existing.length };
});
