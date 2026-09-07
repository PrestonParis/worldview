# People & Power — from a node dump to a relationship intelligence tool

## Context

`/people` renders every entity in one force-directed ReactFlow canvas
(`src/components/graph/graph-page.tsx` → `graph-view.tsx` → `entity-graph.tsx`),
with a type-color legend and a search box that navigates to
`/data/entities/[id]`. That profile page is decent — header, bio slot, donors,
connections sidebar, social links, "at a glance" facts from `metadata`.

What the data actually looks like now (Neo4j, post-migration):

| type | count | isolated (degree 0) |
|---|---|---|
| politician | 591 | 4 |
| pundit | 326 | **302** |
| journalist | 76 | **70** |
| organization | 74 | 2 |
| company | 63 | 0 |

- **1,205 edges, but the graph is a hub-and-spoke star.** `United States House
  of Representatives` (degree 437), `Republican Party` (300), `Democratic Party`
  (284), `United States Senate` (100) absorb almost everything. A typical
  politician is degree 2–3: linked to their party and their chamber, nothing
  else. Real person-to-person structure barely exists.
- **~33% of nodes are isolated** — the entire pundit/journalist half of the
  graph is unconnected dots.
- Edge labels are free text: `affiliated with` (587), `serves in` (537),
  `serves as governor of` (50), plus ~30 podcast/host edges. No vocabulary.
- `biography` 0% filled. `imageUrl` 0% filled. `description` is a one-liner.
  `metadata` sometimes carries `party` / `state` / `office` / `roles` / `country`.
- Edge `validFrom` / `validTo` almost always empty — time is not modelled.

`pagesContent["people"].features` promises six things — **Relationship graph,
Organization graph, Administration personnel map, Endorsement graph, Political
dynasty / family graph, Career timeline** — and none exist as a distinct view.
`src/components/entities/entity-sections-page.tsx` and `entity-type-section.tsx`
are orphaned (nothing imports them) — leftovers from the de-bloat.

## Scope & definition of done

"Finished" means:

- [ ] `/people` opens on a **legible** view, not 1,130 dots. Search → focus a
      person's neighbourhood; filter by entity type and relationship type.
- [ ] Every `features` entry is a real route: `/people`, `/people/orgs`,
      `/people/administration`, `/people/endorsements`, `/people/dynasties`,
      and a career timeline on the profile.
- [ ] Typed relationship vocabulary; the edge form uses it; existing free-text
      labels are backfilled.
- [ ] < 5% isolated nodes. Every pundit/journalist connects to at least their
      outlet or show.
- [ ] Politicians: 100% have a real `biography`, an `imageUrl`, and a **dated**
      career timeline (term-by-term).
- [ ] Profile is tabbed: Overview · Connections · Timeline · Money · Appearances.
      Money tab reuses `getEntityContributionSummary`; Timeline overlays votes
      (`src/lib/db/votes.ts`) and contributions.
- [ ] `entity-sections-page.tsx` / `entity-type-section.tsx` deleted or wired in.

The core — the thing that makes it stop feeling like a demo — is **Phases 1–3
plus the enrichment track**. Phases 4–8 are the six named features and can be
built in any order on that foundation.

## Design decisions taken up front

1. **Entities stay in Neo4j.** Graph queries (neighbourhoods, paths, clusters)
   are the whole point. Postgres keeps claims / bills / votes / contributions;
   cross-store joins happen in the page loader, as they already do on `/money`.
2. **Lenses, not silos.** The six features are filtered views over one graph
   plus a few dedicated layouts — not six data models. A `relType` filter, a
   root node, and a layout choice cover most of them.
3. **A relationship vocabulary** (`src/lib/relationships.ts`) replaces free-text
   labels as the primary key. The free-text `label` survives as the human
   detail ("Chief of Staff", "guest, ep. 412").
4. **Ego-network focus over full-graph dumps.** The default interaction is
   "click a node → re-root on its neighbourhood at depth N", served by a
   Cypher neighbourhood query, not a 1,130-node client render.
5. **Time is first-class.** Every institutional / employment / endorsement edge
   carries `validFrom` / `validTo`; the profile timeline is built from them.
