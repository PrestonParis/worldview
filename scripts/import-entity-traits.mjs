// Fills entity_traits (supabase/sql/2026-10-18-entity-traits.sql) for every
// person in the People graph that a published record covers.
//
//   1. Open States    current state legislators' CSVs: gender, birth date,
//                     and the Wikidata QID or Wikipedia article Open
//                     States links for many
//   2. Wikidata QIDs  the crosswalk (Congress), Open States' QIDs, FEC
//                     candidate ids Wikidata records (P1839), and for
//                     commentators and journalists a Wikipedia title
//                     lookup checked against the Wikidata description
//                     (scripts/lib/traits.mjs plausiblePerson). New QIDs
//                     join the crosswalk.
//   3. Wikidata       sex or gender (P21), birth date (P569), birthplace's
//                     country (P19/P17), religion (P140), ethnic group
//                     (P172), English Wikipedia article
//   4. Wikipedia      the article's visible categories — race and
//                     ethnicity, ancestry ("of Irish descent"), religion
//
// The rules turning records into values are in scripts/lib/traits.mjs.
// Each run replaces every row, so a fixed rule or record takes effect on
// the next run. Lookups are cached in backups/.traits-cache.json.
//
// Usage: node scripts/import-entity-traits.mjs [--dry-run] [--states=vt,tx] [--refresh]
//        ENV_FILE=.env.cloud node scripts/import-entity-traits.mjs

import fs from "node:fs";
import path from "node:path";
import { arg, chunk, fetchRetry, flag, parseCsv, runImport, sleep } from "./lib/bulk.mjs";
import { addIdentifiers, describeConflict } from "./lib/entities.mjs";
import {
  ancestryFromCategory,
  ancestryFromEthnicGroup,
  isJewishHeritageCategory,
  plausiblePerson,
  raceFromCategory,
  raceFromEthnicGroup,
  religionFromCategory,
  religionFromWikidata,
  settleReligions,
  sexFromOpenStates,
  sexFromWikidata,
} from "./lib/traits.mjs";

const DRY_RUN = flag("dry-run");
const REFRESH = flag("refresh");
// Wikimedia throttles anonymous-looking agents; name the project.
const UA = "worldview-traits/1.0 (https://worldviewpolitics.com; people-attributes enrichment)";
const CACHE_FILE = path.join("backups", ".traits-cache.json");
const STATE_CODES = (arg("states", "") || "al,ak,az,ar,ca,co,ct,de,fl,ga,hi,id,il,in,ia,ks,ky,la,me,md,ma,mi,mn,ms,mo,mt,ne,nv,nh,nj,nm,ny,nc,nd,oh,ok,or,pa,ri,sc,sd,tn,tx,ut,vt,va,wa,wv,wi,wy,dc,pr")
  .toLowerCase()
  .split(",")
  .filter(Boolean);
const PERSON_TYPES = ["politician", "judge", "pundit", "journalist", "lobbyist", "donor"];
const QID = /^Q\d+$/;

const cache = (() => {
  try {
    return REFRESH ? {} : JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
})();
cache.title ??= {}; // Wikipedia title -> QID | null
cache.facts ??= {}; // QID -> Wikidata facts
cache.categories ??= {}; // Wikipedia title -> [category]
const saveCache = () => {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
};

async function getJson(url, init) {
  const res = await fetchRetry(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...init?.headers } });
  return res.json();
}

async function sparql(query) {
  const res = await fetchRetry("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
    body: "query=" + encodeURIComponent(query),
  });
  const data = await res.json();
  await sleep(300);
  return data.results.bindings;
}

const wdUrl = (qid) => `https://www.wikidata.org/wiki/${qid}`;
const wpUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// ── 1. Open States ───────────────────────────────────────────────────────

async function openStatesRows() {
  const rows = [];
  for (const st of STATE_CODES) {
    const res = await fetchRetry(`https://data.openstates.org/people/current/${st}.csv`).catch(() => null);
    if (!res?.ok) continue;
    for (const r of parseCsv(await res.text())) rows.push({ ...r, st });
  }
  return rows;
}

// ── 2. Wikidata QIDs ─────────────────────────────────────────────────────

async function qidsByFecId() {
  const rows = await sparql("SELECT ?p ?fec WHERE { ?p wdt:P1839 ?fec; wdt:P31 wd:Q5 }");
  return new Map(rows.map((r) => [r.fec.value, r.p.value.split("/").pop()]));
}

