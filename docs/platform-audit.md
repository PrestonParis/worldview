# Worldview platform audit — 2026-10-08 (revised)

Scope: the whole platform on branch `portfolio-readiness`, working tree
included (243 uncommitted paths). Run against local infra: `.env.local` points
at Docker Supabase + Neo4j with 13,957 entities. Every route was requested live,
types, lint, and tests were run, and API routes, auth, and workflows were read.

This revision re-checks every finding from the first pass the same day. The
status table below shows what has been resolved; the rest of the document
covers only what is still open.

## Status since the first pass

| # | Finding | Status |
| --- | --- | --- |
| 1 | Whole-graph loads per request | **Partly fixed.** `/money`, `/money/industries`, `/money/map` no longer call `listEntities()`, and Money payloads dropped from 11–17 MB to 0.7–3.3 MB. Search, `/people`, detail pages, and `/data/*` still load everything. |
| 2 | No error/404 boundaries; DB outage takes down the site | **Mostly fixed.** Added `error.tsx`, `(shell)/error.tsx`, `global-error.tsx`, `not-found.tsx`. The shell and Geography layouts treat a failed profile lookup as signed out. Neo4j has 10 s connect / 15 s acquisition timeouts. There is still no `loading.tsx`. |
| 3 | Registration code brute-forceable | **Open.** |
| 4 | Features advertised that don't exist | **Fixed.** `features` was removed from `pages-content.ts`, the unused `NavPage.bundles` is gone, and My Government's copy now says "votes, donors, and connections". |
| 5 | DC offices mislabelled | **Fixed.** DC now returns Mayor, Council chair, Councilmember, and Councilmember (at-large). |
| 6 | Stale README | **Fixed.** It links to the live site, gives the entity count as ~14,000, and no longer has the demo-video TODO. |
| 7 | Prod behind the working tree | **Open, and growing:** 184 → 243 uncommitted paths. |
| 8 | Census key fails post-deploy | **Fixed in code, not deployed.** `scripts/backfill-datasets.mjs` now checks the key and skips Census datasets with a warning. The last post-deploy run (2026-10-06) is still red. |
| P2 | `force-dynamic` everywhere, no caching | **Open.** 25 uses; no `"use cache"` / `unstable_cache` anywhere. |
| P2 | Missing metadata, sitemap, robots | **Partly fixed.** `sitemap.ts` and `robots.ts` were added. Metadata is missing on 22 of 49 pages (was 30 of 48), 5 of them public. |
| P2 | Shell `px-8` on phones | **Fixed** (`px-4 sm:px-8`). |
| P2 | Lint warnings | **Fixed**, but a new lint **error** has appeared (below). |
| Geo | Unvalidated map project writes | **Fixed.** The update action parses `mapProjectSchema.partial()`, and layers are capped at 2,000. |
| Geo | `revalidatePath` on every autosave | **Fixed.** |
| Geo | Signed-out Save shows a bare error | **Fixed.** Signed-out users see "Sign in to save graphics" instead of the graphics bar. |
| Geo | Header lists unbuilt features | **Fixed.** The header shows title and tagline only. |
| Geo | No platform data, no US boundaries, not responsive, no templates, Phase 4 | **Open.** |

## Automated checks

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| `eslint` | **1 error**: `react-hooks/set-state-in-effect` at `src/components/graph/graph-view.tsx:68`. `useEffect(() => setSelectedId(rootEntity?.id ?? null), [rootEntity?.id])` will fail CI's lint step. |
| `vitest` | 30 files, 279 tests, all pass (was 27 / 264) |
| Post-deploy sync | Last run (2026-10-06) failed on the Census key. The fix is uncommitted. |
| Neo4j keepalive, quiz purge | Green daily since 2026-10-06 |
| Sync money / Sync legislation | Last runs (2026-10-05) failed; neither has run since secrets were set |

## Route crawl (local dev server)

