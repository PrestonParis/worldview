-- Room for the data still to come.
--
-- 1. A data lake in Supabase Storage, which doesn't count against the
--    database's size cap: `raw` keeps every source file an importer
--    downloads (private), `lake` holds Parquet extracts anyone can download
--    (public). source_snapshots and lake_files catalog them
--    (scripts/lib/lake.mjs). Detail too large for Postgres (individual
--    donations, precinct returns) lives in the lake; Postgres keeps the
--    aggregates pages read.
-- 2. State legislatures in the legislation tables: `jurisdiction` is "us"
--    for Congress or a state's postal code, and roll calls no longer need
--    a Congress number.
-- 3. Polls.
-- Mirrors src/lib/db/schema.ts.

-- Creating the buckets needs write access to Supabase's storage schema; a
-- role without it leaves them to be created in the dashboard rather than
-- failing the deploy.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('raw', 'raw', false), ('lake', 'lake', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'storage buckets not created (no privilege): create raw (private) and lake (public) in the dashboard';
END $$;

CREATE TABLE IF NOT EXISTS "source_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text NOT NULL,
  "url" text NOT NULL,
  "sha256" text NOT NULL,
  "bytes" bigint NOT NULL,
  "content_type" text,
  -- Object path in the `raw` bucket.
  "storage_path" text NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "source_snapshots_content_idx" ON "source_snapshots" ("source", "url", "sha256");
CREATE INDEX IF NOT EXISTS "source_snapshots_source_idx" ON "source_snapshots" ("source", "fetched_at");

CREATE TABLE IF NOT EXISTS "lake_files" (
  -- Object path in the `lake` bucket, e.g. "area-stats/cbp.parquet".
  "path" text PRIMARY KEY,
  "source" text NOT NULL,
  "format" text NOT NULL DEFAULT 'parquet',
  "rows" bigint NOT NULL,
  "bytes" bigint NOT NULL,
  -- [{ name, type }]
  "columns" jsonb NOT NULL DEFAULT '[]',
  "sha256" text NOT NULL,
  "built_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lake_files_source_idx" ON "lake_files" ("source");

ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "jurisdiction" text NOT NULL DEFAULT 'us';
CREATE INDEX IF NOT EXISTS "bills_jurisdiction_idx" ON "bills" ("jurisdiction");
ALTER TABLE "roll_calls" ADD COLUMN IF NOT EXISTS "jurisdiction" text NOT NULL DEFAULT 'us';
ALTER TABLE "roll_calls" ALTER COLUMN "congress" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "roll_calls_jurisdiction_idx" ON "roll_calls" ("jurisdiction");

CREATE TABLE IF NOT EXISTS "polls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source-native id, for idempotent imports.
  "external_id" text,
  "pollster" text NOT NULL,
  "sponsor" text,
  -- The race polled, when it's one we track; null for issue polls.
  "election_id" uuid REFERENCES "elections" ("id") ON DELETE SET NULL,
  "question" text NOT NULL DEFAULT '',
  -- Where the sample was drawn (area_stats levels: nation, state, cd, ...).
  "geo_level" text NOT NULL DEFAULT 'nation',
  "geoid" text NOT NULL DEFAULT 'US',
  -- "lv" likely voters | "rv" registered voters | "a" adults | "v" voters
  "population" text,
  "sample_size" integer,
  "method" text,
  "start_date" date,
  "end_date" date NOT NULL,
  "source_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "polls_external_id_idx" ON "polls" ("external_id");
CREATE INDEX IF NOT EXISTS "polls_election_idx" ON "polls" ("election_id", "end_date");
CREATE INDEX IF NOT EXISTS "polls_geo_idx" ON "polls" ("geo_level", "geoid", "end_date");

CREATE TABLE IF NOT EXISTS "poll_results" (
  "poll_id" uuid NOT NULL REFERENCES "polls" ("id") ON DELETE CASCADE,
  -- Candidate name or answer ("Approve", "Undecided").
  "choice" text NOT NULL,
  "entity_id" uuid REFERENCES "entities" ("id") ON DELETE SET NULL,
  "party" text,
  "pct" double precision NOT NULL,
  PRIMARY KEY ("poll_id", "choice")
);
CREATE INDEX IF NOT EXISTS "poll_results_entity_idx" ON "poll_results" ("entity_id");

ALTER TABLE "source_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lake_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poll_results" ENABLE ROW LEVEL SECURITY;
