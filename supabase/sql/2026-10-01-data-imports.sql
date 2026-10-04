-- Bulk public-data import tables (member_ideology, area_stats,
-- executive_documents, independent_expenditures, court_cases, case_votes).
-- Idempotent and additive: apply with `node scripts/apply-sql.mjs supabase/sql/2026-10-01-data-imports.sql`.
-- Generated from src/lib/db/schema.ts via `drizzle-kit export`.

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

CREATE TABLE IF NOT EXISTS "case_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"justice" text NOT NULL,
	"justice_entity_id" uuid,
	"in_majority" boolean,
	"direction" text,
	"vote" text,
	"opinion" text
);

CREATE TABLE IF NOT EXISTS "court_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scdb_case_id" text NOT NULL,
	"court" text DEFAULT 'SCOTUS' NOT NULL,
	"case_name" text,
	"docket" text,
	"us_cite" text,
	"term" integer,
	"decision_date" date,
	"chief" text,
	"issue_area" text,
	"decision_direction" text,
	"majority_votes" integer,
	"minority_votes" integer,
	"majority_opinion_writer" text,
	"declared_unconstitutional" boolean,
	"precedent_altered" boolean,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "executive_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" text NOT NULL,
	"doc_type" text NOT NULL,
	"subtype" text,
	"eo_number" integer,
	"title" text NOT NULL,
	"abstract" text,
	"president" text,
	"signing_date" date,
	"publication_date" date,
	"citation" text,
	"significant" boolean,
	"agencies" jsonb,
	"html_url" text,
	"pdf_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "independent_expenditures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"cycle" integer NOT NULL,
	"committee_id" text,
	"committee_name" text,
	"spender_entity_id" uuid,
	"candidate_id" text,
	"candidate_name" text,
	"candidate_entity_id" uuid,
	"candidate_office" text,
	"candidate_state" text,
	"candidate_district" text,
	"candidate_party" text,
	"support_oppose" text,
	"amount" double precision NOT NULL,
	"expenditure_date" date,
	"purpose" text,
	"payee_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "member_ideology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"congress" integer NOT NULL,
	"chamber" text NOT NULL,
	"icpsr" integer NOT NULL,
	"bioguide_id" text,
	"entity_id" uuid,
	"bioname" text,
	"party_code" integer,
	"state_abbrev" text,
	"district_code" integer,
	"nominate_dim1" double precision,
	"nominate_dim2" double precision,
	"nokken_poole_dim1" double precision,
	"nokken_poole_dim2" double precision,
	"number_of_votes" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "case_votes" ADD CONSTRAINT "case_votes_case_id_court_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."court_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "area_stats_key_idx" ON "area_stats" USING btree ("source","metric","geo_level","geoid","period");

CREATE INDEX IF NOT EXISTS "area_stats_lookup_idx" ON "area_stats" USING btree ("metric","geo_level","period");

CREATE INDEX IF NOT EXISTS "area_stats_geoid_idx" ON "area_stats" USING btree ("geoid");

CREATE UNIQUE INDEX IF NOT EXISTS "case_votes_key_idx" ON "case_votes" USING btree ("case_id","justice");

CREATE INDEX IF NOT EXISTS "case_votes_justice_idx" ON "case_votes" USING btree ("justice");

CREATE UNIQUE INDEX IF NOT EXISTS "court_cases_scdb_idx" ON "court_cases" USING btree ("scdb_case_id");

CREATE INDEX IF NOT EXISTS "court_cases_term_idx" ON "court_cases" USING btree ("term");

CREATE UNIQUE INDEX IF NOT EXISTS "executive_documents_number_idx" ON "executive_documents" USING btree ("document_number");

CREATE INDEX IF NOT EXISTS "executive_documents_subtype_idx" ON "executive_documents" USING btree ("subtype","signing_date");

CREATE UNIQUE INDEX IF NOT EXISTS "independent_expenditures_external_idx" ON "independent_expenditures" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "independent_expenditures_candidate_idx" ON "independent_expenditures" USING btree ("candidate_entity_id");

CREATE INDEX IF NOT EXISTS "independent_expenditures_committee_idx" ON "independent_expenditures" USING btree ("committee_id");

CREATE UNIQUE INDEX IF NOT EXISTS "member_ideology_key_idx" ON "member_ideology" USING btree ("congress","chamber","icpsr");

CREATE INDEX IF NOT EXISTS "member_ideology_entity_idx" ON "member_ideology" USING btree ("entity_id");

CREATE INDEX IF NOT EXISTS "member_ideology_bioguide_idx" ON "member_ideology" USING btree ("bioguide_id");
