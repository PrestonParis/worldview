# Money & Influence — from a filtered graph to a real money-flow tool

## Context

Worldview's Money & Influence page (`src/app/(shell)/money/page.tsx`) is further
along than any other non-Geography category: there is a real `contributions`
table in Postgres (`src/lib/db/schema.ts`), a real OpenFEC importer
(`scripts/import-fec-donors.mjs`), per-currency totals, and a graph-loss
recovery path (`scripts/reconstruct-fec-graph.mjs`). Recent history —
`7986523 Money: real structured contribution amounts` and
`2d39afc Money: import real donor data from OpenFEC` — is the same "replace the
fake reuse with a real data model" move the other categories got.

What is **not** done:

1. **The core donor graph still reuses hand-entered edges, not the money data.**
   `MoneyGraphPage` builds its graph by filtering `listEdges()` (Neo4j
   `RELATED_TO`) through `isDonorEdge()` — a regex on the edge label
   (`src/lib/graph/money.ts`). The structured `contributions` rows — the ones
   with real amounts, dates, and FEC provenance — are shown only as a flat
   table below the graph (`ContributionsList`), never drawn as the graph
   itself.
2. **The four advertised features are vaporware.** `pagesContent.money.features`
   lists "Industry support explorer", "Geographic donor map", "Lobbying
   network", "Revolving door tracker". None exist; they render as an
   empty-state `<ul>` (`src/components/empty-state.tsx`).
3. **No aggregation layer.** `listContributions()` returns every row and the
   client does all grouping/filtering. A donor-network or industry breakdown
   needs SQL `GROUP BY` — donor→recipient totals, by-industry, by-state,
   by-cycle.
4. **Entity profiles ignore structured money.** `/data/entities/[id]` has a
   "Donors & funding" section, but it is built from `isDonorEdge()` edges, not
   `contributions`. A politician with 200 imported FEC contributions shows
   nothing there unless someone also hand-drew a `RELATED_TO` edge.
5. **The importer is narrow.** 10 hardcoded `PILOT_NAMES`, organizational
   (PAC/committee) contributions only, no geography / employer / occupation /
   contribution-type fields captured, one cycle.

