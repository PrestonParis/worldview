-- Neon (overflow) schema: only area_stats, same shape and indexes as the
-- Supabase table (2026-10-01-data-imports.sql, 2026-10-05-data-hosting.sql).
-- Applied by scripts/migrate.mjs when NEON_DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS "area_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"metric" text NOT NULL,
	"geo_level" text NOT NULL,
	"geoid" text NOT NULL,
	"geo_name" text,
	"period" text NOT NULL,
	"period_start" date,
	"value" double precision,
	"unit" text,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "area_stats_key_idx" ON "area_stats" USING btree ("source","metric","geo_level","geoid","period");
CREATE INDEX IF NOT EXISTS "area_stats_lookup_idx" ON "area_stats" USING btree ("metric","geo_level","period");
CREATE INDEX IF NOT EXISTS "area_stats_geoid_idx" ON "area_stats" USING btree ("geoid");
CREATE INDEX IF NOT EXISTS "area_stats_source_idx" ON "area_stats" USING btree ("source","metric");
