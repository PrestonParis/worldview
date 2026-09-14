# Elections category — from stub to a tool people can use

## Context

`/elections` ("Elections & Maps") is one of the five surviving tool categories
(`src/lib/nav.ts`). The category *shell* is fully wired — nav entry, a
`pages-content.ts` key, a yellow accent in `src/lib/type-colors.ts`, a `BallotIcon`
in `src/components/home/tool-modules.tsx` — but the page itself
(`src/app/(shell)/elections/page.tsx`) renders only `EmptyStateFeatures`. There is
no data model, no `/data` admin tab, no homepage count, and nothing in `seed.mjs`
or the ingest batch.

An earlier draft of this plan built the data model first and treated data
acquisition as an afterthought ("Phase 1.5"). That produces a schema and empty
screens. This version is reorganized around a single goal: **when the buildable
phases are done, someone who is not the author can open `/elections`, find the
races they care about already loaded, and get something useful without touching
`/data`.** Data loading is promoted to its own first-class phase (Phase 2), and
the phases are ordered so the tool is usable as early as possible.

The build still follows the pattern the **Legislation** (`bills` + `votes`,
commit `d13f7e9`) and **Money** (`contributions`, commits `7986523` / `2d39afc`)
verticals established: Zod validation → Drizzle table → DB access → server actions
→ `/data` CRUD → tool page view → homepage count → seed fixture → ingest support.

## What "usable and good for other people" means here

The bar the phases are held to:

1. **Populated on arrival.** `/elections` holds real U.S. elections — President,
   Senate, House, Governor — for recent cycles, loaded by a re-runnable script,
   not by hand. An empty state is a bug, not a starting condition.
2. **Answers the obvious questions without setup.** "Who won X in year Y, by how
   much, and how did the counties break?" is answerable by clicking, for any
   loaded race.
3. **Shareable.** Every election and every map view has a stable, linkable URL.
   Someone can paste `/elections/<id>?view=swing` into chat and the recipient
   sees the same thing.
4. **Honest.** Provisional vs. certified results are marked. The simulator says
   what it is and is not. Every page carries a data-source line.
5. **Legible.** Maps have a legend; color is never the only signal (margins are
   in the table too); the red/blue scale is a colour-vision-safe one.
6. **Maintainable by someone else.** Re-import is one command, sources are
   documented, and candidate-matching failures surface in a report rather than
   silently corrupting the graph.

## Architecture decisions (resolve before building)

1. **Elections are a Postgres table, not a Neo4j entity type.** Follows `bills`
   exactly — a structured primitive with its own `/data` tab, not a graph node.
   `src/lib/entity-colors.ts` / `src/lib/type-colors.ts` comments already name
   `"election"` as if an entity type were once planned; if elections should be
   pivotable *in the graph* later, mirror each as an `election`-type entity the
   way `scripts/import-fec-donors.mjs` creates committee entities.
   **Recommended: Postgres only for now.**
2. **Candidates are `politician` entities.** A candidacy requires the politician
   to exist first, same as a bill requiring its sponsor. The Phase 2 importer
   creates missing candidate entities as it goes (like the FEC importer). No new
   entity type.
3. **Party is free text + a colour map**, not an enum — parties vary by country
   and era, same reasoning as `bills.chamber`.
4. **Map geometry is static GeoJSON** under `public/data/`, joined to result rows
   by FIPS / GEOID via MapLibre `promoteId` — how `src/lib/map/countryLayers.ts`
   uses `/data/countries.geojson`. No PostGIS.
5. **Stable URLs from day one.** `/elections/<id>` for detail; map state
   (`?view=results|swing`, `?basemap=`, `?area=`) lives in query params so any
   view is linkable. This costs nothing now and makes a future public
   (unlisted-link) read path trivial — the same access-model question the
   Geography Phase 4a doc raised. Until that decision is made, everything stays
   behind the existing `src/proxy.ts` auth wall.