6. **Enrichment is allowed and scripted.** Wikipedia/Wikidata for bios+images,
   `congress-legislators` for terms and committees (already fetched by the FEC
   scripts). Every enrichment script is idempotent and snapshots first via
   `scripts/export-db.mjs` conventions.

## Phase 1 — Make the graph usable at 1k+ nodes

**Server queries** — `src/lib/neo4j/entities.ts`, `src/lib/neo4j/edges.ts`:

- `listEntityNeighborhood(rootId, { depth = 1, relTypes?, entityTypes?, includeHubs = false })`
  → `{ entities, edges }` for the ego network.
  `MATCH (root:Entity {id:$rootId})-[r:RELATED_TO*1..$depth]-(n:Entity) …`,
  optionally dropping the four mega-hubs unless `includeHubs`.
- `listOverviewGraph()` → a curated default: top-degree non-hub nodes + their
  interconnections, ~120 nodes, so `/people` has something on first paint
  without loading everything.
- `relationshipTypeCounts()` and `entityTypeCounts()` for the filter bar.

**Route** — `src/app/(shell)/people/page.tsx`, `src/components/graph/graph-page.tsx`:

- Read `?root`, `?depth`, `?type`, `?rel` from `searchParams`. No `root` →
  `listOverviewGraph()`. `root` set → `listEntityNeighborhood`.
- Keep `dynamic = "force-dynamic"`.

**Client** — `src/components/graph/`:

- `graph-view.tsx`: a filter bar — entity-type toggles, relationship-type
  toggles (grouped by category), depth 1–3 selector, "show party / chamber
  hubs" switch. All push to `searchParams`.
- `entity-graph.tsx`: degree-based node sizing (pass `size` to `entity-node.tsx`);
  hub nodes get a distinct ring. **Single-click re-roots** (`?root=<id>`);
  double-click opens the profile. Reuse the `edgeStyles` prop (added during the
  Money work) to colour edges by relationship category.
- `entity-search.tsx`: selecting a result sets `?root=<id>` instead of
  navigating away.
- `src/lib/graph/layout.ts`: add `computeRadialLayout(rootId, rings)` for focus
  mode (root centre, ring per hop).

## Phase 2 — Relationship vocabulary + connect the isolated half

**`src/lib/relationships.ts`** (new) — the vocabulary:

```ts
export const relationshipCategories = [
  "institutional", // serves in, chairs, sits on committee
  "affiliation",   // member of, fellow at, founded
  "employment",    // staffer for, adviser to, campaign manager for
  "political",     // endorsed, campaigned for, appointed, nominated
  "media",         // hosts, co-hosts, guest on, cited by
  "personal",      // family of, married to, mentee of, ally of
  "corporate",     // donated to, lobbied for, board member of
] as const;

export interface RelationshipType {
  slug: string; label: string; category: (typeof relationshipCategories)[number];
  verb: string; inverse: string; directed: boolean;
}
export const relationshipTypes: RelationshipType[] = [ /* ~30 entries */ ];
```

**Schema** — `src/lib/validation/edge.ts`: add `relType: z.string()` (a
`relationshipTypes` slug) and optional `role: z.string().max(200)`. `label`
stays as free-text detail. `src/lib/neo4j/edges.ts` `toEdge` / `createEdge`
read & write `relType`, `role`.

**Form** — `src/components/forms/edge-form.tsx`: a grouped `relType` picker
drives a suggested `label`; `role` field appears for employment/political.

**Backfill** — `scripts/backfill-relationships.mjs` (new): map the existing
labels (`affiliated with` → `affiliation`, `serves in` / `serves as governor
of` → `institutional`, `hosts*` / `co-hosts` → `media`, `donated to` →
`corporate`). Idempotent; snapshot first.

**Connect the isolated 372** — `scripts/enrich-media-affiliations.mjs`
parses the outlet/show already named in each isolated person's own
`description` ("host of Democracy Now!") and wires them to an org node.
First pass connected 48. The remaining ~320 name no outlet in their
description — a Wikidata `P108` (employer) / `P1327` (partner) pass is
the follow-up to get the isolated share below 5%.

## Phase 3 — The entity profile as the centre of gravity

**Promote the profile to `/people/[id]`** (`src/app/(shell)/people/[id]/page.tsx`);
keep `/data/entities/[id]` as the admin/edit-oriented view (or redirect it).

