# Worldview

A political research and visualization platform. Entities and relationships live in
Neo4j; claims, sources, bills, votes, and contributions live in Postgres (Supabase).
The tool pages — People & Power, Legislation & Courts, Money & Influence, Elections,
Geography — read from that shared data, alongside a full-bleed map/annotation studio
at `/geography`.

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Choose an environment

```bash
npm run env:docker   # fully local: Supabase CLI + Docker Neo4j
npm run env:cloud    # cloud: Supabase project + Neo4j Aura
```

Each copies a template (`.env.local.docker` / `.env.cloud`) to `.env.local`.
`npm run env:status` shows which is active. Both stores move together — Postgres/Auth
and Neo4j are always either both local or both cloud, never split.

The full ~1,100-entity graph currently lives in the **local Docker Neo4j**; the cloud
Aura instance is seeded from it. Keep them in sync with `npm run db:migrate-neo4j`
(see [Backups](#backups-and-recovery)). Neo4j Aura Free instances **pause after 3 days
idle and are deleted after 30 days idle** with no point-in-time restore, so run
`npm run db:export` on a schedule if the cloud copy matters.

### 3. Start infrastructure (Docker required for local Postgres/Neo4j)

```bash
npm run infra:up      # supabase start + the Neo4j container
```

`npm run infra:down` stops both. `npm run infra:status` shows what's running. On
`env:cloud` with an Aura URI, you don't need `infra:up` at all.

### 4. Push the schema (Postgres side only — Neo4j has none to push)

```bash
npm run db:push
```

Safe to re-run; only applies what's changed. `npm run db:studio` opens Drizzle Studio.

### 5. Seed (optional)

```bash
npm run db:seed       # idempotent — a few entities and an edge (Neo4j only)
```

Enough to make every page render without empty states. Safe on a populated database
(MERGE on fixed IDs).

### 6. Run it

```bash
npm run dev
```

- App: [http://localhost:3001](http://localhost:3001) (not 3000 — kept free for other local projects)
- Local Supabase Studio: [http://localhost:54323](http://localhost:54323) (only in `env:docker` mode)
- Neo4j Browser: [http://localhost:7474](http://localhost:7474) (local Docker only)

### 7. Sign in

Every page except `/login` requires a session (`src/proxy.ts` — Next 16 renamed
`middleware.ts` to `proxy.ts`; the ingest API is exempt, it has its own bearer-token
auth). It's invite-only — there's no sign-up page. To create your own account, invite
yourself from the Supabase Dashboard → Auth → Users → Invite, using whichever project
`.env.local` currently points at (`npm run env:status`). Signing in sends a magic link
to that email.

## Adding data

Three ways in, all validated against the same Zod schemas:

- **By hand**: `/data` in the app — forms for entities, relationships, claims, sources,
  bills, contributions.
- **Programmatically**: `POST /api/ingest/batch` with `Authorization: Bearer <INGEST_API_KEY>`.
  Accepts any combination of `entities`/`sources`/`edges`/`claims` arrays in one request.
  Give an item a `clientId` and reference it from a later item in the same batch as
  `"$ref:<clientId>"` to link records that don't exist yet (e.g. a claim referencing the
  entity created earlier in the same call). See `src/lib/ingest/batch.ts`.
- **FEC donor import**: `npm run import:fec-donors` pulls organizational (PAC/committee)
  contributions for a pilot set of politicians from the free OpenFEC API into
  `contributions`, creating committee entities in Neo4j as it goes. Recipients must
  already exist as `politician` entities. Set `FEC_API_KEY` in `.env.local` for a real
  rate limit (the shared `DEMO_KEY` allows only 40 requests/hour); a personal key is
  free and instant at <https://api.data.gov/signup/>.

## Backups and recovery

Two incidents drove this: the cloud Postgres lost `claims` / `sources` to a bad
script, and — separately — `.env.local` got repointed at an empty Neo4j Aura instance
while the real graph sat untouched in the local Docker Neo4j. Neither store had a
backup. Now:

- **`npm run db:export`** — point-in-time dump of both stores to `backups/<timestamp>/`
  (one JSON file per Postgres table + `entities.json` / `edges.json` from Neo4j +
  `manifest.json`). Run it before any destructive change and on a schedule. `backups/`
  is gitignored except the two committed recovery snapshots; copy anything else you
  want to keep somewhere durable.
- **`npm run db:migrate-neo4j`** — copies every entity and edge from one Neo4j to
  another, preserving ids. Source = `SOURCE_NEO4J_URI` / `SOURCE_NEO4J_USER` /
  `SOURCE_NEO4J_PASSWORD`; target = the normal `NEO4J_*`. `--dry-run` reports counts
  and still writes a source snapshot to `backups/`; `--wipe-target` replaces the
  target's contents. This is how the Docker graph was pushed to Aura.
- **`npm run db:restore-postgres -- <dir>`** — replays `sources` / `claims` /
  `contributions` from a dump directory, idempotently (`ON CONFLICT DO NOTHING`).
- **`npm run reconstruct:fec-graph`** — adds the `donated to` edges the `/money` graph
  draws (the FEC importer only ever wrote the `contributions` table, never Neo4j
  edges), and backfills any missing donor/recipient entities by re-deriving names from
  OpenFEC via each row's stored `sub_id`. Existing entities are left untouched.
  `--dry-run` reports the match rate; FEC responses are cached under `backups/`.
- **`npm run db:seed`** — the floor: a known-good minimal Neo4j fixture for a
  from-empty graph (see step 5).

## Project layout

- `src/app/(shell)/` — the tool pages (`people`, `legislation`, `money`, `elections`)
  + `data/` admin CRUD + workspace home, sharing the header nav.
- `src/app/geography/` — the map/annotation studio, deliberately outside the shell
  (full-bleed, its own chrome).
- `src/app/api/ingest/` — the batch ingestion endpoint.
- `src/lib/neo4j/`, `src/lib/db/` — data access for entities/edges (graph) and
  claims/sources/bills/votes/contributions (relational), respectively.
- `src/lib/validation/` — the Zod schemas everything else (forms, server actions, ingest)
  validates against. Start here when adding a field.
- `src/lib/actions/` — `"use server"` CRUD used by the `/data` forms.
- `src/components/{graph,money,legislation,entities,home}/` — the real view for each
  tool page, each following the same shape: a server component that fetches + handles
  the empty state, delegating to a client component for search/interaction.
- `src/components/{map,annotate,layout}/` — the `/geography` map studio.
- `scripts/` — one-off and operational scripts (schema, seed, export/restore, imports).

## Infra

- `infra/docker/docker-compose.yml` — the local Neo4j container.
- `supabase/config.toml` — local Supabase CLI config.
- `drizzle.config.ts` — reads `DATABASE_URL` from `.env.local`; throws if it's missing
  rather than silently defaulting anywhere.
