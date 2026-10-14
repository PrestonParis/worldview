-- Slims area_stats: the uuid id (never queried) and three indexes that the
-- natural key already covers (every query filters by source) are dropped,
-- and the unique key becomes the primary key. Autovacuum runs sooner, since
-- weekly re-imports touch hundreds of thousands of rows. The space comes
-- back once the table is rewritten: npm run db:rebalance -- --compact.
-- Same file in supabase/sql/neon/ for the Neon overflow database.
DROP INDEX IF EXISTS "area_stats_geoid_idx";
DROP INDEX IF EXISTS "area_stats_lookup_idx";
DROP INDEX IF EXISTS "area_stats_source_idx";
ALTER TABLE "area_stats" DROP CONSTRAINT IF EXISTS "area_stats_pkey";
ALTER TABLE "area_stats" DROP COLUMN IF EXISTS "id";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.area_stats'::regclass AND contype = 'p') THEN
    ALTER TABLE "area_stats" ADD CONSTRAINT "area_stats_pkey" PRIMARY KEY USING INDEX "area_stats_key_idx";
  END IF;
END $$;
ALTER TABLE "area_stats" SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