**Tabs** — `src/components/entities/`:

- `profile-tabs.tsx` — Overview · Connections · Timeline · Money · Appearances.
- `connection-list.tsx` — `listEdgesForEntity` grouped by relationship
  **category**, each row: counterpart (linked), `role`, date range, source.
- `career-timeline.tsx` — vertical dated timeline from `institutional` edges +
  `metadata.roles` + `validFrom/validTo`.
- `appearances.tsx` — `media` edges grouped by outlet.
- Money tab reuses `getEntityContributionSummary` + the Money work's
  `entity-money-summary.tsx`.

**Enrichment** — `scripts/enrich-bios.mjs` (new): Wikipedia REST summary API
keyed on `name` → `biography` (1–2 paragraphs), `imageUrl` (Wikimedia),
`websiteUrl`. Politicians first (591), then orgs, then pundits/journalists.
Rate-limited, cached under `backups/`, idempotent.

**Cleanup**: delete `src/components/entities/entity-sections-page.tsx` and
`entity-type-section.tsx` (orphaned), or repurpose `entity-type-section.tsx`
as the Connections grouping component.

## Phase 4 — Organization Graph (`/people/orgs`)

- `src/app/(shell)/people/orgs/page.tsx` (directory) + `orgs/[id]/page.tsx`.
- `src/lib/neo4j/entities.ts`: `listOrganizationGraph(orgId)` → current staff,
  alumni (`institutional` / `employment` edges with a past `validTo`),
  affiliated politicians, partner orgs; donors via a `contributions` join in
  the loader.
- Org profile: roster (current / past split), money in & out, connected
  politicians, sister organisations. Org-rooted radial layout.
- Covers the vision's "think tank → staff → alumni → donors → politicians →
  appointments → partner orgs".

## Phase 5 — Administration Personnel Map (`/people/administration`)

- Role detail lives on the edge, not a new node: `appointed to` relType with
  `metadata` `{ title, department, start, end, appointedBy, term }`, plus a
  `previously` relType carrying `priorSector`
  (industry / think-tank / military / elected / campaign / academia).
- Seed the executive-branch org tree — `data/executive-branch.json` (President
  → 15 departments → major agencies) loaded by
  `scripts/import-administration.mjs`, which also seeds the current cabinet and
  each appointee's prior jobs.
- Route: President-centred radial, `term` selector (Trump 45 / Biden / Trump 47),
  filter chips by `priorSector`. Side-by-side term comparison as a stretch.

## Phase 6 — Endorsement Graph (`/people/endorsements`)

- `endorsed` relType (directed: endorser → candidate), `metadata`
  `{ cycle, office, date }`. Endorsers span politician / organization / union /
  newspaper / pundit.
