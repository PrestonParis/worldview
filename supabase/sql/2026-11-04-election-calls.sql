-- Race calls for an election still being counted. scripts/sync-race-results.mjs
-- fills these; every column is null for past cycles, which have no call to
-- track.
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "call_status" text;
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "reporting_pct" real;
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "flipped" boolean;
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "results_as_of" timestamptz;
