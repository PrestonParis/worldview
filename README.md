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

### 2. Choose a Postgres/Auth target

Two options, switch anytime:

```bash
npm run env:docker   # local Postgres via Supabase CLI + Docker (no cloud account needed)
npm run env:cloud     # the shared cloud Supabase project
```

This copies the right template into `.env.local`. `npm run env:status` shows which one's
active.

### 3. Point at a Neo4j

`.env.local` carries `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD`. Either works:

- **Local Docker** — `npm run infra:up` starts the container from
  `infra/docker/docker-compose.yml` (`bolt://127.0.0.1:7687`, `neo4j` / `worldview-dev`).
- **Neo4j Aura** — a cloud instance (`neo4j+s://…`). Aura Free instances **pause after
  3 days idle and are deleted after 30 days idle**, and have no point-in-time restore —
  run `npm run db:export` on a schedule if you rely on one (see [Backups](#backups-and-recovery)).

### 4. Start infrastructure (Docker required for local Postgres/Neo4j)

```bash
npm run infra:up      # supabase start + the Neo4j container
```

`npm run infra:down` stops both. `npm run infra:status` shows what's running. On
`env:cloud` with an Aura URI, you don't need `infra:up` at all.

### 5. Push the schema (Postgres side only — Neo4j has none to push)

```bash
npm run db:push
```

Safe to re-run; only applies what's changed. `npm run db:studio` opens Drizzle Studio.

### 6. Seed (optional)

```bash
npm run db:seed       # idempotent — a few entities, an edge, one sourced claim
```

Enough to make every page render without empty states. Safe on a populated database
(MERGE / ON CONFLICT on fixed IDs; the Postgres fixture is skipped unless `claims` is
empty).

### 7. Run it

```bash
npm run dev
```

- App: [http://localhost:3001](http://localhost:3001) (not 3000 — kept free for other local projects)
- Local Supabase Studio: [http://localhost:54323](http://localhost:54323) (only in `env:docker` mode)
- Neo4j Browser: [http://localhost:7474](http://localhost:7474) (local Docker only)

### 8. Sign in

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

There was no graph backup the first time the stores were wiped. Now:

- **`npm run db:export`** — point-in-time dump of both stores to `backups/<timestamp>/`
  (one JSON file per Postgres table + `entities.json` / `edges.json` from Neo4j +
  `manifest.json` with row counts). Run it before any destructive change and on a
  schedule. `backups/` is gitignored except the one recovered pre-wipe snapshot; copy
  dumps you want to keep somewhere durable.
- **`npm run db:restore-postgres -- <dir>`** — replays `sources` / `claims` /
  `contributions` from a dump directory, idempotently (`ON CONFLICT DO NOTHING`).
- **`npm run reconstruct:fec-graph`** — rebuilds the Neo4j entities/edges behind the
  FEC `contributions` rows after a graph loss: re-derives donor and recipient names
  from OpenFEC by matching each row's stored `sub_id`, then recreates those entities
  with their **original UUIDs** so the contribution rows re-link with no Postgres
  change. `--dry-run` reports the match rate first; responses are cached under
  `backups/` so a rate-limit stall is resumable.
- **`npm run db:seed`** — the floor: a known-good minimal fixture for a from-empty
  database (see step 6).

There is no generic Neo4j restore from a dump yet — `reconstruct:fec-graph` and
`db:seed` are the current paths back.

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
