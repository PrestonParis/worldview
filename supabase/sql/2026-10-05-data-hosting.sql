-- Dataset catalog + institutional data partners (docs/data-hosting.md).
-- Idempotent and additive: apply with `node scripts/apply-sql.mjs supabase/sql/2026-10-05-data-hosting.sql`.
-- Mirrors datasets, data_partners, partner_keys in src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS "data_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"website" text,
	"contact_email" text,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "data_partners_slug_idx" ON "data_partners" USING btree ("slug");

CREATE TABLE IF NOT EXISTS "partner_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL REFERENCES "data_partners"("id") ON DELETE CASCADE,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_keys_hash_idx" ON "partner_keys" USING btree ("key_hash");
CREATE INDEX IF NOT EXISTS "partner_keys_partner_idx" ON "partner_keys" USING btree ("partner_id");

CREATE TABLE IF NOT EXISTS "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"publisher" text NOT NULL,
	"partner_id" uuid REFERENCES "data_partners"("id") ON DELETE SET NULL,
	"description" text,
	"methodology" text,
	"source_url" text,
	"license" text,
	"cadence" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "datasets_slug_idx" ON "datasets" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "datasets_topic_idx" ON "datasets" USING btree ("topic");
CREATE INDEX IF NOT EXISTS "datasets_partner_idx" ON "datasets" USING btree ("partner_id");

-- Coverage queries group area_stats by source.
CREATE INDEX IF NOT EXISTS "area_stats_source_idx" ON "area_stats" USING btree ("source","metric");

-- Server-only tables, same as profiles: RLS on with no policies.
ALTER TABLE "data_partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "datasets" ENABLE ROW LEVEL SECURITY;
