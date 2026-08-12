# Worldview

A political research and visualization platform. Entities and relationships live in
Neo4j; claims and sources live in Postgres (Supabase). Ten tool pages read from that
shared graph, plus a standalone map/annotation studio at `/geopolitics`.

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
active. Neo4j is always local Docker for now — there's no cloud graph store yet.

### 3. Start infrastructure (Docker required)

```bash
npm run infra:up      # supabase start + the Neo4j container
```

`npm run infra:down` stops both. `npm run infra:status` shows what's running.

If you're on `env:cloud`, `infra:up` still starts local Neo4j — only Postgres/Auth
actually points at the cloud project in that mode.

### 4. Push the schema (Postgres side only — Neo4j has none to push)

```bash
npm run db:push
```

Safe to re-run; only applies what's changed. `npm run db:studio` opens Drizzle Studio.

### 5. Run it

```bash
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Local Supabase Studio: [http://localhost:54323](http://localhost:54323) (only in `env:docker` mode)
- Neo4j Browser: [http://localhost:7474](http://localhost:7474) (`neo4j` / `worldview-dev`)

### 6. Sign in

Every page except `/login` requires a session (`src/proxy.ts` — Next 16 renamed
`middleware.ts` to `proxy.ts`; the ingest API is exempt, it has its own bearer-token
auth). It's invite-only — there's no sign-up page. To create your own account, invite
yourself from the Supabase Dashboard → Auth → Users → Invite, using whichever project
`.env.local` currently points at (`npm run env:status`). Signing in sends a magic link
to that email.

## Adding data

Two ways in, both validated against the same Zod schemas:

- **By hand**: `/data` in the app — forms for entities, relationships, claims, sources.
- **Programmatically**: `POST /api/ingest/batch` with `Authorization: Bearer <INGEST_API_KEY>`.
  Accepts any combination of `entities`/`sources`/`edges`/`claims` arrays in one request.
  Give an item a `clientId` and reference it from a later item in the same batch as
  `"$ref:<clientId>"` to link records that don't exist yet (e.g. a claim referencing the
  entity created earlier in the same call). See `src/lib/ingest/batch.ts`.

## Project layout

- `src/app/(shell)/` — the ten tool pages + workspace home, sharing the header nav.
- `src/app/geopolitics/` — the map/annotation studio, deliberately outside the shell
  (full-bleed, its own chrome).
- `src/app/api/ingest/` — the batch ingestion endpoint.
- `src/lib/neo4j/`, `src/lib/db/` — data access for entities/edges (graph) and
  claims/sources (relational), respectively.
- `src/lib/validation/` — the Zod schemas everything else (forms, server actions, ingest)
  validates against. Start here when adding a field.
- `src/lib/actions/` — `"use server"` CRUD used by the `/data` forms.
- `src/components/{graph,claims,news,sources,entities,alignment}/` — the real view for
  each tool page, each following the same shape: a server component that fetches +
  handles the empty state, delegating to a client component for search/interaction.

## Infra

- `infra/docker/docker-compose.yml` — the local Neo4j container.
- `supabase/config.toml` — local Supabase CLI config.
- `drizzle.config.ts` — reads `DATABASE_URL` from `.env.local`; throws if it's missing
  rather than silently defaulting anywhere.