- Route: clustered layout (connected-component grouping client-side — GDS/Louvain
  isn't available on Aura Free), filter by cycle / office / endorser type.
  "Clusters of support" is the headline output.
- `scripts/import-endorsements.mjs` — one cycle's endorsements as the seed.

## Phase 7 — Dynasty / Family Graph (`/people/dynasties`)

- `family of` relType with `metadata.relation`
  (parent / child / sibling / spouse / cousin / in-law). Separate `family`
  overlay kinds — shared `staff`, `business`, `campaign`, `appointment` — reuse
  the relTypes from Phase 2 but are surfaced together here.
- `src/lib/graph/layout.ts`: `computeFamilyTreeLayout` (generational rows).
- Route: pick a family (Kennedy / Bush / Trump / Cheney / Romney / …) → tree;
  toggle the non-family connection kinds as overlay edges.
- `scripts/import-dynasties.mjs` — a handful of families as seed.

## Phase 8 — Career Timeline (time as first-class)

- `scripts/enrich-terms.mjs` (new): `congress-legislators` `legislators-*.yaml`
  (already fetched by the FEC scripts) → dated `serves in` edges per term
  (chamber, party, state, start, end) and `committee-membership-current.yaml` →
  `sits on committee` edges. This alone adds hundreds of real, dated edges and
  de-hubs the graph.
- Profile Timeline tab (Phase 3) becomes rich: positions, party switches,
  notable votes (`src/lib/db/votes.ts` join), endorsements given/received,
  contribution timeline.
- `/people/[id]?compare=<id2>` — two career timelines side by side.
- `src/components/entities/career-timeline.tsx` + `src/lib/time.ts` helpers.

## Data enrichment track (runs alongside Phases 1–3)

| script | source | effect |
|---|---|---|
| `scripts/enrich-terms.mjs` | congress-legislators YAML | dated term + committee edges; de-hubs the graph |
| `scripts/enrich-bios.mjs` | Wikipedia REST summary | `biography`, `imageUrl`, `websiteUrl` |
| `scripts/enrich-media-affiliations.mjs` | curated JSON / Wikidata | connects the 372 isolated pundits/journalists |
| `scripts/backfill-relationships.mjs` | existing labels | assigns `relType` to all 1,205 edges |

All idempotent, all snapshot to `backups/` first, all runnable against either
env (`env:docker` / `env:cloud`), then `db:migrate-neo4j` pushes Docker → Aura.

## Files touched

**New**
- `src/lib/relationships.ts`, `src/lib/time.ts`
- `src/app/(shell)/people/[id]/page.tsx`
- `src/app/(shell)/people/orgs/page.tsx`, `people/orgs/[id]/page.tsx`
- `src/app/(shell)/people/administration/page.tsx`
- `src/app/(shell)/people/endorsements/page.tsx`
- `src/app/(shell)/people/dynasties/page.tsx`
- `src/components/entities/profile-tabs.tsx`, `connection-list.tsx`,
  `career-timeline.tsx`, `appearances.tsx`
- `scripts/backfill-relationships.mjs`, `enrich-terms.mjs`, `enrich-bios.mjs`,
  `enrich-media-affiliations.mjs`, `import-administration.mjs`,
  `import-endorsements.mjs`, `import-dynasties.mjs`
- `data/media-affiliations.json`, `data/executive-branch.json`

**Changed**
- `src/lib/neo4j/entities.ts` (+ `listEntityNeighborhood`, `listOverviewGraph`,
  `listOrganizationGraph`, `*TypeCounts`)
- `src/lib/neo4j/edges.ts` (`relType` / `role` read+write, `listEdgesForEntity`
  grouping-friendly)
- `src/lib/validation/edge.ts` (`relType`, `role`)
- `src/lib/graph/layout.ts` (`computeRadialLayout`, `computeFamilyTreeLayout`)
- `src/components/graph/graph-page.tsx`, `graph-view.tsx`, `entity-graph.tsx`,
  `entity-node.tsx`, `entity-search.tsx`
- `src/components/forms/edge-form.tsx`
- `src/lib/pages-content.ts` / `src/lib/nav.ts` (sub-routes; feature list stays)
- `src/app/(shell)/data/entities/[id]/page.tsx` (redirect or keep as admin view)

**Deleted**
- `src/components/entities/entity-sections-page.tsx` (+ maybe
  `entity-type-section.tsx`)

## Status

**Phase 1 — mostly done** ("People Phase 1: scope the graph so /people is
legible"). `src/lib/graph/scope.ts` + `graph-page.tsx` / `graph-view.tsx` /
`entity-search.tsx`: overview shows the connected core (~160 nodes) instead of
the full graph; `?root` focuses an ego network with a hop selector and hub
toggle; entity-type filter chips. **Remaining**: degree-based node sizing and
click-a-node-to-re-root (both need `entity-graph.tsx`), and a server-side Cypher
`listEntityNeighborhood` to replace the in-memory scope.

**Phase 2 — vocabulary done** ("People Phase 2: typed relationship vocabulary").
`src/lib/relationships.ts`, `relType` + `role` on edges, grouped picker in the
edge form, `backfill-relationships.mjs` typed all 1,275 edges. **Remaining**:
surface the relType filter + category edge colours in `graph-view.tsx` /
`entity-graph.tsx`; the Wikidata pass to connect the ~320 still-isolated
pundits/journalists.

Build order from here: **enrichment track → Phase 3** is the rest of the
committed core ("People is finished" = through there). Phases 4–8 are the six
named features and sit on the Phase 1–2 foundation; build in any order, each is a
route + a query + a layout choice.
