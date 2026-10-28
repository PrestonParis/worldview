-- Automatic coverage for the close-races tracker (docs/elections/ga-close-races.md,
-- "Coverage"): the first copy of each county feed's contests, which later
-- feeds are measured against. Replaces the hand-checked expected counts.
CREATE TABLE IF NOT EXISTS "tracked_contest_baseline" (
  "source_election_id" text NOT NULL,
  -- county slug (fulton-county-ga)
  "jurisdiction_id" text NOT NULL,
  -- normalized contest name
  "contest_key" text NOT NULL,
  "name" text NOT NULL,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_election_id", "jurisdiction_id", "contest_key")
);
ALTER TABLE "tracked_contest_baseline" ENABLE ROW LEVEL SECURITY;

-- The id an election was first watched under, when SOS published it under
-- another one; the report redirects the old id's URL here.
ALTER TABLE "tracked_ingest_status" ADD COLUMN IF NOT EXISTS "replaces" text;
