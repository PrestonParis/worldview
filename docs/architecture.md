# Architecture

Worldview is one Next.js application, not a set of services. Feature
ownership stays visible in the folder structure, and only stable product
primitives are shared.

## Site structure

- **Public pages** (`src/app/(shell)/`): the issue hubs (`immigration`,
  `crime`, `economy`, ...), `states`, `spending`, `people`, `money`,
  `legislation`, `elections`, `my-government`, `datasets`, the quiz and
  Atlas. They are edited, indexed views of the data and share the header nav.
- **Tools**: three workspaces over the same data, each owning one kind of
  record. A page that covers two kinds lives with the tool whose record is in
  the URL and links to the other.
  - **Subpoena** owns people and organizations and the money between them.
  - **Writ** owns laws and elections: bills, members, races, and the Georgia
    close-races report.
  - **IssueView** owns topics and the statistics behind them, including the
    cross-dataset comparator.
- **Geography** (`src/app/geography/`): the owner-only map studio, outside
  the shell. See [geography.md](geography.md).
- **Editor CRUD** (`src/app/(shell)/data/`) and the batch ingest endpoint
  (`src/app/api/ingest/`).

### Tool shell and routes

All three tools render inside one shell (`src/components/tools/shell/tool-shell.tsx`,
configured per tool in `src/lib/tools/shell.ts`): a tool bar with search and
a switcher, a grouped left rail (links marked `leaves` open a public page),
recently opened items stored in the browser, and a "Browse" sheet on mobile.

Records live at path routes, never query variants:

| Tool | Routes | Legacy URLs |
|---|---|---|
| Subpoena | `/subpoena`, `/subpoena/[slug]` with `/biography`, `/money`, `/quotes` | `/people/[slug]/...` returns 308 to the case file; `publicEntityPath()` builds links |
| Writ | `/writ`, `/writ/[kind]/[id]` (bill, member, race), `/writ/close-races/[election]` | `/writ?bill=` and friends redirect to the docket |
| IssueView | `/issueview`, `/issueview/[view]`, `/issueview/compare` (keeps its query) | `/issueview?view=` redirects |

Other renamed routes are redirected in `next.config.ts` (`/health-care`,
`/people/administration`, `/people/directory`, the old network view).

## Code boundaries

- `src/app` owns routing, metadata, loading and error boundaries. Route files
  assemble features rather than contain business logic.
- `src/components/<domain>` owns the UI for one domain. Large interactive
  tools separate orchestration, pure models and visual sections.
- `src/components/ui` owns domain-neutral interface primitives. Add one when
  the same visual or accessibility contract appears across features.
- `src/lib/<domain>` owns domain rules and static definitions. Pure
  calculations belong here and have unit tests.
- `src/lib/db` owns database access, the entity graph included. Public
  modules such as `stats.ts` stay as facades while implementation details
  move into a matching folder.
- `src/lib/validation` holds the Zod schemas that forms, server actions and
  the ingest API all validate against. Start here when adding a field.
- `src/lib/actions` owns authenticated mutations and revalidation. Actions
  validate input and delegate persistence. `result.ts` is the response
  contract: unexpected failures are logged on the server and the browser gets
  a stable message, never a database or provider error.
- `src/lib/browser` owns browser-only adapters. Stored JSON is untrusted and
  passes the relevant schema before use.
- `scripts` owns ingestion and maintenance commands, with shared parsing and
  storage in `scripts/lib`. See [scripts/README.md](../scripts/README.md).

### Component shape

For interactive tools:

1. A small client orchestrator owns state and effects.
2. A pure model module performs transformations, layout and scoring.
3. Focused components render controls, visualization and results.
4. Browser persistence and server sync stay at the orchestration boundary.

Split a component when a section has its own inputs, behavior, test surface
or reason to change, not to reduce its line count.

## Compatibility contracts

- Published routes and result URLs are product APIs. Changing a route needs a
  redirect or a compatibility reader.
- Stored quiz and Atlas results carry immutable versions. New versions keep
  reading old payloads or ship an explicit migration.
- Dataset slugs, metric identifiers and geography identifiers are stable
  external keys.
- Migrations in `supabase/sql/` are forward-only and idempotent: never edit a
  shipped file, add a new dated one. They run before every production build,
  so a deploy never ships code ahead of its tables, and they keep row-level
  security on every table.

## Checks

`npm run check` runs formatting, lint (warnings fail), route type generation,
TypeScript and the unit tests. CI also builds a fresh Postgres from
`supabase/sql/`, runs the production build against it, and runs the
Playwright smoke tests (`npm run test:e2e`) on desktop and mobile Chromium.

Prettier covers the directories listed in `format:check`. Add a directory
there when you restructure it, until the whole tree is covered.

## Archived tools

A 2026-09-06 cleanup removed `/statements`, `/fact-check`, `/news` and
`/alignment`, which were stubs over the shared entity graph with no data
model of their own. They are preserved on the `archive/legacy-tools` branch:

```bash
git checkout archive/legacy-tools -- "src/app/(shell)/statements"
```

Restoring one also means re-adding its entries to `src/lib/nav.ts`,
`src/lib/pages-content.ts` and `src/lib/type-colors.ts`. Base claims were
kept; only the fact-check verdict layer went (its columns still exist in
`claims`).