| Route | First pass | Now | Note |
| --- | --- | --- | --- |
| `/money` | 14.1 MB | 3.3 MB | ~3,300 full contribution rows (`notes`, `sourceRecordId`, timestamps) are still serialized |
| `/money/lobbying` | 17.3 MB | 1.1 MB | Still loads every bill via `listBills()` |
| `/money/industries` | 11.5 MB | 690 KB | |
| `/money/map` | 11.5 MB | 681 KB | |
| `/people` | 1.3 MB | **2.2 MB** | Now loads all entities and all edges directly in `people/page.tsx:28` |
| `/people/orgs` | 2.1 MB, 1.6 s | 2.1 MB, 2.4 s | |
| `/people/[slug]` (new) | — | 75 KB, 0.8 s | Small output, but calls `listEntities()` server-side |
| `/legislation/[id]` | — | 48 KB, 0.8 s | Same |
| `/legislation/compare` | 1.4 MB | 1.4 MB | |
| `/immigration` | 1.3 MB | 1.3 MB | |
| `/crime` | 766 KB | 771 KB | |
| `/data/entities` | 24.8 MB, 17 s | 24.8 MB, **19.9 s** | Unpaginated |
| `/data/edges` | 28.3 MB, 12 s | 28.3 MB, 11.8 s | Unpaginated |
| `/data/bills` | 26.8 MB, 9.6 s | 26.8 MB, 10.0 s | Unpaginated |
| `/data/contributions` | 16.8 MB | 16.8 MB | Unpaginated |
| `/data/claims` | 11.4 MB | 11.4 MB | Unpaginated |
| `/nonexistent-page` | default 404 | custom 404 | |
| `/sitemap.xml`, `/robots.txt` | 404 | 200 | |

These are dev-mode sizes. A production build is smaller, but the ratios hold.

## Open findings

### P0

**1. Registration code can be brute-forced.**
This is unchanged. `sendEmailCodeAction`, `passwordRegisterAction`, and the
OAuth registration path check `REGISTRATION_CODE`
(`src/lib/actions/auth.ts:51`, `:129`, `:175`) before calling Supabase, and
Supabase is where the Turnstile token is verified. A direct server-action call
can therefore test codes without solving captcha. The code is 6 digits and
there is no rate limit, so trying every code takes hours. Any account that gets
in can edit all data. Fix: verify Turnstile server-side before the code check,
rate-limit by IP (a Postgres counter is enough), and use a long random code.

**2. Lint error breaks CI.**
`src/components/graph/graph-view.tsx:68` syncs `selectedId` from `rootEntity`
in an effect. Either derive the selection during render or key the component on
`rootEntity?.id`, which resets its state when the root changes.

**3. Commit and deploy.**
243 paths are uncommitted, and they include fixes 2–8 above. Production
(`portfolio-readiness`) and the scheduled syncs (`main`) both still run the
pre-audit code, including the backfill that fails on the Census key.

### P1: performance

**4. Remaining whole-graph loads.**
`listEntities()` and its siblings are still called unfiltered from 35 places.
The ones on public pages:
- `src/app/api/search/route.ts:57`: all entities, claims, and sources on every
  keystroke. This is now the hottest remaining path, since the header search
  hits it constantly. Replace it with a Neo4j full-text index query with
  `LIMIT`, plus `ILIKE … LIMIT` for claims and sources.
- `src/app/(shell)/people/page.tsx:28`,
  `src/components/graph/graph-page.tsx:41`,
  `src/components/entities/entity-sections-page.tsx:18`: all entities plus all
  edges, scoped in JS. Push the side, type, and depth scoping into Cypher.
- `src/app/(shell)/people/[slug]/page.tsx:42`,
  `src/app/(shell)/legislation/[id]/page.tsx:104`,
  `src/app/(shell)/elections/[id]/page.tsx:56`: detail pages that need a
  handful of names. Use `getEntityNames(ids)`.
- `src/app/(shell)/money/lobbying/page.tsx:15`: `listBills()` for every bill.
  Fetch only the bills the registrations reference.
- `/money`: trim contribution rows to the fields the client renders.

**5. `/data/*` is unpaginated.**
These pages take 10–20 s and ship 11–28 MB. They are contributor-only for
writes, but they are publicly browsable and linked from search results. Add
cursor pagination and a filter box.

**6. No caching.**
There are 25 `force-dynamic` uses and no cache layer. Immigration, crime,
demographics, datasets, and the legislation overview change weekly but are
recomputed on every view. Move those loaders to `"use cache"`/`unstable_cache`
with tags, and have the importers revalidate after a sync. Check
`node_modules/next/dist/docs/` for the Next 16 caching API first.