Scope: **Money & Influence only.** The donor-network graph rebuild (Phase 1)
and schema work (Phase 2) are the priority — they make everything else
possible. Lobbying (Phase 5) and Revolving Door (Phase 6) introduce genuinely
new data models and are called out in full but explicitly not the first
things built. "Money Flow Visualizer" (multi-hop person → PAC → Super PAC →
vendor, sampletools #20) needs FEC Schedule B disbursement data and a
path-tracing UI — it is Phase 8, a stretch.

## Scope & definition of done

This category imitates a class of real tools (OpenSecrets, FEC.gov's own
explorers) whose value comes from **data acquisition** — every federal
candidate, every cycle, individual *and* committee money, human-maintained
industry codes — not from the views on top. This plan builds the views and a
defensible slice of the data. It does not attempt parity with those tools, and
"finished" is defined against that limit, not against them.

**Three honest tiers:**

| Tier | Scope | Honest status |
|---|---|---|
| **Working** | Phases 1–2 | Core graph is real (drawn from `contributions`, not hand-entered edges); entity profiles show structured money. Two of four advertised sub-tools still absent. |
| **Feature-complete** | Phases 1–5 | All four `pagesContent.money.features` entries are real models + views — no empty-state bullets. But (see the attached screenshot) the data is ~199 rows / 10 pilot politicians / PAC-only, and the Network view is an unreadable hairball. Feature-complete, *not usable*. |
| **Usable** | + Phases 7–8 | Real 2026-cycle coverage (every federal candidate, PAC + top individuals, finance totals) and the redesigned candidate-first UI. This is where the category stops being a demo. |
| **Done** | Usable **plus** the data floor below | Not carrying a "well, but…". |

**The data floor for "Done":**

- **Coverage:** every current federal legislator exists as a `politician`
  entity (this is People & Power's job — Money consumes it), and the FEC
  import runs against all of them across the last ≥3 cycles.
- **Money type:** itemized **individual** contributions (>$200) are ingested,
  not just PAC/committee money. This is a scale change the app's fetch-all-rows
  pattern cannot absorb — it requires FEC **bulk file** ingestion and
  pagination through `ContributionsList` and every raw-row surface. It is its
  own workstream (Phase 7+), not a bullet.
- **Industry codes:** accepted as **approximate** — heuristic from committee
  name + FEC committee type against `src/lib/money/industries.ts`, and
  labelled as approximate in the UI. A human-maintained employer→industry
  crosswalk is out of scope (no free, redistributable source).
- **Lobbying:** Senate LDA filings for clients/registrants that resolve to
  existing entities; unmatched parties get auto-created entities. Completeness
  bounded by entity coverage, same as contributions.

**Explicitly not in any tier:** multi-hop money-flow path tracing (Phase 8,
needs Schedule B), sub-state (ZIP/precinct) donor geography, real-time / on-air
money graphics, foreign / dark-money modelling beyond the existing
hand-entered `RELATED_TO` overlay.

**Definition of done, in one sentence:** *Money & Influence is done when every
advertised sub-view is backed by a real model and real data (no empty-state
bullets), the contribution data covers all current federal legislators across
≥3 cycles including itemized individual money, and industry classification is
present and labelled as approximate.*

## Design decisions taken up front

- **`/money` becomes a multi-view section, not one mega-page.** A shared
  `src/app/(shell)/money/layout.tsx` with a tab nav (Network · Industries ·
  Map · Lobbying · Revolving Door), mirroring `src/app/(shell)/data/layout.tsx`
  exactly. Each view is its own route segment with its own
  `export const dynamic = "force-dynamic"`. This matches the existing nested
  precedent (`/legislation/[id]`) and keeps each server component's fetch set
  small.
- **Denormalize the two-store join onto the contribution row at import
  time.** Industry and geography live conceptually on the *donor entity*
  (Neo4j), but every aggregation query needs to `GROUP BY` them. Rather than
  pull all entities into app code on every money page (the app already does
  this elsewhere, but it does not scale to per-row grouping), the importer
  writes `donor_industry`, `donor_state`, `donor_city`, `donor_zip` directly
  onto `contributions`. The entity `metadata` stays the source of truth for
  hand edits; a small backfill script re-stamps rows when an entity's
  industry changes. This keeps the money views as plain single-store SQL.
- **Keep hand-entered donor edges as a labelled overlay, don't delete them.**
  `RELATED_TO` donor edges capture things FEC import never will — foreign
  funding, dark-money allegations, sourced narrative claims. After Phase 1
  the graph's primary layer is `contributions`; hand-entered donor edges
  render as a visually distinct secondary layer ("unverified / off-FEC"),
  still detected by `isDonorEdge()`.
- **No disclaimers.** sampletools #20 suggests a standing causation caveat;
  the product owner has ruled that out site-wide (banners / interpretation
  hedges read as defensive boilerplate). Specific factual data notes — e.g.
  "N% of this total is from unclassified donors" — are fine; general "this
  doesn't prove causation" text is not. An early `MoneyDisclaimer` component
  was built in Phase 3 and then removed.

---

## Phase 1 — Rebuild the donor network on `contributions`

The core fix. Verified facts:

- `contributions.amount` is `integer` whole currency units (schema comment is
  explicit — no cents, no float). Aggregation is plain `sum()`.
- `drizzle-orm` `sum()` returns a string (Postgres `numeric`);
  `listContributionTotalsByCurrency()` already wraps it in `Number(...)`.
  Follow that.
- Contributions reference entities by non-FK uuid (Neo4j refs), same
  convention as `bills.sponsorEntityId`. Names come from Neo4j; the money
  views already fetch `listEntities()` and build a `Map`.

**`src/lib/db/contributions.ts`** — new aggregation queries:

- `listContributionEdges()` → `{ donorEntityId, recipientEntityId, currency,
  total, count, firstDate, lastDate }[]`, `GROUP BY donor, recipient,
  currency`. This is the money graph's edge list.
- `listContributionsForEntity(entityId)` → all rows where the entity is donor
  *or* recipient, for the profile page.
- `getEntityContributionSummary(entityId)` → `{ raised: {currency,total,count},
  given: {currency,total,count}, topDonors[], topRecipients[] }`.
- `listContributionTotalsByRecipient()` / `...ByDonor()` → leaderboard data.

**`src/lib/money/` — new domain module** (domain logic only; DB stays in
`src/lib/db/`). Moves `src/lib/graph/money.ts` here and adds:

- `formatAmount(amount, currency)` — currently duplicated inline in
  `contributions-list-view.tsx`; make it the one copy.
- `MoneyFlow` / `MoneyGraphModel` types for the aggregated graph.
- `buildMoneyGraph(edges, entities)` — turns `listContributionEdges()` output
  into the `{ entities, edges, positions }` shape `EntityGraph` already
  consumes, with edge label = `formatAmount(total, currency)` + count, and an
  edge `weight` (0–1, log-scaled by total) for stroke width.

**`src/components/money/` — rebuilt views:**

- `MoneyGraphPage` (server): fetch `listContributionEdges()` +
  `listEntities()` + the hand-entered donor edges (`listEdges()` filtered by
  `isDonorEdge`). Compose both layers via `buildMoneyGraph`. Empty state only
  when *both* are empty.
- `MoneyGraphView` (client): keep the graph/table toggle. Graph: weighted
  edges, amount labels, secondary styling for off-FEC edges. Table: add
  **Amount** and **# contributions** columns, default sort by total desc,
  keep the donor/recipient search.
- `ContributionsList` stays as the raw per-row ledger beneath the graph, but
  its totals line and formatting now come from `src/lib/money`.

**`src/app/(shell)/data/entities/[id]/page.tsx` — structured money section:**

Replace the edge-derived "Donors & funding" block with two blocks driven by
`getEntityContributionSummary`:

- **Raised** (entity as recipient): total per currency, contribution count,
  top 5 donors with amounts, each linking to `/data/entities/{id}`, sourced.
- **Given** (entity as donor): symmetric.
- Hand-entered donor `RELATED_TO` edges drop to a smaller "Other funding
  relationships (unverified)" list below.

**Verification:** run `npm run import:fec-donors` against a seeded DB; confirm
a pilot politician's profile shows the imported FEC totals, and `/money`'s
graph draws committee→politician edges with dollar labels whose sum matches
`getEntityContributionSummary()` for that politician.

**Status — built (2026-09-06):**
- `src/lib/money.ts` — new domain module. Absorbs the old
  `src/lib/graph/money.ts` (`isDonorEdge` / `individualEntityTypes`), owns the
  single `formatAmount`, and holds the aggregation *types*
  (`ContributionFlow`, `EntityContributionSummary`, …) so client components
  import them without pulling in the Postgres client. `buildMoneyGraph()`
  merges FEC flows + hand-entered donor edges into `{ entities, edges,
  edgeStyles, rows }`; FEC edges get a green, log-weighted stroke, manual
  edges a thin dashed grey one, and manual edges are dropped when FEC already
  covers that donor→recipient pair.
- `src/lib/db/contributions.ts` — `listContributionFlows()` (GROUP BY
  donor/recipient/currency with sum/count/min/max date),
  `listContributionsForEntity()`, `getEntityContributionSummary()` (raised /
  given per currency + top 8 counterparties each).
- `src/components/graph/entity-graph.tsx` — optional `edgeStyles` prop
  (per-edge stroke / width / dash), backward-compatible; the People graph and
  homepage preview pass nothing and render identically.
- `MoneyGraphPage` / `MoneyGraphView` rebuilt on `listContributionFlows()`;
  table is now a donor→recipient aggregate (Total / Gifts / Period), sorted by
  total, with a one-line legend for the edge styling.
- `/data/entities/[id]` — new `EntityMoneySummary` (structured Raised / Given
  from `contributions`); the old `isDonorEdge`-derived cards drop to an
  "Other funding relationships (unverified)" block.
- Verified: `next typegen` + `tsc --noEmit` + `eslint` clean; `next build`
  passes; aggregation SQL smoke-tested against the live DB (199 contribution
  rows, flows/summary shapes correct).

**Deferred within Phase 1:** standalone leaderboard queries
(`listContributionTotalsByRecipient/ByDonor`) — not needed until a leaderboard
view exists; add with Phase 3.

---

## Phase 2 — Schema: geography, contribution type, classification

`db:push` migration (safe, additive). All new columns nullable.

**`contributions` table (`src/lib/db/schema.ts`):**

| Column | Type | Source |
|---|---|---|
| `contribution_type` | `pgEnum("contribution_type", ["individual","pac","super_pac","party","committee","other"])` | FEC `entity_type` / `is_individual` |
| `donor_state` | `text` | FEC `contributor_state` |
| `donor_city` | `text` | FEC `contributor_city` |
| `donor_zip` | `text` | FEC `contributor_zip` |
| `donor_industry` | `text` | controlled vocab, stamped at import (see below) |
| `employer` | `text` | FEC `contributor_employer` (individual schedule) |
| `occupation` | `text` | FEC `contributor_occupation` |

Add an index on `donor_state` and one on `donor_industry` (both are
`GROUP BY` keys).

**Industry vocabulary — `src/lib/money/industries.ts`:** a fixed ~20-sector
list (Finance/Insurance/Real Estate, Health, Energy & Natural Resources,
Defense, Labor, Agribusiness, Communications/Electronics, Transportation,
Lawyers & Lobbyists, Ideological/Single-Issue, …). Modelled on the
OpenSecrets sector taxonomy so it maps cleanly if we ever ingest their
crosswalk. Deliberately **not** a table yet — one string per donor. Revisit a
`industries` + `entity_industries` join only if a real donor needs multiple
sectors.

**Entity form:** add an "Industry" `<select>` (the vocab list) to the entity
form for `company`/`organization` types, writing `metadata.industry`. The
importer sets it heuristically from the committee name + FEC committee type;
humans correct it.

**Backfill — `scripts/backfill-donor-fields.mjs`:** re-derive
`donor_industry`/`donor_state`/… onto existing `contributions` from the
current entity `metadata` + a re-fetch of the cached FEC Schedule A responses
(`backups/.fec-schedule-a-cache.json` already exists). Idempotent.

**Validation:** extend `contributionSchema` (`src/lib/validation/contribution.ts`)
with the new optional fields so the ingest API and `/data` form accept them.
`externalId` stays import-only, as documented.

**Status — built (2026-09-06):**
- `src/lib/db/schema.ts` — `contribution_type` pgEnum + 7 nullable columns
  (`contributionType`, `donorState/City/Zip/Industry`, `employer`,
  `occupation`) on `contributions`, plus `contributions_donor_state_idx` /
  `contributions_donor_industry_idx`. **Not yet applied — run `npm run
  db:push`** (push-only repo, no migration files; additive + nullable, safe
  re-run).
- `src/lib/money/` is now a directory: `index.ts` (was `money.ts`) +
  `industries.ts` — a dependency-free vocab (`INDUSTRY_SLUGS`,
  `INDUSTRY_LABELS`, `industryLabel`) plus the `classifyCommitteeName`
  heuristic and `contributionTypeFromFec` mapper. Dependency-free so the
  `.mjs` scripts import it directly (`package.json` gained `"type":
  "module"` — no bare `.js` files in the repo, so it's inert elsewhere).
- `contributionSchema` + `Contribution` carry the new optional fields;
  `src/lib/db/contributions.ts` round-trips them (`toContribution` +
  shared `classificationValues()` in create/update).
- `scripts/import-fec-donors.mjs` writes all seven fields on insert
  (`donor_industry` via `classifyCommitteeName`, `contribution_type` via
  `contributionTypeFromFec`, geography/employer straight from the filing);
  `ON CONFLICT DO NOTHING` is unchanged, so a re-run does **not** re-stamp
  pre-Phase-2 rows.
- `scripts/backfill-donor-fields.mjs` (new, `npm run backfill:donor-fields`)
  — offline: fills `donor_industry` (donor name → classifier) and
  `contribution_type` (parsed from the row's FEC note). `--dry-run` /
  `--all`. Does not fill geography/employer (needs a fresh FEC pull).
- `src/lib/money/money.test.ts` (new) — 9 vitest cases covering the
  classifier, the FEC mapper, `industryLabel`, `formatAmount` /
  `moneyEdgeLabel`, and `buildMoneyGraph` (weighting + manual-edge dedupe).
  `tsc` / `eslint` / `next build` / `vitest` all green.

**Deferred within Phase 2:** the entity-form **Industry `<select>`**
(hand-correcting a misclassification still needs SQL until then) — folded
into Phase 3, where the industry view is what surfaces a wrong code. Once
`db:push` + `import:fec-donors` + `backfill:donor-fields` have been run,
Phase 3 is pure view work.

---

## Phase 3 — Industry Support Explorer (`/money/industries`)

Route: `src/app/(shell)/money/industries/page.tsx` (+ `industry-explorer.tsx`
client view).

- **Query** (`src/lib/db/contributions.ts`):
  `listContributionTotalsByIndustry(recipientEntityId?)` →
  `{ industry, currency, total, count }[]`, single-store `GROUP BY
  donor_industry` (that's why Phase 2 denormalizes it).
- **View:** a recipient picker (searchable, reuse `SearchInput`) defaulting to
  "All recipients". Horizontal bar breakdown by sector — `$` and `%` of that
  recipient's total. Click a bar → expand the donors inside that sector.
  A "compare" mode: pick 2–3 recipients, show their sector mixes side by
  side (sampletools #21: "Biden vs Trump", "Senate candidates").
- **Empty state:** if `donor_industry` is null on every row, link to the
  backfill / re-import rather than showing an empty chart.

Uses the `dataviz` skill conventions for the bar chart (inline SVG or a small
component — no chart lib is in `package.json` and CSP on any future artifact
would block a CDN one; keep it inline).

**Status — built (2026-09-07):**
- `/money` is now a tabbed section: `src/app/(shell)/money/layout.tsx`
  (Network · Industries · Map — more tabs added per phase). A
  `MoneyDisclaimer` was briefly rendered here and then removed on the
  product owner's call (no disclaimers site-wide).
- **Query** landed as `listIndustryBreakdown()` (no args) —
  `GROUP BY (recipient, donor_industry, donor, currency)`. One query; the
  client pivots it entirely (sector rollup, recipient filter/compare, donor
  drill-down), so no round-trips. Bounded by recipients × industries ×
  donors, fine for a politician-scoped view.
- Pure, tested pivot helpers in `src/lib/money/`: `industryBreakdown()`
  (sector rollup + shares, currency- and recipient-scoped) and
  `industryDonors()` (one sector → its donors).
- `src/components/money/industry-explorer.tsx` — currency selector (only if
  >1 present), a `<select>` + chips recipient picker (0 = all, up to 3),
  inline CSS bar rows (green; unclassified slice grey), click-to-expand
  donors, side-by-side columns in compare mode, and an explicit
  "N% is from donors the classifier couldn't place" note.
- Empty states: no rows → "run `import:fec-donors`"; rows but all
  unclassified → "run `backfill:donor-fields`".
- **Entity-form industry `<select>` (deferred from Phase 2) resolved
  differently:** the classification fields (`donorIndustry`,
  `contributionType`, state/city/zip, employer, occupation) were added to
  the **contribution** form (`/data/contributions/[id]/edit`) instead — that
  is the row `donor_industry` lives on and what this view reads, so a
  misclassification is fixable there directly. Entity `metadata.industry`
  stays unused for now (nothing reads it; revisit if a
  re-stamp-from-entity path is built in Phase 7).
- `pagesContent.money.features` drops "Industry support explorer" (it's a
  real tab now).
- Verified: `tsc` / `eslint` / `next build` / `vitest` (36 tests, 3 new for
  the pivots) green; `listIndustryBreakdown` smoke-tested against the live DB
  (68 grouped rows, 8 recipients, sectors $2.5k–$2.3M).

---

## Phase 4 — Geographic Donor Map (`/money/map`)

Route: `src/app/(shell)/money/map/page.tsx` (+ `donor-map.tsx` client).

- **Reuse the MapLibre stack, not the annotation studio.** `maplibre-gl` is a
  dependency and `src/components/map/MapCanvas.tsx` shows the setup, but the
  `/geography` studio (Konva overlay, tool rail, layer store) is far more than
  this needs. New lightweight `DonorMap` component: one MapLibre map, one
  GeoJSON fill layer, a legend. US states GeoJSON ships as a static asset
  under `public/` (state-level first — we have `donor_state`; ZIP-level is a
  later pass needing a ZCTA file).
- **Query:** `listContributionTotalsByState(recipientEntityId?)` →
  `{ state, currency, total, count }[]`, `GROUP BY donor_state`.
- **View:** choropleth of `$` per state. Toggle: absolute total vs
  in-state/out-of-state share for a selected recipient ("Extremely good
  election visual" — sampletools #22). Hover → state total + top donors.
- **Note for later:** if `/money/map` graphics ever need to go on-air, the
  Geography Phase 4 presentation-route pattern (`docs/geography-graphics-plan.md`)
  is the template — not in scope here.

**Status — built (2026-09-08):**
- **Deviation: tile-grid cartogram, not a MapLibre polygon choropleth.**
  `src/lib/money/us-states.ts` holds a statebins grid (50 states + DC, 8×11)
  + names; `donor-map.tsx` renders it as inline SVG. Rationale: no external
  GeoJSON to vendor, every state visible regardless of land area, zero deps,
  same "keep it inline" call as the Phase 3 bars. A real geographic
  choropleth is a swap of the render component behind the same query.
- **Query** landed as `listStateBreakdown()` — `GROUP BY (recipient,
  donor_state, donor, currency)`, client pivots (same shape as
  `listIndustryBreakdown`). `stateBreakdown()` / `stateDonors()` are pure,
  tested helpers in `src/lib/money/`; `stateBreakdown` splits out the
  no-state bucket separately.
- **View:** currency selector, `<select>`+chips recipient filter (union, up
  to 3), sqrt-scaled green tiles, hover → state total / share / top-6
  donors, a gradient legend. When exactly one recipient is selected and its
  `metadata.state` is known, that tile gets a ring and an in-state /
  out-of-state split is shown.
- **Empty states:** no rows → run `import:fec-donors`; rows but all
  `donor_state` empty → run `import:fec-donors -- --refresh`.
- **`scripts/import-fec-donors.mjs --refresh`** (new flag): `ON CONFLICT DO
  UPDATE` for the classification / geography columns only (amount, date,
  donor, recipient, notes untouched), off by default. Ran it — **194/199**
  rows now have `donor_state` (5 filings genuinely have none), and
  `contribution_type` is now FEC's real `entity_type` (pac 112 / other 63 /
  committee 19 / individual 5) rather than the note-parsed guess. Top donor
  states: VA $1.6M, TX $1.2M, DC $634k, NY $385k.
- `/money` layout gains the **Map** tab.
- **Repo fix (not Money-specific):** added
  `"allowImportingTsExtensions": true` to `tsconfig.json`. `next build`'s
  typecheck was red on `main` because parallel Legislation work committed
  `.ts`-extension imports in `src/lib/legislation/congress.ts` (a
  Next-bundler + plain-Node shared module — the same need `src/lib/money`
  meets by staying dependency-free). The setting is valid under
  `moduleResolution: bundler` + `noEmit`, changes no runtime behavior, and
  unblocks CI.
- Verified: `tsc` 0 errors, `eslint` (1 pre-existing warning in Elections
  code, not ours), `next build`, `vitest` 54 (5 new for the state helpers +
  grid). `listStateBreakdown` smoke-tested against the live DB.

---

## Phase 5 — Lobbying network (`/money/lobbying`) — new data model

No existing table. This is a real modelling task.

**Schema (`src/lib/db/schema.ts`):**

- Add `"lobbyist"` to `entityTypes` (`src/lib/validation/entity.ts`) +
  `entity-colors.ts` + `type-colors.ts`.
- `lobbying_registrations` — `id`, `clientEntityId` (uuid, Neo4j ref, non-FK,
  same convention), `registrantEntityId` (the lobbying firm), `year`
  (integer), `amount` (integer, nullable — LDA reports ranges/exact),
  `sourceRecordId` → `sources.id`, `externalId` (LDA filing UUID, unique
  idempotency key), timestamps. Indexes on client, registrant, `externalId`.
- `lobbying_issues` — `id`, `registrationId` → `lobbying_registrations.id`
  (`onDelete: cascade`, like `votes.billId`), `issueCode` (text, LDA's
  ~80-code list), `billId` → `bills.id` nullable (when a filing names a
  specific bill we already have), `description` (text). Index on
  `registrationId`, `billId`.

**`src/lib/db/lobbying.ts`** — CRUD + `listLobbyingForEntity(entityId)`,
`listLobbyingGraph()` (client→firm→lobbyist→bill edges).
**`src/lib/actions/lobbying.ts`** — `"use server"` CRUD for `/data`.
**`/data/lobbying`** tab + form (add "Lobbying" to `data/layout.tsx` tabs).

**`scripts/import-lda-lobbying.mjs`** — mirrors `import-fec-donors.mjs`
structure exactly (env load, pg + neo4j clients, crosswalk match, create
entities as needed, `ON CONFLICT (external_id) DO NOTHING`, dry-run,
disk-cached responses under `backups/`). Source: the **Senate LDA REST API**
(`lda.senate.gov/api/v1/`) — free, public, no key, paginated JSON. Match
`client` and `registrant` names against existing entities; create
`organization`/`lobbyist` entities for the rest. Register a `sources` row
(`source_type: 'filing'`) like the FEC importer does.

**View:** client → firm → lobbyist → bills-lobbied graph (reuse
`EntityGraph`), filterable by year and by bill. When a `lobbying_issues` row
has a `billId`, the node links to `/legislation/[id]` — the cross-category
payoff.

**Verification:** import one well-known client (e.g. a defense contractor
already in the DB), confirm its `/data/entities/[id]` shows a "Lobbying"
section and the `/money/lobbying` graph connects it through a firm to at
least one bill node.

**Status — built (2026-09-08):**
- **Entity type:** `lobbyist` added to `entityTypes` + `entity-colors.ts`
  (teal). Only `Record<EntityType,…>` site was `entity-colors.ts`.
- **Schema:** `lobbying_registrations` (client + registrant Neo4j refs,
  year, period, amount + `amount_kind`, `external_id` = LDA `filing_uuid`)
  and `lobbying_issues` (`registration_id` cascade, `issue_code` /
  `issue_label`, nullable `bill_id`, `description`). Applied by direct DDL
  (drizzle-kit push still entangled with parallel work); Drizzle schema +
  relations added to `schema.ts`.
- **DB / validation / actions:** `src/lib/db/lobbying.ts` (list, per-entity,
  CRUD with delete-and-recreate issues), `src/lib/validation/lobbying.ts`,
  `src/lib/actions/lobbying.ts`.
- **Graph:** `buildLobbyingGraph()` in `src/lib/money/` — aggregates filings
  into a **client → firm** graph (bills + lobbyist people stay in the
  table, not the graph, for readability), teal log-weighted edges. LDA
  self-filer rows (`client === registrant`, in-house lobbying) are kept as
  table rows but drawn as **no edge** — a self-loop is noise.
- **Views:** `/money/lobbying` (graph/table toggle, year filter, bill chips
  → `/legislation/[id]`), `/data/lobbying` (+ `[id]/edit`) with a form
  (issues as one-per-line text), a **Lobbying** tab on `/money` and a
  **Lobbying** tab on `/data`, and a "Lobbying" section on the entity
  profile (firms hired / clients represented).
- **Importer:** `scripts/import-lda-lobbying.mjs` (`npm run
  import:lda-lobbying`) — pilot client list, `client_name` + `filing_year`
  queries, name-matches clients/firms to entities (creates `organization`
  for the rest), regex-links bill numbers in activity descriptions.
  **Fetch-then-write** structure: all LDA pages are pulled first (slow,
  ~15 req/min anonymous), *then* the DB connection opens — an earlier
  interleaved version dropped its idle Supabase connection mid-run
  (`read ETIMEDOUT`).
- **Ran it** (2024, anonymous): 596 filings → **412 registrations
  inserted** (184 already present from the aborted first run — idempotent),
  95 `organization` entities created, 772 issue rows. 33 clients, 131
  firms, $139M reported. Top issues: Telecom 177 / Health 124 / Tax 112 /
  Defense 78. 0 bills linked — the `bills` table has nothing matching yet
  (Congress importer is parallel work); issues still store their
  descriptions, `bill_id` fills in on a re-run once bills exist.
- Verified: `tsc` 0 errors, `eslint` clean, `next build`, `vitest` 67
  (4 new for `buildLobbyingGraph`).

---

## Phase 6 — Revolving Door Tracker (`/money/revolving-door`) — cross-category

Depends on employment-history data that **belongs to People & Power**
(nav bundle: "careers"; `pagesContent.people.features`: "Career timeline").
Build the shared model with that category, not unilaterally here.

**Proposed shared schema — `positions` table:**

- `id`, `personEntityId` (uuid, Neo4j ref), `orgEntityId` (uuid, nullable —
  free-text `orgName` when the org isn't an entity), `title` (text),
  `sector` (`pgEnum("position_sector", ["government","private","lobbying",
  "nonprofit","campaign","academia","media"])`), `startDate`, `endDate`
  (nullable = current), `sourceRecordId`, timestamps.
- CRUD in `src/lib/db/positions.ts`, actions, `/data/positions` tab.

**Money's lens on it** — `src/app/(shell)/money/revolving-door/page.tsx`:

- Per-person vertical timeline (sampletools #24), sector-colored.
- A cross-entity finder: list people whose `positions`, ordered by date,
  contain a `government` → (`lobbying`|`private`) transition (or the reverse)
  with a gap under ~2 years. No editorializing — the sequence is the point.
- Link each person to their `/money` donor profile and `/legislation` votes.

**This phase can slip** without blocking 1–5. Its schema decision should be
made jointly with a future `docs/people-power-plan.md`.

---

## Phase 7 — Real 2025–2026 cycle coverage & candidate finance

The attached `/money` screenshot is what 199 rows / 10 pilot politicians /
PAC-only buys you: an edge hairball with colliding `$5,000` labels and no
signal. The current importer already targets the right cycle
(`two_year_transaction_period` = current even year = 2026, i.e. Jan 2025–Dec
2026), it's just tiny. Fix = coverage, plus a finance *overview* (7B) that
doesn't depend on the graph being readable.

### 7A — Every 2026 federal candidate (`scripts/import-fec-cycle.mjs`)

Rework `import-fec-donors.mjs` → `import-fec-cycle.mjs`:

- **Candidate spine from FEC, not the crosswalk.** `legislators-current.yaml`
  only lists sitting members; a midterm *is* the challengers and open seats.
  Pull `/candidates/?cycle=2026&office=H&office=S&per_page=100` (paginated) —
  each result carries `candidate_id`, `name`, `party`, `office`, `state`,
  `district`, `incumbent_challenge`, `principal_committees`.
- **Resolve to `politician` entities.** (a) the ~537 entities that already
  carry a Bioguide/FEC id in `metadata` (from `backfill:members`) via the
  crosswalk, then (b) normalized name + state. Unmatched (non-incumbent
  challengers) get a **new `politician` entity**, `metadata` =
  `{ fecCandidateId, party, state, district, incumbentChallenge }`. Write
  `fecCandidateId` back onto every matched entity so later runs are O(1).
- **Contributions per candidate**, principal committee, `schedule_a`,
  `two_year_transaction_period=2026`, `sort=-contribution_receipt_amount`,
  two passes: **PAC/committee** (`is_individual=false`, top ~50) and
  **individual** (`is_individual=true`, top ~50 — the marquee bundlers and
  mega-donors, without the full itemized firehose). ~2–4 calls/candidate ×
  ~1,000 candidates with real committees ≈ 3,000 calls: chunk it, resume
  from a `sync_runs` cursor (reuse the table the Legislation importers added).
- **Bulk-file track (separate, the honest full answer).**
  `scripts/import-fec-bulk.mjs` — stream a downloaded per-cycle `itcont.txt`
  (all itemized individual contributions) + `pas2` (committee→candidate),
  filter to 2026 recipient committees, `COPY` into `contributions`. Only way
  to get true individual-donor coverage and real `/money/map` density. Gated
  on a `data/fec/` drop like `data/elections/`. Design now, build when a
  segment needs sub-committee individual detail.

### 7B — Candidate finance totals (`candidate_finance` table)

Cheap, high value, and it feeds the redesign (Phase 8) without needing the
graph legible.

- New table: `entityId` (politician ref), `cycle`, `totalReceipts`,
  `totalDisbursements`, `cashOnHand`, `debtsOwed`, `individualContributions`,
  `pacContributions`, `party`, `office`, `state`, `district`,
  `coverageEndDate`, `sourceRecordId`, `externalId`
  (`{fecCandidateId}-{cycle}`, unique), timestamps.
- One call per candidate: `/candidate/{id}/totals/?cycle=2026`. One pass,
  resumable. `scripts/import-fec-totals.mjs`.
- `src/lib/db/candidateFinance.ts` — `listCandidateFinance(cycle)`,
  `getCandidateFinance(entityId, cycle)`.

### 7C — Freshness & housekeeping

- The 2026 cycle is live: `import:fec-cycle` + `import:fec-totals` become
  weekly GitHub Actions jobs (mirror `sync-legislation.yml`), each writing a
  `sync_runs` row so `/data` and `/money` can show "FEC data as of …".
- `db:export` / `db:restore-postgres` / `db:seed` to cover
  `candidate_finance` and `lobbying_*`.
- Industry stamping at import from FEC's `contributor_employer` +
  committee name, not just committee name.

---

## Phase 8 — Network view redesign

`/money` (Network) currently pushes the **entire** donor↔recipient bipartite
graph through `computeHierarchicalLayout` — every PAC in one row, every
candidate in another, an unreadable curtain of overlapping edges, colliding
`$5,000`/`$4,000` labels, truncated node text ("LABORERS' POLITICAL LEA…").
It should not be the landing view, and the graph itself needs to be
entity-centric.

### 8A — Candidate-first landing (leaderboard, not a graph)

`/money` becomes a **sortable, filterable finance table** of 2026
candidates, built on `candidate_finance` (7B): name, party, office/state/
district, **raised**, **spent**, **cash on hand**, **top industry**, an
inline PAC-vs-individual split bar. Filters: chamber, party, state,
incumbent/challenger; free-text search. This is the "what's happening this
cycle" view and needs no graph.

### 8B — Ego graph per candidate (`/money/[candidateId]`)

- **Finance summary card** — raised / spent / cash-on-hand, coverage date,
  receipts sparkline over the cycle, PAC / individual / party donut.
- **Ego graph** — candidate = center node; their **top ~25 donors** as a
  ring; node radius ∝ contribution total; edge width ∝ amount; **labels on
  hover only**. "Expand" pulls the next 25. Click a donor → optional 2-hop
  (that donor's *other* 2026 recipients), so cross-candidate PAC patterns
  surface without drawing all of them at once.
- Reuse Phase 3 industry bars + Phase 4 tile map as side panels scoped to
  this candidate (`industryBreakdown` / `stateBreakdown` already take a
  `recipientIds` filter), plus `getEntityContributionSummary`.

### 8C — `EntityGraph` fixes (every graph page benefits)

- **`edgeLabelMode?: "all" | "hover" | "none"`** — default the money graphs
  to `"hover"`; kills the label collision.
- **`nodeSize?: (id) => number`** — radius scales with a passed metric
  (contribution total, degree). Big donors read as big.
- **`computeRadialLayout(centerId, rings, entities, edges)`** in
  `src/lib/graph/layout.ts` — center + concentric rings by hop distance,
  angular slot by amount, for ego graphs. Hierarchical stays for directed
  multi-hop (Phase 9).
- **Edge opacity ~0.25, thicken on node hover** for any whole-graph mode —
  density becomes texture, not noise.
- **Node label**: widen `EntityNode` / wrap to two lines / full name in
  `title` — the truncation is a fixed-width-node problem.

### 8D — "All donors" mode, demoted

The whole-graph view moves behind a "Show all" toggle: `computeForceLayout`
(not hierarchical), node sizing on, labels off, party/chamber/industry/
amount filters, a hard top-N cap with a "showing 200 of 4,120" line. An
explorer, not the default.

---

## Phase 9 — Money Flow Visualizer (stretch, not designed in detail)

Multi-hop money paths (person → PAC → Super PAC → vendor → media buy,
sampletools #20). Needs **FEC Schedule B (disbursements)**, a new
`disbursements` table paralleling `contributions`, and a path-tracing graph
UI with explicit `$amount` edge labels. Deferred until Phases 1–5 are solid
and there's a concrete show segment that needs it.

---

## Files touched (Phases 1–4, the committed-to work)

**New:**
- `src/app/(shell)/money/layout.tsx` — tab nav
- `src/app/(shell)/money/industries/page.tsx`, `.../map/page.tsx`
- `src/lib/money/index.ts` (absorbs `src/lib/graph/money.ts`),
  `src/lib/money/industries.ts`
- `src/components/money/industry-explorer.tsx`, `donor-map.tsx`,
  `money-disclaimer.tsx`
- `scripts/backfill-donor-fields.mjs`
- `public/us-states.geojson`

**Changed:**
- `src/lib/db/schema.ts` — new `contributions` columns + `contribution_type`
  enum + indexes
- `src/lib/db/contributions.ts` — aggregation queries
- `src/lib/validation/contribution.ts` — new optional fields
- `src/lib/graph/money.ts` — move to `src/lib/money/` (leave a re-export or
  update the 3 import sites: `money-graph-page.tsx`,
  `data/entities/[id]/page.tsx`, and itself)
- `src/components/graph/money-graph-page.tsx`,
  `src/components/graph/money-graph-view.tsx` — build from
  `listContributionEdges()`
- `src/components/money/contributions-list-view.tsx` — use shared
  `formatAmount`
- `src/app/(shell)/money/page.tsx` — becomes the "Network" tab
- `src/app/(shell)/data/entities/[id]/page.tsx` — structured Raised/Given
  sections
- `src/components/forms/entity-form.tsx` — industry select
- `scripts/import-fec-donors.mjs` — write the new columns
- `src/lib/pages-content.ts` — trim `money.features` as views ship
- `README.md` — document new columns / any new script

**Constraint:** `npm run lint` and the typecheck step (`.github` CI) must stay
green. No new runtime env var without a README entry and an `.env` template
update. Read `node_modules/next/dist/docs/01-app` before
touching route segments — async `params`/`searchParams`, per-segment
`dynamic`, and `PageProps<...>`/`LayoutProps<...>` generated types are all
already in use and must be matched.

## Status

- [x] Phase 1 — Rebuild donor network on `contributions`. Built as designed:
      `src/lib/money.ts` domain module, three aggregation queries in
      `src/lib/db/contributions.ts`, a backward-compatible `edgeStyles` prop on
      `EntityGraph`, `MoneyGraphPage`/`MoneyGraphView` drawn from
      `listContributionFlows()` (weighted green FEC edges + dashed unverified
      overlay, aggregate table), and structured Raised/Given on the entity
      profile via `EntityMoneySummary`. `tsc` / `eslint` / `next build` green;
      aggregation SQL smoke-tested against the live DB.
- [x] Phase 2 — Schema: geography, contribution type, industry. Built:
      `contribution_type` enum + 7 nullable columns + 2 indexes on
      `contributions` (needs `npm run db:push`), `src/lib/money/industries.ts`
      (vocab + `classifyCommitteeName` heuristic + `contributionTypeFromFec`),
      validation + DB round-trip, importer writes the fields,
      `scripts/backfill-donor-fields.mjs` for pre-existing rows, and a 9-case
      vitest suite. Entity-form industry `<select>` deferred to Phase 3.
- [x] Phase 3 — Industry Support Explorer. Built: `/money` tabbed layout +
      shared `MoneyDisclaimer`, `listIndustryBreakdown()` (one GROUP BY,
      client pivots), tested `industryBreakdown` / `industryDonors` helpers,
      `industry-explorer.tsx` (recipient filter/compare, sector bars,
      click-to-expand donors, unclassified-share note), classification fields
      added to the contribution form. Live-DB smoke-tested.
- [x] Phase 4 — Geographic Donor Map. Built as a tile-grid cartogram (inline
      SVG, `src/lib/money/us-states.ts`) rather than a MapLibre choropleth —
      no GeoJSON to vendor, every state visible. `listStateBreakdown()` +
      pure `stateBreakdown` / `stateDonors` helpers, `donor-map.tsx`
      (recipient filter, hover donors, in/out-of-state split, legend), Map
      tab. New `import:fec-donors --refresh` flag populated `donor_state` on
      194/199 rows. Also added `allowImportingTsExtensions` to tsconfig to
      unblock CI (broken by parallel Legislation work).
- [x] Phase 5 — Lobbying network. Built: `lobbyist` entity type,
      `lobbying_registrations` + `lobbying_issues` tables (applied), DB /
      validation / actions, `buildLobbyingGraph` (client→firm, in-house
      filings kept as rows not edges), `/money/lobbying` + `/data/lobbying`
      + entity-profile section, and `scripts/import-lda-lobbying.mjs`
      (fetch-then-write). Ran it: 596 LDA filings → 412 registrations, 772
      issues, 33 clients / 131 firms / $139M.
- [ ] Phase 6 — Revolving Door Tracker (cross-category; shared `positions`)
- [ ] Phase 7 — Real 2025–2026 cycle coverage & candidate finance
      (`import-fec-cycle` off the FEC candidate list not `PILOT_NAMES`,
      PAC + top individuals, `candidate_finance` totals table, weekly
      GitHub Actions sync, bulk-file track designed). **This is the
      priority — the graph is a hairball because the data is 199 rows.**
- [ ] Phase 8 — Network view redesign (candidate finance leaderboard as the
      `/money` landing, per-candidate ego graph, `EntityGraph`
      hover-labels / node-sizing / radial layout, whole-graph mode demoted
      behind a toggle)
- [ ] Phase 9 — Money Flow Visualizer (stretch; needs Schedule B)
