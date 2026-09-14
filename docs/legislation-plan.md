# Legislation & Courts — implementation plan

## Context

`/legislation` today (`src/app/(shell)/legislation/`) is the thinnest of the five
categories relative to what its nav label promises. Commit `d13f7e9` gave it a real
data model — a `bills` table and a `votes` table in Postgres, referencing Neo4j
`politician` entities by plain uuid — and two real views:

- **`/legislation`** — `BillList` (server) → `BillListView` (client): every bill with
  a live vote tally, search, status filter.
- **`/legislation/[id]`** — bill detail with the roll call grouped by position.
- **`/data/bills`** + **`/data/bills/[id]/edit`** — admin CRUD, with an inline
  add/delete `VotesEditor` on the edit page.

This document is the **retooled plan**. An earlier draft laid out seven phases that
would have cleared the `pagesContent.features` checklist but left the category
*built, not finished*: no way to keep the data current, an unstated dependency on
backfilling ~485 member entities, the "& Courts" half compressed into one
over-scoped phase, an amendment-diff feature that shipped as an unreadable raw diff,
the two halves never actually connected into one graph, and no regression safety net
across seven interacting schema changes. This version closes those gaps and adds an
explicit, testable **Definition of done** (bottom of file). If every box in that
section is checked, the category is complete in substance, not just on paper.

Scope: **the Legislation & Courts category only.** Not a reframing of People, Money,
Elections, or Geography. The plan preserves the architecture `d13f7e9` established —
structured legislative documents are **Postgres tables that reference Neo4j entities
by indexed uuid, joined application-side**; only *actors* (members, justices,
committees if modeled) are Neo4j entities.

## What "complete" means for this category