// Wikipedia titles -> QIDs, 50 per request, following redirects and
// skipping disambiguation pages. Missing titles map to null.
async function titlesToQids(titles) {
  const missing = [...new Set(titles)].filter((t) => !(t in cache.title));
  for (const batch of chunk(missing, 50)) {
    const params = new URLSearchParams({
      action: "query", format: "json", formatversion: "2", redirects: "1",
      prop: "pageprops", ppprop: "wikibase_item|disambiguation", titles: batch.join("|"),
    });
    const data = await getJson(`https://en.wikipedia.org/w/api.php?${params}`);
    const alias = new Map();
    for (const n of data.query?.normalized ?? []) alias.set(n.to, n.from);
    for (const r of data.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
    for (const t of batch) cache.title[t] = null;
    for (const page of data.query?.pages ?? []) {
      const title = alias.get(page.title) ?? page.title;
      const props = page.pageprops ?? {};
      if (batch.includes(title) && !("disambiguation" in props)) cache.title[title] = props.wikibase_item ?? null;
    }
    await sleep(200);
  }
  return new Map(titles.map((t) => [t, cache.title[t] ?? null]));
}

// Disambiguated article titles a commentator or journalist is likely under
// when their bare name belongs to someone else.
const QUALIFIERS = ["commentator", "political commentator", "journalist", "podcaster", "broadcaster", "television host", "radio host", "comedian", "author", "writer", "activist", "pundit", "YouTuber", "columnist"];

// ── 3. Wikidata facts ────────────────────────────────────────────────────

async function fetchFacts(qids) {
  const missing = qids.filter((q) => !cache.facts[q]);
  for (const [i, batch] of chunk(missing, 150).entries()) {
    const values = batch.map((q) => `wd:${q}`).join(" ");
    const rows = await sparql(`
      SELECT ?p ?human ?desc ?sexLabel ?birth ?countryLabel ?religionLabel ?ethnicLabel ?article WHERE {
        VALUES ?p { ${values} }
        BIND(EXISTS { ?p wdt:P31 wd:Q5 } AS ?human)
        OPTIONAL { ?p schema:description ?desc. FILTER(LANG(?desc) = "en") }
        OPTIONAL { ?p wdt:P21 ?sex }
        OPTIONAL { ?p wdt:P569 ?birth }
        OPTIONAL { ?p wdt:P19/wdt:P17 ?country }
        OPTIONAL { ?p wdt:P140 ?religion }
        OPTIONAL { ?p wdt:P172 ?ethnic }
        OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`);
    const facts = new Map(batch.map((q) => [q, { human: false, description: "", sex: [], birth: [], country: [], religion: [], ethnic: [], article: null }]));
    for (const r of rows) {
      const f = facts.get(r.p.value.split("/").pop());
      if (!f) continue;
      f.human = r.human?.value === "true";
      f.description ||= r.desc?.value ?? "";
      const add = (list, v) => v && !QID.test(v) && !list.includes(v) && list.push(v);
      add(f.sex, r.sexLabel?.value);
      add(f.birth, r.birth?.value?.slice(0, 4));
      add(f.country, r.countryLabel?.value);
      add(f.religion, r.religionLabel?.value);
      add(f.ethnic, r.ethnicLabel?.value);
      if (r.article) f.article ??= decodeURIComponent(r.article.value.split("/wiki/").pop()).replace(/_/g, " ");
    }
    for (const [q, f] of facts) cache.facts[q] = f;
    if (i % 10 === 9) {
      saveCache();
      console.log(`  facts: ${Math.min((i + 1) * 150, missing.length)}/${missing.length}`);
    }
  }
  return new Map(qids.map((q) => [q, cache.facts[q]]));
}

// ── 4. Wikipedia categories ──────────────────────────────────────────────

async function fetchCategories(titles) {
  const missing = titles.filter((t) => !cache.categories[t]);
  for (const [i, batch] of chunk(missing, 50).entries()) {
    const found = new Map(batch.map((t) => [t, []]));
    let cont = {};
    do {
      const params = new URLSearchParams({
        action: "query", format: "json", formatversion: "2", prop: "categories", clshow: "!hidden", cllimit: "max",
        redirects: "1", titles: batch.join("|"), ...cont,
      });
      const data = await getJson(`https://en.wikipedia.org/w/api.php?${params}`);
      // Article titles in the sitelinks can be redirects or differ in case.
      const alias = new Map();
      for (const n of data.query?.normalized ?? []) alias.set(n.to, n.from);
      for (const r of data.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
      for (const page of data.query?.pages ?? []) {
        const title = found.has(page.title) ? page.title : alias.get(page.title);
        if (!title || !found.has(title)) continue;
        for (const c of page.categories ?? []) found.get(title).push(c.title.replace(/^Category:/, ""));
      }
      cont = data.continue ?? null;
      await sleep(100);
    } while (cont);
    for (const [t, cats] of found) cache.categories[t] = cats;
    if (i % 20 === 19) {
      saveCache();
      console.log(`  categories: ${Math.min((i + 1) * 50, missing.length)}/${missing.length}`);
    }
  }
  return new Map(titles.map((t) => [t, cache.categories[t] ?? []]));
}

// ── Main ─────────────────────────────────────────────────────────────────

runImport("import-entity-traits", async (pg) => {
  const { rows: people } = await pg.query(
    `select e.id, e.name, e.type, e.description,
       (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'wikidata') as qid,
       (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'openstates') as openstates,
       array(select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'fec_candidate') as fec
     from entities e where e.type = any($1::text[])`,
    [PERSON_TYPES],
  );
  console.log(`${people.length} people`);
  const qidOf = new Map(people.filter((p) => p.qid).map((p) => [p.id, p.qid]));
  // A QID another entity already holds is a duplicate entity or a bad
  // link (one FEC id on Wikidata points at the wrong member); either way
  // its traits stay with the holder.
  const { rows: held } = await pg.query("select entity_id, value from entity_identifiers where scheme = 'wikidata'");
  const holder = new Map(held.map((r) => [r.value, r.entity_id]));
  const newQids = [];
  const claimQid = (person, qid, how) => {
    if (!qid || qidOf.has(person.id) || holder.has(qid)) return;
    holder.set(qid, person.id);
    qidOf.set(person.id, qid);
    newQids.push({ entityId: person.id, scheme: "wikidata", value: qid, how });
  };

  const traits = [];
  const add = (entityId, trait, value, detail, source, sourceUrl) => traits.push({ entityId, trait, value, detail, source, sourceUrl });

  // 1. Open States.
  const byOpenStates = new Map(people.filter((p) => p.openstates).map((p) => [p.openstates, p]));
  const osRows = await openStatesRows();
  const fromOpenStates = new Map();
  const osArticles = new Map();
  for (const r of osRows) {
    const person = byOpenStates.get(r.id);
    if (!person) continue;
    if (QID.test(r.wikidata ?? "")) claimQid(person, r.wikidata, "openstates");
    // Open States' own links to the legislator's Wikipedia article.
    const article = `${r.links ?? ""};${r.sources ?? ""}`.match(/https?:\/\/en\.wikipedia\.org\/wiki\/([^;#?\s]+)/)?.[1];
    if (article) osArticles.set(person.id, decodeURIComponent(article).replace(/_/g, " "));
    fromOpenStates.set(person.id, { sex: sexFromOpenStates(r.gender), birthYear: /^\d{4}/.test(r.birth_date ?? "") ? r.birth_date.slice(0, 4) : null, st: r.st });
  }
  const osQids = await titlesToQids([...osArticles.values()]);
  for (const [entityId, title] of osArticles) claimQid({ id: entityId }, osQids.get(title), "openstates");
  saveCache();
  console.log(`open states: ${osRows.length} rows, ${fromOpenStates.size} matched, ${osArticles.size} with a Wikipedia article`);

  // 2. QIDs by FEC id, then by name for commentators and journalists.
  const fecQids = await qidsByFecId();
  for (const p of people) for (const fec of p.fec) claimQid(p, fecQids.get(fec), "fec");
  const media = people.filter((p) => (p.type === "pundit" || p.type === "journalist") && !qidOf.has(p.id));
  // The Wikipedia article under the exact name first, then disambiguated
  // titles like "Dave Smith (comedian)" for names a namesake holds. The
  // first candidate whose Wikidata description fits wins.
  const candidatesFor = (p) => [p.name, ...QUALIFIERS.map((q) => `${p.name} (${q})`)];
  const qidByTitle = await titlesToQids(media.flatMap(candidatesFor));
  saveCache();
  const candidateFacts = await fetchFacts([...new Set([...qidByTitle.values()].filter(Boolean))]);
  for (const p of media) {
    const match = candidatesFor(p)
      .map((t) => qidByTitle.get(t))
      .find((q) => q && candidateFacts.get(q)?.human && plausiblePerson(p.description, candidateFacts.get(q).description));
    if (match) claimQid(p, match, "name");
  }
  saveCache();
  const byHow = newQids.reduce((acc, r) => ((acc[r.how] = (acc[r.how] ?? 0) + 1), acc), {});
  console.log(`new QIDs:`, byHow, `· ${media.length} commentators/journalists looked up by name`);

  // 3-4. Facts and categories.
  const facts = await fetchFacts([...new Set(qidOf.values())]);
  saveCache();
  const titles = [...new Set([...facts.values()].map((f) => f?.article).filter(Boolean))];
  const categories = await fetchCategories(titles);
  saveCache();

  for (const p of people) {
    const qid = qidOf.get(p.id);
    const f = qid ? facts.get(qid) : null;
    const os = fromOpenStates.get(p.id);
    const osUrl = os ? `https://open.pluralpolicy.com/data/` : "";
    if (f && !f.human) continue; // a QID that isn't a person (bad crosswalk row)

    const sex = f?.sex.map(sexFromWikidata).find(Boolean);
    if (sex) add(p.id, "sex", sex, f.sex[0], "wikidata", wdUrl(qid));
    else if (os?.sex) add(p.id, "sex", os.sex, "", "openstates", osUrl);

    const birthYear = f?.birth.sort()[0];
    if (birthYear) add(p.id, "birth_year", birthYear, "", "wikidata", wdUrl(qid));
    else if (os?.birthYear) add(p.id, "birth_year", os.birthYear, "", "openstates", osUrl);

    if (!f) continue;
    if (f.country.length === 1) add(p.id, "birth_country", f.country[0], "", "wikidata", wdUrl(qid));

    const race = new Map();
    const ancestry = new Map();
    const religion = new Map();
    for (const label of f.ethnic) {
      const r = raceFromEthnicGroup(label);
      if (r) race.set(r, ["wikidata", label]);
      const a = ancestryFromEthnicGroup(label);
      if (a) ancestry.set(a, ["wikidata", label]);
    }
    for (const label of f.religion) {
      const value = religionFromWikidata(label);
      if (!religion.has(value)) religion.set(value, ["wikidata", label]);
    }
    for (const title of f.article ? categories.get(f.article) ?? [] : []) {
      const r = raceFromCategory(title);
      if (r && !race.has(r)) race.set(r, ["wikipedia", title]);
      for (const a of ancestryFromCategory(title)) if (!ancestry.has(a)) ancestry.set(a, ["wikipedia", title]);
      if (isJewishHeritageCategory(title) && !ancestry.has("Jewish")) ancestry.set("Jewish", ["wikipedia", title]);
      const g = religionFromCategory(title);
      if (g && !religion.has(g)) religion.set(g, ["wikipedia", title]);
    }
    const url = (source) => (source === "wikidata" ? wdUrl(qid) : wpUrl(f.article));
    for (const [value, [source, detail]] of race) add(p.id, "race", value, detail, source, url(source));
    for (const [value, [source, detail]] of ancestry) add(p.id, "ancestry", value, detail, source, url(source));
    for (const value of settleReligions([...religion.keys()])) {
      const [source, detail] = religion.get(value);
      add(p.id, "religion", value, detail, source, url(source));
    }
  }

  const summary = {};
  for (const t of traits) summary[t.trait] = (summary[t.trait] ?? 0) + 1;
  const covered = new Set(traits.map((t) => t.entityId)).size;
  console.log(`${traits.length} trait rows for ${covered} people:`, summary);
  if (DRY_RUN) return { skipped: traits.length };

  const conflicts = await addIdentifiers(pg, newQids);
  for (const c of conflicts.slice(0, 10)) console.warn(`  ! ${describeConflict(c)}`);

  await pg.query("begin");
  try {
    await pg.query("delete from entity_traits");
    for (const batch of chunk(traits, 2000)) {
      await pg.query(
        `insert into entity_traits (entity_id, trait, value, detail, source, source_url)
         select * from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
         on conflict do nothing`,
        ["entityId", "trait", "value", "detail", "source", "sourceUrl"].map((k) => batch.map((t) => t[k])),
      );
    }
    await pg.query("commit");
  } catch (err) {
    await pg.query("rollback");
    throw err;
  }
  return { inserted: traits.length };
});
