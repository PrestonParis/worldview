-- People & Power graph moves into Postgres.
-- Postgres is now the record for entities and their relationships; Neo4j is
-- a read-only projection rebuilt from these tables by scripts/sync-graph.mjs.
-- Rows are copied out of the existing graph once by
-- scripts/graph-to-postgres.mjs. Mirrors src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS "entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "biography" text NOT NULL DEFAULT '',
  "image_url" text NOT NULL DEFAULT '',
  "website_url" text NOT NULL DEFAULT '',
  "x_url" text NOT NULL DEFAULT '',
  "facebook_url" text NOT NULL DEFAULT '',
  "instagram_url" text NOT NULL DEFAULT '',
  "youtube_url" text NOT NULL DEFAULT '',
  "linkedin_url" text NOT NULL DEFAULT '',
  "highlights" text NOT NULL DEFAULT '',
  "metadata" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "entities_type_check" CHECK ("type" IN ('politician', 'pundit', 'journalist', 'organization', 'company', 'lobbyist', 'donor'))
);
CREATE INDEX IF NOT EXISTS "entities_type_idx" ON "entities" ("type");
CREATE INDEX IF NOT EXISTS "entities_name_lower_idx" ON "entities" (lower("name"));

-- The ID crosswalk: every external id an entity is known by (Bioguide,
-- Open States, ICPSR, FEC candidate, Wikidata, Congress committee, ...).
-- One entity per (scheme, value), so importers resolve people and groups by
-- id rather than by name.
CREATE TABLE IF NOT EXISTS "entity_identifiers" (
  "entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "scheme" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("scheme", "value")
);
CREATE INDEX IF NOT EXISTS "entity_identifiers_entity_idx" ON "entity_identifiers" ("entity_id", "scheme");

-- The office an entity currently holds according to one source (Open States
-- for state legislators and statewide executives).
CREATE TABLE IF NOT EXISTS "entity_offices" (
  "entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "level" text NOT NULL,
  "state" text,
  "chamber" text,
  "district" text,
  "office" text,
  "party" text,
  "email" text,
  "phone" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id", "source")
);
CREATE INDEX IF NOT EXISTS "entity_offices_state_idx" ON "entity_offices" ("level", "state");

CREATE TABLE IF NOT EXISTS "entity_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "target_entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "rel_type" text NOT NULL DEFAULT '',
  "role" text NOT NULL DEFAULT '',
  "valid_from" text NOT NULL DEFAULT '',
  "valid_to" text NOT NULL DEFAULT '',
  "notes" text NOT NULL DEFAULT '',
  "source_record_id" uuid REFERENCES "sources" ("id") ON DELETE SET NULL,
  -- Importer idempotency key ("committee-seat:HSAG:P000197"); hand-made
  -- edges have none.
  "source_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "entity_edges_not_self" CHECK ("source_entity_id" <> "target_entity_id")
);
CREATE INDEX IF NOT EXISTS "entity_edges_source_idx" ON "entity_edges" ("source_entity_id");
CREATE INDEX IF NOT EXISTS "entity_edges_target_idx" ON "entity_edges" ("target_entity_id");
CREATE INDEX IF NOT EXISTS "entity_edges_rel_type_idx" ON "entity_edges" ("rel_type");
CREATE UNIQUE INDEX IF NOT EXISTS "entity_edges_source_key_idx" ON "entity_edges" ("source_key") WHERE "source_key" IS NOT NULL;

-- Closed to the Supabase Data API like every other table
-- (2026-10-15-rls-lockdown.sql).
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_identifiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_edges" ENABLE ROW LEVEL SECURITY;