6. **Data attribution is required, not optional.** MIT Election Lab data is
   CC-BY; a `<DataSourceNote>` line ("Results: MIT Election Lab · Boundaries:
   U.S. Census") goes on every election and map view.
7. Every new route needs `next dev` / `next build` to run so
   `PageProps` / `LayoutProps` regenerate (cf. commit `16cc558`). No test runner
   in the repo — verification is `npm run lint`, `next build`, and a manual
   walkthrough.

## Data sources

| Data | Source | Grain | Notes |
|---|---|---|---|
| Presidential returns | MIT Election Lab `countypres_2000-2020` (Harvard Dataverse) | county | ~72k rows, every county, 2000–2020. CC-BY. |
| President / Senate / Governor | MEDSL `1976-2020-*` datasets | state | topline margins for older races |
| House | MEDSL `1976-2022-house` | district | by CD |
| 2022 / 2024 | MEDSL interim files where published; otherwise a one-off official / AP pull | county where available | **lags 6–18 months** — mark as provisional until the certified MEDSL file lands |
| County & district shapes | Census TIGER/Line → simplified with `mapshaper` | polygon | county GEOID = 5-digit FIPS = MEDSL join key |
| County demographics (Phase 5) | Census ACS 5-year; NCHS urban–rural codes | county | income, education, urbanicity for the simulator |

Scope for a usable v1: **U.S. only, four offices, 2000–2024 where available,
county-level results for President + Governor + Senate.** Bounded and genuinely
useful.

---

## Phase 1 — Data model and `/data` CRUD

**Goal:** the schema, the admin surface, and the tool-page components — reviewable
in isolation. `/elections` still shows the empty state at the end of this phase;
Phase 2 fills it.

### Data model — `src/lib/db/schema.ts`

Mirror the `bills` + `votes` pair:

```
electionLevelEnum   = federal | state | local
electionTypeEnum    = general | primary | runoff | special
electionStatusEnum  = scheduled | provisional | certified

elections
  id, name,
  office        (free text: "President", "U.S. Senate", "Governor", "U.S. House"),
  jurisdiction  (free text: "United States", "Wisconsin", "WI-03"),
  level, electionType, status,
  electionDate  (timestamptz, notNull),
  totalVotes    (integer, nullable — denormalized turnout),
  priorElectionId  (uuid, nullable, self-ref — comparable prior race; powers
                    Phase 4. Nullable self-reference like
                    claims.contradictsClaimId),
  parentElectionId (uuid, nullable, self-ref — primary → general),
  externalId    (text, nullable — import idempotency key, like
                 contributions.externalId; null for hand-entered rows),
  notes, createdAt, updatedAt
  uniqueIndex(externalId)

candidacies                       (one row per candidate — the votes-table analog)
  id,
  electionId        -> elections (onDelete cascade),
  candidateEntityId (uuid, non-FK — Neo4j politician entity, like
                     votes.voterEntityId),
  party (free text), incumbent (bool), withdrew (bool),
  votes (integer, nullable), won (bool, default false),
  externalId (text, nullable — import idempotency),
  createdAt,
  uniqueIndex(electionId, candidateEntityId),
  uniqueIndex(externalId),
  index(electionId), index(candidateEntityId)
```

`npm run db:push` (README step 5).

### Files (each mirrors a named existing file)

| New file | Mirrors |
|---|---|
| `src/lib/validation/election.ts` | `validation/bill.ts` — const arrays, `electionSchema`, `Election` |
| `src/lib/validation/candidacy.ts` | `validation/vote.ts` — `candidacySchema`, `Candidacy`, plus `ElectionSummary` (leading candidate + party + margin), the `VoteTally` analog |
| `src/lib/db/elections.ts` | `db/bills.ts` — `toElection`, `listElections` (order by `electionDate desc`), `getElection`, `countElections`, `countElectionsCreatedSince`, `create/update/deleteElection`, `upsertElectionByExternalId` |
| `src/lib/db/candidacies.ts` | `db/votes.ts` — `listCandidaciesForElection`, `listElectionSummariesByElection` (one grouped query, like `listVoteTalliesByBill`), `create/update/deleteCandidacy`, `upsertCandidacyByExternalId` |
| `src/lib/actions/elections.ts` | `actions/bills.ts` — `ActionResult` from `actions/entities.ts`, Zod guard, `revalidatePath("/data")` + `revalidatePath("/elections")` |
| `src/lib/actions/candidacies.ts` | `actions/votes.ts` |
| `src/lib/party-colors.ts` | `entity-colors.ts` — `partyColors` (Democratic `#2166AC`, Republican `#B2182B` — the ColorBrewer RdBu endpoints, colour-vision-safe; Independent / other greys) + `partyColorFor(name)`, never throws |
| `src/components/elections/election-status.tsx` | `legislation/bill-status.tsx` — `StatusPill`, `formatElectionStatus` |
| `src/components/elections/data-source-note.tsx` | new — small muted attribution line, reused on every election view |
| `src/components/forms/election-form.tsx` | `forms/bill-form.tsx` |
| `src/components/forms/candidacies-editor.tsx` | `forms/votes-editor.tsx` |
| `src/components/elections/election-list.tsx` | `legislation/bill-list.tsx` — server component; empty state → `EmptyStateFeatures` with CTA to `/data/elections`, else `<ElectionListView>` |
| `src/components/elections/election-list-view.tsx` | `legislation/bill-list-view.tsx` — `SearchInput` + filter selects (office, level, cycle, status); rows show `office · jurisdiction · date`, winner + margin pill |
| `src/app/(shell)/data/elections/page.tsx` | `data/bills/page.tsx` |
| `src/app/(shell)/data/elections/[id]/edit/page.tsx` | `data/bills/[id]/edit/page.tsx` — `ElectionForm` + `CandidaciesEditor` |
| `src/app/(shell)/elections/[id]/page.tsx` | `legislation/[id]/page.tsx` — header, candidates sorted by votes with party-colour bar + pct + "Winner" marker, each linking to `/data/entities/{id}`; a **Fundraising** panel (reuse `listContributionsForRecipient` per candidate entity — free win from the existing `contributions` table); a "Results by area" section stubbed until Phase 3; `<DataSourceNote>` |

### Edits to existing files

- `src/app/(shell)/elections/page.tsx` — swap the body for
  `<ElectionList content={pagesContent["elections"]} />` +
  `export const dynamic = "force-dynamic"`.
- `src/app/(shell)/data/layout.tsx` — add the `Elections` tab; "six primitives" → seven.
- `src/app/(shell)/page.tsx` + `src/components/home/knowledge-base.tsx` — add
  `countElections` / `countElectionsCreatedSince`; add an "Elections" stat card.
- `scripts/seed.mjs` — add one `certified` fixture election + two candidacies
  (fixed UUIDs, `ON CONFLICT DO NOTHING`) so a from-empty dev DB is coherent.
  Real volume comes from Phase 2, not the seed.
- `src/lib/ingest/batch.ts` + route — add `elections` / `candidacies` arrays
  after `claims`, with `$ref` resolution for `candidateEntityId` / `electionId` /
  `priorElectionId` / `parentElectionId`.

---

## Phase 2 — Load real data (the phase that makes the category exist)

**Goal:** `/elections` holds hundreds of real races and every detail page is
populated. This is the "usable at list + detail level" milestone.

### `scripts/import-elections.mjs`

Mirrors `scripts/import-fec-donors.mjs` in structure (idempotent, resumable,
cache responses under `backups/`, `--dry-run` reports first).

- **Input:** MEDSL CSVs, either committed under `data/elections/` (small,
  versioned topline files) or downloaded to a gitignored cache (the large
  `countypres` file). A `SOURCES.md` in that dir records dataset DOI + version +
  retrieval date.
- **Per row:**
  1. Derive a stable `externalId` — e.g. `medsl:countypres:2020:US:president` for
     the election, `medsl:countypres:2020:US:president:BIDEN` for the candidacy.
  2. **Candidate entity matching.** Normalize the MEDSL candidate name (case,
     punctuation, `LAST, FIRST` → `First Last`, known aliases). Look up an
     existing `politician` entity by normalized name; create one if absent,
     stamping `metadata` with office/party/cycle for later disambiguation.
     Every create and every ambiguous match (>1 candidate entity for a name) is
     written to `backups/<ts>/election-import-report.json` for a human to review
     — never guess silently.
  3. `upsertElectionByExternalId` + `upsertCandidacyByExternalId`.
- **Flags:** `--offices=president,senate,governor,house`, `--cycles=2016,2020,2024`,
  `--dry-run`, `--report-only`.
- **2024:** load from the interim/official file, set `status = provisional`;
  a later re-run against the certified MEDSL file flips it to `certified` with no
  row churn (same `externalId`).

### `npm run` wiring + docs

- `package.json`: `"import:elections": "node scripts/import-elections.mjs"`.
- README "Adding data" section: document the importer alongside the FEC one.
- `scripts/export-db.mjs` already dumps all Postgres tables — confirm `elections`
  / `candidacies` are picked up (they will be, it enumerates tables).

### End-of-phase check

Fresh DB → `npm run import:elections --offices=president,governor --cycles=2012,2016,2020`
→ `/elections` lists ~150+ races → each detail page shows real candidates,
parties, totals, margins, winner → homepage count is in the hundreds →
`election-import-report.json` has zero unresolved ambiguous matches (fix aliases
until it does).

---

## Phase 3 — Results geography (county choropleth)

**Goal:** detail pages show a county-level results map + sortable table for races
that have county data (President, Governor, Senate from MEDSL).

- **New table `election_results`** — `electionId` → elections cascade,
  `candidacyId` → candidacies cascade, `areaKind` enum `county|precinct|district|state`,
  `areaId` (FIPS / GEOID), `areaName`, `votes`, `externalId`,
  `uniqueIndex(candidacyId, areaKind, areaId)`, `index(electionId)`,
  `index(areaId)`. Validation + `db/electionResults.ts` + ingest arrays +
  importer extension (the `countypres` file already has the county rows — same
  pass, extra output).
- **`public/data/us-counties.geojson`** — Census TIGER counties simplified with
  `mapshaper` (target well under a few MB), `promoteId` = GEOID. Document the
  `mapshaper` command in `SOURCES.md`.
- **Shared map primitives first.** Before writing the component, extract the
  source/layer/`feature-state` plumbing from `src/lib/map/countryLayers.ts` into
  `src/lib/map/choroplethLayer.ts` (add source, add fill+line layers,
  `waitForSourceLoaded`, `safeSetFeatureState`). `countryLayers.ts` refactors to
  use it; the elections map is its second consumer. Avoids the copy-paste debt
  the previous draft would have created.
- **`src/components/elections/results-map.tsx`** — standalone MapLibre instance
  (no Konva, no `MapWorkspace`). Fill = winning party colour, opacity scaled by
  margin. Uses `src/lib/map/styles.ts` basemaps. **Legend** (party + margin
  ramp). Click a county → detail row highlights and `?area=<geoid>` updates.
- **`src/components/elections/area-results-table.tsx`** — sortable, mirrors
  `money/contributions-list-view.tsx`; margin shown numerically so colour is not
  the only signal.
- Detail page renders map + table when result rows exist, else keeps the Phase 1
  placeholder.

---

## Phase 4 — Comparison and swing

**Goal:** "how did this race move since last time?" and "how do these two races
compare?"

- **Auto-linked prior race.** A `db/elections.ts` helper resolves the prior
  comparable by `office` + `jurisdiction` + next-earliest `electionDate` when
  `priorElectionId` is null, so swing works across the whole imported set with no
  hand-wiring. `priorElectionId` stays as a manual override.
- **`src/components/elections/swing-map.tsx`** — reuses `results-map` with a
  diverging RdBu scale over `marginₙ − marginₙ₋₁` per county. Legend required.
- **`?view=results|swing`** toggle on the detail page (swing enabled only when a
  prior race with results exists).
- **Compare view** `/elections/compare?a=<id>&b=<id>` — two elections side by
  side: topline margins, a county scatter (margin A vs. margin B), shared-county
  swing summary. Linkable.
- Demographic overlays deferred to Phase 5's data.

---

## Phase 5 — Scenario simulator

**Goal:** "if assumption X changes, what happens?" — explicitly not a forecast
(`sampletools.md` #30).

- **County demographic join.** Import Census ACS county tables + NCHS
  urban–rural codes into a `county_profile` table (`fips`, `population`,
  `median_income`, `pct_college`, `urbanicity`). This is what makes the
  simulator more than a single uniform-swing slider.
- **`src/components/elections/scenario-simulator.tsx`** — client-only, no
  persistence. Sliders: uniform swing, turnout delta, and swing/turnout deltas
  *by urbanicity bucket*. Recomputes the choropleth + topline (state calls,
  electoral votes / seats, popular margin) live via a client `feature-state`
  override on `results-map`.
- Route `/elections/<id>/simulate`, honest framing in the copy.
- Down the line: a scenario map is a natural producer for the Geography plan's
  Phase 4b bindable live values (push to a broadcast presentation view). Noted,
  not built.

---

## Phase 6 — District explorer + gerrymandering viewer (planned, not built)

The speculative frontier — designed now so earlier phases don't foreclose it.

- **`districts` table** (metadata: `code` "WI-03", `chamber`, `jurisdiction`,
  partisan-lean, incumbent `entityId`) + **`district_boundaries`** (versioned
  `current` / `previous` / `proposed`, each → a feature id in a static file under
  `public/data/districts/`).
- **Address / ZIP → district**: static Census ZIP→CD crosswalk + a lookup route.
  A real geocoder is a dependency decision, not a default.
- **Gerrymandering viewer**: the Phase 3 map with independently toggleable
  boundary versions; Polsby-Popper compactness (`@turf/turf`, already a
  dependency); partisan + racial composition side by side.
- **Open questions**: precinct-level data has no national source (per-state at
  best — "precinct explorer" likely stays county-level in practice); proposed-map
  availability varies by state.

---

## Cross-cutting work

- **`src/lib/map/choroplethLayer.ts` extraction** — do it at the start of
  Phase 3, before there are two divergent copies.
- **`data/elections/SOURCES.md`** — dataset DOIs, versions, retrieval dates,
  `mapshaper` commands. Required for CC-BY compliance and for the next person.
- **`<DataSourceNote>`** on every election view (Phase 1).
- **Colour-vision safety** — RdBu endpoints for party, always paired with text;
  every map has a legend.
- **Provisional badge** — `status = provisional` renders a visible marker on the
  list and detail views.
- **Public read path (deferred decision)** — URLs are already stable; if
  `/elections` should be shareable outside the invite list, add an unlisted-link
  read path later (same model as Geography Phase 4a). Not in scope until asked.

---

## Status

- [x] Phase 1 — Data model + `/data` CRUD + tool-page components. Built as designed:
      `elections` + `candidacies` tables (`src/lib/db/schema.ts`), Zod schemas
      (`validation/election.ts`, `validation/candidacy.ts` with the pure
      `summarizeCandidacies` + its vitest), DB access + `upsert*ByExternalId`
      (`db/elections.ts`, `db/candidacies.ts`), server actions, `ElectionForm` +
      `CandidaciesEditor`, the `/data/elections` tab (list + edit), a real
      `/elections` list (`components/elections/`) + `/elections/[id]` detail with a
      party-coloured result breakdown, margin, a reused-`contributions` fundraising
      line, and a "Results by area" placeholder for Phase 3. Homepage gains an
      Elections stat card; `seed.mjs` seeds one certified 2024 race; ingest batch
      accepts `elections`/`candidacies` (externalId → idempotent upsert).
      `DataSourceNote` (MIT Election Lab / Census) is on every election view.
      `npm run db:push` is required before the seed/app can use the new tables.
- [x] Phase 2 — Load real data. `scripts/import-elections.mjs` (`npm run
      import:elections`) parses the committed MEDSL files in `data/elections/`
      (`SOURCES.md` records DOIs + retrieval date; delimiter sniffed per file),
      groups general-election `mode=TOTAL` rows into one election per
      state/district × cycle, and upserts on a stable `external_id`
      (`medsl:<office>:<year>:<jur>`). Candidate → `politician` entity matching is
      exact-key only (given-name equivalences applied, e.g. joseph→joe); >1 match
      is reported to `backups/<ts>/election-import-report.json` and skipped, 0
      match creates the entity tagged `{source:"medsl"}`. Minor candidates below
      `--min-vote-share` (default 1%, unless they won or ran major-party) are
      dropped; the detail page uses `election.total_votes` as the pct denominator
      so that doesn't distort shares. `--dry-run`, `--cycles=A-B|list`,
      `--offices=`, `--all-candidates` flags; non-guestbook files auto-download to
      the gitignored `data/elections/cache/`. Prior-race auto-linking
      (`prior_election_id`) runs at the end so Phase 4 swing needs no hand-wiring.
      **First real run:** President + Senate, 2000–2024 → 808 elections, 2316
      candidacies, 927 new politician entities, 0 ambiguous. House and Governor are
      documented in `SOURCES.md` as manual drop-ins.
- [x] Phase 3 — Results geography. `election_results` table (per candidacy × area,
      keyed by FIPS/GEOID); `src/lib/db/electionResults.ts` (`listResultsForElection`
      + pure `areaBreakdowns` winner/margin roll-up + `electionIdsWithResults`).
      `src/lib/map/choroplethLayer.ts` — a focused reusable GeoJSON-choropleth
      module (source + fill/line layers painted from `feature-state`, the
      `waitForSourceLoaded`/`safeSetFeatureState` guards from `countryLayers.ts`);
      a full refactor of `countryLayers.ts` onto it is deferred (that file also
      carries selection/neighbour/feature-toggle logic and the `/geography` map
      can't be visually regression-tested here). `results-map.tsx` (standalone
      MapLibre, positron basemap, no store/context), `area-results-table.tsx`
      (sortable, county search), `results-section.tsx` (map + legend + table with
      shared hover/select). Detail page renders them under "Results by county"
      when rows exist. `public/data/us-counties.geojson` (~3 MB, FIPS `id`).
      `scripts/import-county-results.mjs` (`npm run import:county-results`) loads
      tonmcg two-party county presidential returns for 2020 + 2024 (committed
      `data/elections/tonmcg-*`), batched upserts on `external_id`, attaching to
      the `medsl:president:<year>:<ST>` elections. Ingest batch gains an
      `electionResults` array. **First run:** 12,624 result rows, 3,208 counties,
      102 elections; PA-2024 and Maricopa 2020→2024 roll-ups verified.
      **Not verified here:** the MapLibre choropleth renders correctly — needs a
      visual check in `npm run dev`.
- [ ] Phase 4 — Comparison and swing
- [ ] Phase 5 — Scenario simulator (with county demographics)
- [ ] Phase 6 — District explorer + gerrymandering viewer (planned, not built)

Rough effort: Phase 1 ≈ 2–3 days · Phase 2 ≈ 4–7 days (mostly candidate-matching
and data cleaning) · Phase 3 ≈ 4–6 days · Phase 4 ≈ 2–3 days · Phase 5 ≈ 3–5 days
· Phase 6 ≈ 1–2 weeks if built. **Phases 1–4 (a genuinely usable Elections
category) ≈ 3–4 weeks.**

---

## Assessment: is the category actually usable and good for other people now?

Reworked around data, the answer moves from "structurally real but empty" to
**"usable for U.S. federal and gubernatorial elections after Phase 4, with known
edges."**

### What this version delivers that the last one didn't

- **Phase 2 makes it real.** The category ships populated — President, Senate,
  Governor, House for multiple cycles — with a one-command re-import. That is the
  difference between a schema and a tool.
- **Cheap wins folded in.** Fundraising on the detail page (free reuse of
  `contributions`), auto-linked swing (no hand-wiring), stable shareable URLs.
- **Map debt pre-empted.** `choroplethLayer.ts` is extracted before there are two
  copies, not after.
- **Built for a second maintainer.** `SOURCES.md`, an import report that flags
  ambiguous candidate matches instead of guessing, attribution on every page.

### Residual risks and honest limits

1. **Candidate de-duplication is the hard part of Phase 2.** MEDSL gives names,
   not IDs. Two "John Smith"s, `LAST, FIRST` formatting, nicknames, and
   redistricted House members will produce ambiguous matches. The import report
   contains the problem rather than hiding it, but resolving it is manual
   alias-curation work that recurs with every new cycle.
2. **2024 (and any current cycle) lags.** MEDSL certified files land 6–18 months
   out. The `provisional` status and re-import path handle this correctly, but
   "the race everyone is talking about right now" will be the least complete part
   of the tool for a while.
3. **"Precinct" stays aspirational.** `pages-content.ts` still says "County /
   precinct political explorer." There is no national precinct dataset; MEDSL
   precinct coverage is partial and per-state. Phases 3–5 are county-level.
   Either adjust the feature copy or accept the gap.
4. **The richer "Election explorer" is still out of scope.** `sampletools.md` #29
   imagines polling, prediction markets, debates, endorsements, ideology. This
   plan delivers results, geography, swing, fundraising, and simulation. The rest
   are follow-on verticals, not part of "finished."
5. **Phase 6 is still filed, not built.** District Explorer and Gerrymandering
   Viewer (2 of 6 advertised features) remain planned-only. After Phases 1–5 the
   category is 4 of 6 features, each solid.
6. **Simulator honesty load.** Even with the urbanicity join, a slider model
   invites over-reading. The copy has to work hard to frame it as "what-if
   arithmetic," not a prediction.
7. **No regression net.** Choropleth margins, swing deltas, electoral-vote
   tallies, and compactness math are all easy to get subtly wrong, and the repo
   has no test runner. Consistent with prior verticals, but the correctness
   surface here is the largest in the app.

### Verdict

After Phases 1–4 (~3–4 weeks), `/elections` is a real, populated, shareable tool
that answers "who won, by how much, how did the map look, and how did it move"
for U.S. federal and gubernatorial races back to 2000 — genuinely useful to
someone other than the author. It is *not* a complete realization of the
"Elections & Maps" vision: precinct data, districts/gerrymandering, and the
polling/markets/debates layer are explicitly beyond this plan, and current-cycle
results will trail certification. Those are documented limits, not surprises.