Every promised sub-tool — from `nav.ts` ("Bills, amendments, votes, promises, court
cases"), `pagesContent.legislation.features`, and `sampletools.md` #13–#18, #44–#48
— is backed by (a) a real data model, (b) a real view, (c) real data that arrives
and *stays current* through an automated path where a free one exists, or a
first-class `/data` editor where it doesn't, and (d) a committed check that fails
if a later phase breaks it. The per-feature completion criteria are enumerated in
**Definition of done**.

Two framing calls made up front, because "complete" is undefined without them:

- **Lower courts.** SCOTUS is covered end-to-end by a free authoritative dataset
  (SCDB). Circuit/district courts have no clean bulk source, so the case model is
  built to hold *any* court and lower-court cases enter through `/data/cases` as
  curated records (like promises). "Court case explorer" is complete when the model
  and views handle any court and SCOTUS is fully imported — not when every district
  opinion is ingested.
- **Authority & Powers (#44 Policy Dependency Graph, #45 "Can They Actually Do
  That?", #46 Executive Power Explorer).** `archived-tools.md` had bucketed "can
  they do that" under the now-archived `/fact-check`. They are brought back here
  (Phase 8): "Legislation & Courts" is the only one of the five categories that is
  *about what government may lawfully do*, and the judicial-authority half already
  lives here. They are hand-authored reference tools with no importer — Phase 8
  says so plainly.

## Conventions this plan follows

Verified against the current tree, not assumed:

- **Schema changes go through `npm run db:push`** (schema-diff), not committed
  migration files. `drizzle.config.ts` points `out` at `supabase/migrations/` and
  `db:generate` is wired, but that directory doesn't exist and the README documents
  `db:push`. Additive changes (new tables, new nullable columns) are safe to push;
  drops are deferred, exactly as `bbd77bf` left the dead `claims` verdict columns in
  place — "drop them with a later `db:push`".
- **Every route that reads live data exports `export const dynamic = "force-dynamic"`**
  (noted in `bill-list.tsx`; enforced across `(shell)`).
- **New server actions stay unauthenticated**, matching the deliberate
  claims/sources/entities/bills precedent from `d13f7e9`. This is shared/global
  data, unlike `map_projects`, which is owner-scoped because it's user-owned.
- **Importers follow `scripts/import-fec-donors.mjs`**: a free public API keyed by a
  free `api.data.gov`-style key, actors matched to existing entities via a stable
  crosswalk, rows inserted idempotently with the upstream record id as a unique
  `external_id`, supporting Neo4j entities created as the script goes, and one
  `sources` row written per run.
- **An importer is not "done" until it is idempotent, incremental, and scheduled.**
  New in this plan: a one-shot `npm run` script that has to be babysat is a
  prototype, not a finished ingestion path. Every importer here also (a) re-runs
  cleanly picking up only what changed since the last run, (b) writes a `sync_runs`
  row, and (c) is invoked by the scheduled sync job (Phase 1 stands up the
  infrastructure; each later data phase registers its source with it).
- **New Zod schema first** (`src/lib/validation/`), then `src/lib/db/*`, then
  `src/lib/actions/*`, then the server component that fetches + handles the empty
  state, then the client component for interaction.
- **Regression safety net.** This plan makes ~10 interacting schema changes with no
  existing test infrastructure. Phase 0 introduces **`vitest`** (dev-dependency
  only), and the suite stays deliberately narrow: DB round-trips and constraint
  checks against a scratch schema, plus the pure analytic functions (bloc
  clustering, vote diffing, party-line detection, citation-graph assembly). Wired
  into a `test` script and run before `build` in CI. This is the first test infra
  in the repo — a deliberate call, justified by the phase count.

---

## Phase 0 — Member backfill & entity crosswalk keys

The prerequisite the earlier draft left implicit. Every downstream phase matches
sponsors, cosponsors, and voters to `politician` entities; with ~50 politicians in
the graph, importing a Congress means ~485 unmatched members and a near-empty
import. Fix it once, first.

- **`entitySchema` gains an optional `bioguideId` string** (`src/lib/validation/entity.ts`),
  written through `createEntity` / `updateEntity` (`src/lib/neo4j/entities.ts`) as a
  first-class node property with a Neo4j uniqueness constraint
  (`CREATE CONSTRAINT entity_bioguide_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.bioguideId IS UNIQUE`).
  This is the indexable join key — the FEC script's name-token matching is the
  fragile pattern this replaces. It also lets `reconstruct:fec-graph` and any
  future importer resolve members reliably.
- **`scripts/backfill-members.mjs`** — from `unitedstates/congress-legislators`
  (`legislators-current.yaml` + `legislators-historical.yaml`, filtered to members
  who served in the target Congress range, default 118th–119th). For each: MERGE a
  `politician` entity keyed on `bioguideId` (create if absent, never overwrite a
  hand-edited name/description), setting `name`, and stashing `party`, `state`,
  `chamber`, `district`, and term history in the existing free-text `metadata` JSON
  (same shape the FEC script already uses for `fecCommitteeId`).
- Idempotent and safe on the populated graph (MERGE on `bioguideId`); reports
  created vs matched-existing counts.
- `package.json`: `"backfill:members"`. README "Adding data": a bullet.
- **Verification**: run against the real graph, assert every current member resolves
  by `bioguideId`, assert a second run creates nothing, assert an existing
  hand-added politician with a matching bioguide is linked rather than duplicated.

---

## Phase 1 — Full bill & roll-call import + sync infrastructure

The highest-leverage phase, and the direct parallel to Money's `2d39afc`. Nothing
else produces visible value until real data is flowing — **at full scale**, because
Phases 3–4 need every member's position on every roll call, not a pilot slice.

### 1a — Schema: roll calls, and the sync log

- **`roll_calls` table** (`src/lib/db/schema.ts`): `id`, `billId` (FK → `bills.id`,
  `onDelete: "cascade"`, nullable), `congress int`, `chamber text`, `rollNumber int`,
  `session int`, `question text` ("On Passage", "On the Cloture Motion"),
  `voteType text`, `result text`, `date timestamptz`, `externalId text` unique
  (upstream vote id), timestamps. Indexed on `billId`.
- **`votes.rollCallId`** — new nullable FK → `roll_calls.id`, `onDelete: "cascade"`.
  `null` → a bill-level vote (exactly what `VotesEditor` writes today; nothing
  existing changes). Set → a vote in a specific roll call.
- **Unique constraint**: replace `votes_bill_voter_unique` with two partial unique
  indexes — `(billId, voterEntityId) WHERE roll_call_id IS NULL` and
  `(rollCallId, voterEntityId) WHERE roll_call_id IS NOT NULL` (Drizzle
  `uniqueIndex().where(...)`). The "no double-recording" guarantee holds on both
  paths. This is the one migration that needs care; the round-trip check covers it.
- **`bills`** gains: `externalId text` unique (`{congress}-{type}-{number}`),
  `congress int`, `policyArea text`, `subjects text` (one-per-line, the `highlights`
  convention), `latestActionDate timestamptz`, `latestActionText text`,
  `sourceId uuid` (FK → `sources.id`, `onDelete: "set null"`), `syncedAt timestamptz`.
- **`sync_runs` table** (generic, reused by every importer in this plan): `id`,
  `source text` ("congress-bills", "congress-votes", "scotus-cases", …),
  `startedAt`, `finishedAt`, `status text` ("ok" | "error" | "partial"),
  `rowsInserted int`, `rowsUpdated int`, `rowsSkipped int`, `error text`,
  `cursor text` (high-water mark for incremental runs — e.g. the max
  `latestActionDate` seen). `src/lib/db/syncRuns.ts` with
  `startRun` / `finishRun` / `latestRun(source)`.

### 1b — Bill importer

`scripts/import-congress-bills.mjs`:

- Source: **Congress.gov API** (`api.congress.gov/v3`). Free key
  `CONGRESS_GOV_API_KEY` in `.env.local` / `.env.example`, next to `FEC_API_KEY`
  (same `api.data.gov` sign-up the README already walks users through).
- **Full scope**: every bill in the target Congress (default 119) with any
  recorded action, paginated. Not a pilot member set — the sparse-matrix problem in
  the earlier draft came from scoping to sponsored bills of ~10 members.
- Incremental: read `latestRun("congress-bills").cursor`; request only bills with
  `fromDateTime` = that cursor (Congress.gov supports `sort=updateDate+desc` and a
  date filter). First run is a full sweep; subsequent runs pull the delta.
- Match `sponsor.bioguideId` / `cosponsors[].bioguideId` → entities via the
  `bioguideId` property from Phase 0. Unmatched sponsors are now rare (a member who
  served but isn't in the crosswalk range) — logged, bill still imported with a
  null sponsor rather than skipped, because at full scope dropping bills silently
  distorts every tally.
- Upsert `bills` `ON CONFLICT (external_id) DO UPDATE` for `status`,
  `latestAction*`, `subjects`, `policyArea`, `syncedAt` (bills advance; a
  do-nothing insert would freeze them stale). One `sources` row per run.
- Writes a `sync_runs` row; sets `cursor` to the max update date processed.

### 1c — Roll-call importer

`scripts/import-congress-votes.mjs`:

- Source: the **`unitedstates/congress` bulk vote JSON** (public domain; House
  Clerk + Senate LIS scrapers, mirrored on GitHub/GovTrack) —
  `data/{congress}/votes/{session}/{chamber}{number}/data.json`, one file per roll
  call with every member's position. House Clerk / Senate LIS XML is the fallback.
- For every roll call in the target Congress (not just bill-associated ones —
  procedural and nomination votes matter for Phases 3 and 5b): upsert a `roll_calls`
  row `ON CONFLICT (external_id)`, link `billId` when the vote names a bill already
  imported, then one `votes` row per member (`rollCallId` set), matched by
  `bioguideId`. Snapshot each member's `party` at vote time onto `votes.party`
  (Phase 3).
- Incremental by `(congress, session, chamber, rollNumber)` high-water mark in
  `sync_runs.cursor`.

### 1d — Scheduled sync

Built as a **GitHub Actions workflow**, not a Vercel cron route. The earlier draft
assumed the CLI scripts and a route handler could share an importer module in
`src/lib/legislation/import/*.ts`; they can't — the app's `src/` tree uses
extensionless relative imports that only resolve through Next's bundler, so a plain
`node scripts/*.mjs` can't import it. Rather than maintain two implementations (a
drizzle route module + a raw-`pg` script, the `import-fec-donors.mjs` precedent),
the schedule just runs the scripts:

- **`.github/workflows/sync-legislation.yml`** — `schedule` cron (Mondays 08:00 UTC)
  plus `workflow_dispatch` (with a `full` toggle). Writes `.env.local` from repo
  secrets (`DATABASE_URL`, `NEO4J_*`, `CONGRESS_GOV_API_KEY`), then
  `npm run import:congress-bills` and `npm run import:congress-votes`. Node 24 (the
  scripts need ≥23.6 for unflagged `.ts` import of the shared `congress.ts` helpers).
  `concurrency` group prevents overlapping runs.
- The two `import:*` scripts are the single implementation — self-contained (raw
  `pg` + `neo4j-driver` + `fetch`), sharing only the pure, unit-tested mapping
  helpers in `src/lib/legislation/congress.ts` (Congress/date math, status and
  vote-position mapping, the tolerant vote-payload parsers). They're also the
  manual/first-run entry points, and stay incremental via the `sync_runs.cursor`
  high-water mark.
- `npm test` is added to `.github/workflows/ci.yml` (before typecheck).

### 1e — Views + freshness UX

- `/legislation` list + `/legislation/[id]`: roll-call count per bill; the detail
  page lists roll calls, each expanding into its own grouped breakdown. The
  bill-level tally stays the headline.
- **Data-freshness line** on `/legislation` and in `/data`: "Bills & votes last
  synced 3 days ago" from `latestRun(...)`, amber past a threshold, red on the last
  run's `status = "error"`. This is what makes staleness visible instead of silent.
- Homepage (`src/app/(shell)/page.tsx`): a "Roll-call votes" stat beside "Bills"
  (`countRollCalls` / `countRollCallsCreatedSince` in `src/lib/db/votes.ts`).

### Verification (vitest + round-trip)

Import a real Congress's worth of bills + roll calls against a scratch schema;
assert tallies; assert both partial-unique indexes reject duplicates; assert
`DELETE bill` cascades to `roll_calls` and `votes`; assert a second import run
inserts nothing and updates only changed bills; assert `sync_runs` cursor advances.
Render both routes. `tsc` / `eslint` / `next build` / `test`.

---

## Phase 2 — Bill Explorer

`sampletools.md` #14. Deepen `/legislation/[id]` from "title + sponsor + summary +
roll call" into the real thing. Additive Postgres tables, all FK `bills.id`
`onDelete: "cascade"`, all editable from `/data/bills/[id]/edit`, all populated
incrementally by the Phase 1 bill importer.

- **`bill_cosponsors`** — `billId`, `entityId`, `date`, `isOriginal boolean`.
- **`bill_actions`** — `billId`, `date`, `chamber text`, `text`, `actionType text`.
  Renders the vertical timeline on the detail page (the Timeline Engine grain).
- **`bill_committees`** — `billId`, `name text`, `chamber text`, `activity text`.
  Plain text for now; the schema comment notes committees-as-`organization`-entities
  is a cheap later migration (an additive `entityId` column).
- **`bill_relations`** — self-referential `billId`, `relatedBillId`,
  `relationship text`.
- **`bill_text_versions`** — `billId`, `versionType text`, `date`, `url` (GovInfo /
  Congress.gov). Link out; full text is stored only where Phase 7 needs it.
- Detail page sections, in order: header → summary → **What's in it** (subjects +
  policy area chips) → **Sponsors** (sponsor + cosponsor count, expandable) →
  **Timeline** (`bill_actions`) → **Committees** → **Roll calls** → **Related
  bills** → **Text** → **Court treatment** (Phase 5a's `case_bill_relations`, when
  present).
- `/data/bills/[id]/edit`: `CosponsorsEditor`, `ActionsEditor`, `CommitteesEditor`,
  `RelationsEditor` — the add/delete-only pattern `VotesEditor` established.
- **Optional AI explainer** (own opt-in sub-phase): `ANTHROPIC_API_KEY` is already
  provisioned. A server action takes bill text + summary and writes a
  hand-reviewable `bills.analysis text` ("what it does / current law / what
  changes"). Never auto-published; always editable. Load the `claude-api` skill
  before writing it.

---

## Phase 3 — Voting Record Explorer

`sampletools.md` #16, plus #18 (Agreeability) in its simplest inspectable form.

- **`votes.party`** — set at import time from the crosswalk (the member's party
  *at the time of the vote*).
- **`/legislation/members/[entityId]`** — a politician's full voting record: every
  roll call they voted on, filterable by `bills.policyArea` / `subjects`, with a
  **"broke with party"** flag (their position ≠ the majority position of their own
  party on that roll call, computed from the roll call's own votes — no external
  data). Party-line rate and cross-party count as headline stats. Linked from the
  entity page and from every roll-call breakdown.
- **`/legislation/compare?a={entityId}&b={entityId}`** — agreement rate across every
  roll call both voted on, plus the full disagreement list. One number, and the
  roll calls behind it.
- DB: `src/lib/db/votes.ts` gains `listVotesForVoter(entityId)` and
  `listSharedVotes(a, b)`. Party-line detection is a pure function → vitest.

---

## Phase 4 — Voting-bloc / coalition detection

`sampletools.md` #17; the archived `/alignment` consumer named in
`archived-tools.md`. Real now that Phase 1 imports whole Congresses.

- **`src/lib/legislation/blocs.ts`** — a member×member agreement matrix from
  co-votes (agreement = shared-position / shared-roll-calls, with a minimum
  shared-roll-call floor), then clustering: connected components at a similarity
  cutoff, or simple agglomerative. Pure function over `votes` rows, no new storage
  → fully unit-tested.
- **`/legislation/blocs`** — a force-directed member graph, edge weight =
  agreement, node color = detected cluster. Reuses `d3-force` / `@xyflow/react` and
  the `src/components/graph/` stack People and Money already use
  (`blocs-graph-view.tsx` beside `money-graph-view.tsx`).
- Descriptive, not scored: every edge and cluster clicks through to the roll calls
  that produced it.

---

## Phase 5 — Courts

`sampletools.md` #47 / #48, and the bridge that makes "& Courts" part of the same
graph rather than a parallel page. Split into two shippable halves.

### 5a — Cases, justices, votes, and the People↔Courts bridge

- **New entity type `judge`** — one line in `entityTypes`
  (`src/lib/validation/entity.ts`), a color in `src/lib/entity-colors.ts`; it
  appears in the `/data/entities` filter automatically. Carries an optional
  `courtlistenerId` property (same first-class-crosswalk-key pattern as Phase 0's
  `bioguideId`). Audit `entities.filter((e) => e.type === "politician")` call sites
  (`BillForm`, `VotesEditor`) — they stay politician-only; new judge pickers are
  separate.
- **`court_cases`** — `id`, `name text`, `docket text`, `court text` (any court —
  "Supreme Court of the United States", "9th Circuit", …), `arguedDate`,
  `decidedDate`, `question text`, `holding text`, `disposition text`,
  `majorityAuthorEntityId uuid` nullable, `externalId text` unique (CourtListener
  cluster id or SCDB `caseId`), `sourceId`, `syncedAt`, timestamps.
- **`case_votes`** — `caseId` (FK cascade), `justiceEntityId uuid`, `position text`
  ("majority" | "dissent" | "concurrence" | "concur-in-part" | "recusal"). Unique
  on `(caseId, justiceEntityId)` — same shape as roll-call votes.
- **`case_bill_relations`** — `caseId`, `billId` (FK → `bills.id`, `onDelete:
  "cascade"`), `relationship text` ("upholds" | "strikes down" | "interprets" |
  "cites"). **This is the Legislation↔Courts link.** Surfaces as "Court treatment"
  on the bill detail page and "Statutes at issue" on the case page.
- **`nominations`** — `id`, `nomineeEntityId uuid` (→ judge entity),
  `position text` ("Associate Justice", …), `presidentEntityId uuid` nullable (→
  politician), `rollCallId uuid` nullable (→ the Senate confirmation `roll_calls`
  row, which Phase 1c already imports), `date`, `result text`. **This is the
  People↔Legislation↔Courts link**: a judge's page shows "Nominated by {president},
  confirmed {yea}–{nay} on {date}" wired straight through to the roll call and its
  breakdown.
- **Import**: `scripts/import-scotus-cases.mjs` (+ shared `src/lib/legislation/import/scotusCases.ts`,
  registered with the Phase 1d cron). **CourtListener API** (Free Law Project, free
  key `COURTLISTENER_API_KEY`) for opinions and metadata; the **Supreme Court
  Database** (SCDB CSV) for authoritative per-justice votes. Justices matched/created
  as `judge` entities by `courtlistenerId` then name. Incremental by decided-date
  high-water mark.
- **Routes**: `/legislation/cases` (filter by court / term / disposition),
  `/legislation/cases/[id]` (question / holding / lineup / opinions / statutes at
  issue). `/data` gets a `cases` tab (`src/app/(shell)/data/layout.tsx`),
  `/data/cases` + `/data/cases/[id]/edit` with `CaseVotesEditor`,
  `CaseBillRelationsEditor`, and a `NominationForm`. Lower-court cases enter here by
  hand — the model already holds them.

### 5b — Precedent graph

`sampletools.md` #48.

- **`case_citations`** — self-referential `citingCaseId`, `citedCaseId`,
  `treatment text` ("overruled" | "limited" | "distinguished" | "affirmed" |
  "cited"). Populated from CourtListener's citation network (it exposes
  `opinions_cited` and depth); `treatment` defaults to "cited" and is refined by
  hand or from CourtListener's treatment signals where available.
- **`/legislation/cases/[id]`** gains "Relies on" / "Cited by" sections, and
  **`/legislation/precedent`** renders the citation graph (same `@xyflow/react`
  stack as Phase 4, edges typed and colored by `treatment`).
- Graph assembly (nodes/edges/treatment rollup from raw citation rows) is a pure
  function → unit-tested.
- 5b is a distinct deliverable: 5a can ship and be useful without it, but the
  category is not *complete* until 5b is in, because "Supreme Court precedent graph"
  is an explicit `features` item.

---

## Phase 6 — Campaign Promise Tracker

`sampletools.md` #13. No bulk source — promises are editorially curated, so this is
a hand-entry tool in the `claims` mold. The plan says so rather than pretending a
feed exists; the Definition-of-done criterion is the *tool*, not a row count.

- **`promises`** — `id`, `entityId uuid`, `text`, `topic text`, `madeDate`,
  `sourceId` (FK → `sources.id`), `status` enum (`promised` → `proposed` →
  `introduced` → `passed` → `implemented`, plus `abandoned` and `blocked`),
  `linkedBillId uuid` nullable (FK → `bills.id`, `onDelete: "set null"`),
  `note text`, timestamps.
- The `abandoned` (dropped it) vs `blocked` (tried, lost in Congress or the courts)
  split is the whole point of the tool, per `sampletools.md`.
- **`/legislation/promises`** — grouped by politician or status; each promise links
  to `linkedBillId` → Phase 2 detail → Phase 1 votes → outcome, and to any
  `case_bill_relations` that killed or upheld it.
- `/data/promises` + `PromiseForm`; a `promises` tab in the data layout.

---

## Phase 7 — Amendment Diff

`sampletools.md` #15. Retooled: the earlier draft's "line diff of raw legislative
text" is unreadable in practice (whitespace, section renumbering, strike/insert
amendments whose text isn't a literal replacement). What's actually useful is a
**structured change summary with a targeted word-level diff where real replacement
text exists, and an honest "not published as a diff" state where it doesn't** —
never a wall of red/green noise.

- **`amendments`** — `billId` (FK cascade), `number text`, `sponsorEntityId uuid`,
  `purpose text` (Congress.gov's own prose description), `status text`,
  `submittedDate`, `chamber text`, `changeType text` ("substitute" | "strike" |
  "insert" | "strike-and-insert"), `anchorText text` (the section/line it targets,
  e.g. "Sec. 4(b)"), `textBefore text` nullable, `textAfter text` nullable,
  `externalId text` unique. From Congress.gov `/amendment/{c}/{type}/{n}`
  (+ `/text`), registered with the cron.
- **Detail rendering**:
  - Always: `purpose`, sponsor, status, latest action, anchor.
  - When `textBefore` + `textAfter` are both present: an inline **word-level** diff
    (`src/lib/legislation/textDiff.ts` — a small Myers/word-diff, no dependency;
    unit-tested), captioned by `purpose`.
  - When they're not (the amendment text upstream isn't a clean replacement): show
    `changeType` + `anchorText` + `purpose` + a link to the amendment text, marked
    "full text not published as a structured diff." A real, labelled state.
  - Optional: reuse the Phase 2 AI explainer to turn `purpose` + diff into a
    one-line plain-English caption.
- Surfaces in a "Amendments" section on the bill detail page and at
  `/legislation/amendments`.

---

## Phase 8 — Authority & Powers

`sampletools.md` #44 / #45 / #46. Hand-authored constitutional/statutory reference —
no importer, and the phase states that openly. Included because "Legislation &
Courts" is the category about *what government may lawfully do*.

- **`powers`** — `id`, `actorType text` ("president" | "governor" | "congress" |
  "agency" | "court" | "state"), `action text` ("impose tariffs", "deport",
  "impound appropriated funds"), `authorityType text` ("constitutional" |
  "statutory" | "regulatory" | "inherent" | "contested" | "none"),
  `authoritySource text` ("Art. II §2", "50 U.S.C. §1701", "Youngstown"),
  `requiresCooperationFrom text` (one-per-line), `constraints text`,
  `precedentCaseId uuid` nullable (FK → `court_cases.id`, `onDelete: "set null"` —
  ties #45 to Phase 5), `linkedBillId uuid` nullable, `sourceId`, timestamps.
- **`power_dependencies`** — self-referential `powerId`, `dependsOnPowerId`,
  `note text`. The edge set for #44's dependency graph.
- **`/legislation/authority`** — browse/filter by actor + action ("Can they do
  that?"), each entry showing authority type, source, required cooperation,
  constraints, and linked precedent/bill. **`/legislation/authority/graph`** renders
  `power_dependencies` (xyflow, same stack).
- **`/legislation/authority` per-actor view** = #46 Executive Power Explorer: filter
  `powers` to one `actorType`, grouped by `authorityType` ("can do alone" /
  "through regulation" / "only with the legislature" / "only in emergency" / "cannot
  lawfully do").
- `/data/powers` + `PowerForm` + `PowerDependenciesEditor`; a `powers` tab.

---

## Cross-cutting

- **Neo4j / Postgres boundary** stays as `d13f7e9` set it: bills, roll calls, votes,
  cases, case votes, citations, case↔bill relations, nominations, amendments,
  promises, powers, and every `bill_*` join table are Postgres, referencing Neo4j
  entities by indexed uuid, joined in the app. Only members, justices, presidents,
  and (if ever promoted) committees are Neo4j entities.
- **Knowledge-graph cross-links** (the "one graph, many views" test): bill →
  sponsor/cosponsor entities (Phase 2); vote → member entity (exists); member →
  voting record + blocs (Phases 3–4); bill ↔ case via `case_bill_relations` (5a);
  judge → nomination → Senate roll call → president (5a); promise → bill → case
  (Phase 6); power → precedent case + bill (Phase 8). Every actor page (entity
  detail) links into the legislation views that mention it.
- **Entity-type / crosswalk-key checklist** (`judge` in 5a, any future
  `committee`): `entityTypes` enum → `entity-colors.ts` → `/data/entities` filter →
  audit `e.type === …` call sites → add the crosswalk-key property + Neo4j unique
  constraint (`bioguideId`, `courtlistenerId`, …).
- **Freshness UX**: `sync_runs` drives a "last synced" line on `/legislation`,
  `/legislation/cases`, and `/data`, amber past a per-source threshold, red on a
  failed last run. The scheduled job (Phase 1d) keeps every automated source
  current; hand-curated tools (promises, powers, lower-court cases) are exempt by
  design and labelled as curated.
- **Verification / `vitest`**: introduced in Phase 0, kept narrow — schema
  round-trips + constraint checks against a scratch schema, and the pure functions
  (`blocs.ts`, `textDiff.ts`, party-line detection, precedent-graph assembly).
  `npm test` runs in CI before `build`. Each phase adds its checks; a later phase
  that breaks an earlier one fails the suite.
- **Global search** (`src/app/api/search/route.ts`): add `bills` and `cases` groups
  to `SearchResponse`, following the existing `byRank` pattern over `title` /
  `billNumber` / case `name`.
- **Ingest API** (`src/lib/ingest/batch.ts`): extend the batch payload with
  `bills` / `rollCalls` / `votes` / `cases` arrays and the `$ref:` mechanism, so
  programmatic ingestion isn't script-only — on-pattern with how `claims` are
  handled, and it gives the hand-curated phases a bulk path.
- **Backups**: `npm run db:export` dumps every Postgres table generically — new
  tables are covered free. A `reconstruct:*` script is only needed where an importer
  creates Neo4j entities that could be lost independently of Postgres — i.e. Phase 0
  members and Phase 5a judges. Add `reconstruct:members` /
  `reconstruct:judges` (re-derive from the crosswalk keys, recreate with original
  uuids), mirroring `reconstruct:fec-graph`.
- **`/data` layout** intro sentence ("six primitives") and `pagesContent`: as each
  phase ships, drop its item from `pagesContent.legislation.features` (that array is
  the `PageDescription` "what's planned" disclosure). When the array empties, the
  page shows only real tools.

## Status

- [ ] **Phase 0 — Member backfill.** `entitySchema.bioguideId` + Neo4j unique
      constraint; `backfill:members` from `congress-legislators`; `vitest` set up.
- [x] **Phase 1 — Full bill & roll-call import + sync.** Schema (`roll_calls`,
      `sync_runs`, `votes.rollCallId`/`party`/nullable `billId` + partial-unique
      split + check constraint, `bills` structured columns); db layer + validation;
      `congress.ts` mapping helpers (21 vitest cases); self-contained
      `import-congress-bills.mjs` / `import-congress-votes.mjs` (incremental via
      `sync_runs.cursor`); `.github/workflows/sync-legislation.yml`; `DataFreshness`
      line on `/legislation` + `/data`; roll-call count on the bill list; roll-call
      sections on the bill detail page; homepage "Roll-call votes" stat.
      **Pending:** a live run against the Congress.gov API to confirm the response
      envelope (the parsers in `congress.ts` are tolerant but unverified) and to
      run `db:push` for the schema. Original checklist:
      <br>`roll_calls` +
      `votes.rollCallId` (partial-unique migration); `sync_runs`; full-Congress
      `import-congress-bills` + `import-congress-votes` (incremental);
      `/api/cron/sync-legislation` + `vercel.json`; freshness line; homepage stat.
- [x] **Phase 2 — Bill Explorer.** `bill_cosponsors` / `bill_actions` /
      `bill_committees` / `bill_relations` / `bill_text_versions` tables +
      relations; `src/lib/validation/billDetail.ts`, `src/lib/db/billDetails.ts`
      (per-bill lists, create/delete, `replaceBillDetails` bulk), server actions;
      detail page gains Cosponsors / Timeline / Committees / Related bills / Text
      sections (subjects + policy-area chips already from Phase 1); one reusable
      `BillChildEditor` client component wired into `/data/bills/[id]/edit` for all
      five; `import-congress-bills.mjs` extended to pull each bill's sub-resources
      (`--skip-details` opts out) and resolve related-bill links.
      **Pending:** same as Phase 1 — `db:push` for the new tables, and a live run
      to populate them. AI explainer sub-phase not built (still optional).
- [x] **Phase 3 — Voting Record Explorer.** `votes.party` snapshot (Phase 1,
      verified populated). `src/lib/legislation/votingRecord.ts` — pure
      `partyMajorityPosition` / `brokeWithParty` / `agreementRate` (13 vitest
      cases); `src/lib/db/votingRecord.ts` — `listVoterRollCallVotes` (join to
      roll_calls + bills), `votesByRollCall`, `listSharedVotes`.
      `/legislation/members/[entityId]` — headline stats (roll-call count,
      party-line rate, broke-with-party count) + a client list filterable by
      policy area and "broke with party only". `/legislation/compare?a=&b=` —
      native GET form, agreement rate + disagreement list. Roll-call breakdowns on
      the bill page now link members to their record; `/legislation` links to
      compare. Live-verified against imported data.
- [ ] **Phase 4 — Voting-bloc detection.** `blocs.ts` (unit-tested);
      `/legislation/blocs` force graph. Revives archived `/alignment`.
- [ ] **Phase 5a — Cases + bridges.** `judge` type; `court_cases` / `case_votes` /
      `case_bill_relations` / `nominations`; CourtListener + SCDB import (cron);
      `/legislation/cases` + detail; `/data/cases`.
- [ ] **Phase 5b — Precedent graph.** `case_citations`; "relies on / cited by";
      `/legislation/precedent` (unit-tested assembly).
- [ ] **Phase 6 — Campaign Promise Tracker.** `promises` (status enum);
      `/legislation/promises`; `/data/promises`.
- [ ] **Phase 7 — Amendment Diff.** `amendments` with structured change fields;
      word-level `textDiff.ts` (unit-tested); honest "no structured diff" state;
      `/legislation/amendments`.
- [ ] **Phase 8 — Authority & Powers.** `powers` + `power_dependencies`;
      `/legislation/authority` (+ per-actor view) + `/authority/graph`;
      `/data/powers`.

## Definition of done

The category is complete when every row holds. Each is checkable without judgement.

| Sub-tool | Done when |
|---|---|
| **Bill Explorer** (#14) | `/legislation/[id]` shows sponsor, cosponsors, subjects, action timeline, committees, related bills, roll calls, text-version links, and court treatment — all from imported data — for a bill picked at random from the current Congress. |
| **Bills data** | `import-congress-bills` has run for the current Congress; a second run updates changed bills and inserts nothing else; `/legislation` shows the real count; the freshness line reads green. |
| **Voting Record** (#16) | `/legislation/members/[entityId]` for any current member lists every roll call they cast, filterable by policy area, with a correct "broke with party" flag verified by hand against 3 known rebel votes. |
| **Roll-call data** | Every roll call in the current Congress is imported with one `votes` row per voting member; both partial-unique indexes reject duplicates in the test suite. |
| **Agreeability / Compare** (#18) | `/legislation/compare` returns an agreement rate and the disagreement list for any two members, matching a hand count on a 10-roll-call sample. |
| **Voting-bloc detection** (#17) | `/legislation/blocs` clusters a full-Congress vote matrix; clusters correspond to the known caucuses on inspection; every edge clicks through to its roll calls; `blocs.ts` is unit-tested. |
| **Court Case Explorer** (#47) | `court_cases` model holds any court; SCOTUS cases for a full recent term are imported with per-justice `case_votes`; `/legislation/cases/[id]` shows question, holding, lineup, and statutes at issue; a lower-court case can be added via `/data/cases` and renders identically. |
| **Precedent Graph** (#48) | `/legislation/precedent` renders the SCOTUS citation network with edges typed by treatment; a known overruling (e.g. *Dobbs*→*Roe*) shows the correct edge; assembly is unit-tested. |
| **People↔Courts bridge** | A justice's entity page shows "nominated by {president}, confirmed X–Y" linked to the real Senate roll call; a bill's page shows any case that struck or upheld it. |
| **Campaign Promise Tracker** (#13) | `/legislation/promises` renders promises grouped by status with the `abandoned`/`blocked` distinction; a promise links through to its bill and to any case affecting it; `/data/promises` round-trips. |
| **Amendment Diff** (#15) | `/legislation/amendments` and the bill-page section render, for amendments with upstream replacement text, a readable word-level diff captioned by purpose; for those without, a labelled structured summary — never a raw line-noise diff. `textDiff.ts` is unit-tested. |
| **Authority & Powers** (#44–46) | `/legislation/authority` answers "can {actor} do {action}?" with authority type, source, required cooperation, constraints, and linked precedent; the per-actor view groups powers by authority type; `/authority/graph` renders `power_dependencies`. |
| **Freshness** | Every automated source is on the weekly cron; `sync_runs` is written each run; the freshness line surfaces staleness and last-run errors on `/legislation`, `/legislation/cases`, and `/data`. |
| **Regression net** | `npm test` covers every schema round-trip and pure function added across Phases 0–8 and runs in CI before `build`. |
| **Category chrome** | `pagesContent.legislation.features` is empty (or replaced with a real "what's here" list); `nav.ts`'s "Bills, amendments, votes, promises, court cases" all resolve to working views; the `/data` layout lists the real tabs. |