### P2

- **Metadata gaps on public pages.** The home page (`(shell)/page.tsx`),
  `/elections/[id]`, `/legislation/[id]`, `/legislation/members/[entityId]`,
  and `/people/orgs/[id]` have no title or description, so they get generic tabs
  and no share preview. The other 17 pages without metadata are under `/data`.
- **No `loading.tsx`.** The boundaries cover failure, but slow sections
  (`/people/orgs`, `/legislation/compare`, `/data/*`) render nothing until the
  whole page resolves.

## Section review

| Section | State | Main gaps |
| --- | --- | --- |
| **Immigration** (flagship) | Strong | 1.3 MB; cache the loader |
| **Crime** | Strong | Depends on uncommitted importers |
| **Demographics** | Solid, fast | ACS refresh needs a valid Census key |
| **Datasets** + partner API | Good: hashed keys, Zod validation, ownership checks | None found |
| **My Government** | Works end to end; DC fixed | None found |
| **Legislation** | Overview, bills, members, compare work | `[id]` loads the whole graph; `[id]`/members lack metadata |
| **Money** | Much lighter now | `/money` 3.3 MB; lobbying loads every bill |
| **Elections** | Explorer and detail pages work | `[id]` loads the whole graph and has no metadata |
| **People** | New public profile pages (`/people/[slug]`) with a directory and search | `/people` grew to 2.2 MB; graph scoping happens in JS; lint error in `graph-view.tsx` |
| **Quiz** | Polished | None found |
| **Manage Data** | Auth-gated writes enforced by `guard.test.ts` | Unpaginated, 10–20 s |
| **Geography** | Editor solid; signed-out UX and validation fixed | Not connected to platform data (below) |

## Geography

### What exists
- MapLibre with 6 basemap styles, country search/selection and neighbor
  highlighting, and 6 working feature toggles. "Lakes" and "Islands" are still
  `supported: false`.
- Konva annotation layer with 10 tools, a layers panel with reorder and rename,
  and undo/redo (100 steps).
- PNG export at 1920×1080, 1080×1920, or a custom size.
- Saved graphics for signed-in users with 1.5 s autosave; Zod-validated writes
  capped at 2,000 layers. Signed-out users get a "Sign in to save graphics"
  link and can still export.
- The header shows title and tagline only. The unbuilt war/alliance/sanctions/
  trade list is gone.

### Open gaps
1. **No connection to Worldview data.** This is still the biggest gap.
   `src/lib/map/choroplethLayer.ts` exists, but only the elections results map
   uses it. Election results, demographics, immigration by state, crime rates,
   and donor geography cannot be put on a Geography graphic. Making the
   datasets API (`/api/data/v1/datasets/[slug]/observations`) a layer source
   would cover every dataset at once.
2. **US geography.** The studio has country borders only, and
   `src/lib/geo/states.ts` is 30 lines. There are no state, county, or district
   boundaries.
3. **Not responsive.** There are still no breakpoints in `src/components/map`,
   `layout`, or `annotate`. Show a view-only or export-only layout below `lg`.
4. **No templates.** Every graphic starts from a blank world map.
5. **The section has no subject of its own.** With the alliance/sanctions/trade
   copy removed, it is honestly a map studio. If geopolitics is still the goal,
   it needs a real source (e.g. Correlates of War alliances, OFAC/EU sanctions
   lists, BACI trade).
6. **Phase 4 (live broadcast output)** is waiting on the unlisted-link access
   decision in `docs/geography-graphics-plan.md`.

### Recommended order
1. Dataset → choropleth layers on countries, then US states.
2. US state and county boundaries.
3. Templates built on those layers.
4. Responsive view/export layout.
5. Phase 4 once the access model is decided.

## Suggested sequence

1. Fix the `graph-view.tsx` lint error, commit, and deploy. That ships most of
   this revision's fixes and turns post-deploy green.
2. Harden registration: server-side Turnstile, a rate limit, and a long code.
3. Replace the search API's full loads, then `/people` and the detail pages.
4. Paginate `/data/*`.
5. Add caching for weekly-refreshed sections and `loading.tsx` for slow ones.
6. Add metadata to the 5 public pages that lack it.
7. Geography data layers.
