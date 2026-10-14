-- Which database holds each dataset's area_stats rows: 'supabase' (this
-- database) or 'neon' (overflow, NEON_DATABASE_URL). Supabase is kept just
-- under its plan's size cap and the rest lives in Neon; datasets move
-- between the two with scripts/db-rebalance.mjs.
ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "storage" text DEFAULT 'supabase' NOT NULL;
