-- Writ close-races tracker (docs/elections/ga-close-races.md, "Data model"). Every Georgia
-- contest from the SOS results feed — federal down to school board — with
-- its options, county splits, margin history, coverage and the ingest
-- worker's heartbeat. Independent of entities: local candidates aren't
-- politician entities. Filled by scripts/sync-ga-results.mjs. Mirrors
-- src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS "tracked_contests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text NOT NULL,
  -- ga-sos:{electionId}:{contestId} | ga-sos:{electionId}:{county}:{contestId} | ga-sos:{electionId}:local:{hash}
  "external_id" text NOT NULL,
  "source_election_id" text NOT NULL,
  "source_contest_ids" text[] NOT NULL DEFAULT '{}',
  "election_date" date NOT NULL,
  -- general | primary | runoff | special | recount
  "election_kind" text NOT NULL,
  "state" text NOT NULL,
  "name" text NOT NULL,
  "raw_name" text NOT NULL,
  "office" text NOT NULL,
  "district" text,
  -- federal | statewide | legislative | judicial | county | municipal | school | referendum
  "level" text NOT NULL,
  -- state | county | multi_county
  "scope" text NOT NULL,
  "county_slug" text,
  "county" text,
  "counties" text[] NOT NULL DEFAULT '{}',
  "municipality" text,
  "vote_for" integer NOT NULL DEFAULT 1,
  "is_referendum" boolean NOT NULL DEFAULT false,
  "primary_party" text,
  "total_votes" integer NOT NULL DEFAULT 0,
  "reporting_units" integer NOT NULL DEFAULT 0,
  "total_units" integer NOT NULL DEFAULT 0,
  -- majority | plurality | top_n | referendum | unknown
  "decision_rule" text NOT NULL,
  "rule_source" text,
  "threshold" double precision,
  -- no_results | reporting | unofficial_complete | county_certified | state_certified | recount_pending | contested
  "result_status" text NOT NULL,
  "ranked" boolean NOT NULL DEFAULT false,
  "uncontested" boolean NOT NULL DEFAULT false,
  "margin_votes" integer,
  "margin_pct" double precision,
  "leader_share" double precision,
  "flags" text[] NOT NULL DEFAULT '{}',
  "source_updated_at" timestamptz,
  "as_of" timestamptz,
  "ingested_at" timestamptz NOT NULL DEFAULT now(),
  "source_hash" text,
  -- Set when the contest left the source feed (kept, not deleted).
  "removed_at" timestamptz,
  "election_id" uuid REFERENCES "elections"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_contests_external_id_idx" ON "tracked_contests" ("external_id");
CREATE INDEX IF NOT EXISTS "tracked_contests_election_rank_idx" ON "tracked_contests" ("source_election_id", "ranked", "margin_votes");
CREATE INDEX IF NOT EXISTS "tracked_contests_election_id_idx" ON "tracked_contests" ("election_id");

CREATE TABLE IF NOT EXISTS "tracked_contest_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contest_id" uuid NOT NULL REFERENCES "tracked_contests"("id") ON DELETE CASCADE,
  -- Normalized name: the merge key across counties and across polls.
  "name_key" text NOT NULL,
  "source_option_ids" text[] NOT NULL DEFAULT '{}',
  "name" text NOT NULL,
  "party" text,
  "incumbent" boolean NOT NULL DEFAULT false,
  "is_write_in" boolean NOT NULL DEFAULT false,
  "votes" integer NOT NULL DEFAULT 0,
  "votes_by_method" jsonb NOT NULL DEFAULT '{}',
  "rank" integer NOT NULL,
  "is_current_leader" boolean NOT NULL DEFAULT false,
  "is_apparent_winner" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_contest_options_contest_name_idx" ON "tracked_contest_options" ("contest_id", "name_key");

CREATE TABLE IF NOT EXISTS "tracked_contest_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contest_id" uuid NOT NULL REFERENCES "tracked_contests"("id") ON DELETE CASCADE,
  "option_id" uuid NOT NULL REFERENCES "tracked_contest_options"("id") ON DELETE CASCADE,
  "county_slug" text NOT NULL,
  "county" text NOT NULL,
  "votes" integer NOT NULL DEFAULT 0,
  "reporting_units" integer NOT NULL DEFAULT 0,
  "total_units" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_contest_areas_option_county_idx" ON "tracked_contest_areas" ("option_id", "county_slug");
CREATE INDEX IF NOT EXISTS "tracked_contest_areas_contest_idx" ON "tracked_contest_areas" ("contest_id");

-- One row each time a contest's numbers change; powers "margin at 11 pm vs now".
CREATE TABLE IF NOT EXISTS "tracked_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contest_id" uuid NOT NULL REFERENCES "tracked_contests"("id") ON DELETE CASCADE,
  "as_of" timestamptz,
  "ingested_at" timestamptz NOT NULL DEFAULT now(),
  "leader_option_id" uuid,
  "runner_up_option_id" uuid,
  "leader_votes" integer,
  "runner_up_votes" integer,
  "total_votes" integer NOT NULL,
  "margin_votes" integer,
  "margin_pct" double precision,
  "reporting_units" integer NOT NULL,
  "total_units" integer NOT NULL,
  "result_status" text NOT NULL,
  "source_hash" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "tracked_snapshots_contest_idx" ON "tracked_snapshots" ("contest_id", "ingested_at" DESC);

-- Expected vs observed contests per jurisdiction: the report's completeness claim.
CREATE TABLE IF NOT EXISTS "tracked_contest_coverage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_election_id" text NOT NULL,
  "jurisdiction_id" text NOT NULL,
  "jurisdiction_name" text NOT NULL,
  -- county | municipality
  "jurisdiction_type" text NOT NULL,
  "expected_count" integer,
  "observed_count" integer NOT NULL DEFAULT 0,
  -- complete | partial | missing | unverified
  "status" text NOT NULL,
  "source_url" text,
  "local_results_url" text,
  "verified_at" timestamptz,
  "notes" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_contest_coverage_jurisdiction_idx" ON "tracked_contest_coverage" ("source_election_id", "jurisdiction_id");

-- The ingest worker's heartbeat, one row per source election.
CREATE TABLE IF NOT EXISTS "tracked_ingest_status" (
  "source_election_id" text PRIMARY KEY,
  "source" text NOT NULL,
  "election_name" text NOT NULL,
  "election_date" date NOT NULL,
  "election_kind" text NOT NULL,
  "mode" text NOT NULL,
  "worker_id" text,
  "heartbeat_at" timestamptz,
  "last_state_fetch_at" timestamptz,
  "last_county_sweep_at" timestamptz,
  "last_write_at" timestamptz,
  "source_updated_at" timestamptz,
  "is_official" boolean NOT NULL DEFAULT false,
  "fetch_source" text,
  "error_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "contests" integer NOT NULL DEFAULT 0,
  "counties_fetched" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tracked_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_election_id" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "kind" text NOT NULL,
  -- info | warning | critical
  "severity" text NOT NULL,
  "contest_id" uuid REFERENCES "tracked_contests"("id") ON DELETE CASCADE,
  "message" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "sent_at" timestamptz,
  "resolved_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_alerts_dedupe_idx" ON "tracked_alerts" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "tracked_alerts_election_idx" ON "tracked_alerts" ("source_election_id", "created_at" DESC);

-- Read and written only by the server (Drizzle) and the ingester, like every
-- other table: no PostgREST access.
ALTER TABLE "tracked_contests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_contest_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_contest_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_contest_coverage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_ingest_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_alerts" ENABLE ROW LEVEL SECURITY;
