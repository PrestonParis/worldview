-- Baseline: the tables that predate the migration runner. They were created
-- with drizzle-kit push before supabase/sql/ existed, so a fresh database
-- (local setup, CI) had no way to build them. Every statement is guarded,
-- so on databases that already have these tables this file does nothing.
-- Shapes are as of this file's addition; later migrations stay idempotent
-- against them.

-- entities as first created by 2026-10-16-entities.sql, which sorts after
-- 2026-10-16-data-lake.sql that references it.
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


DO $$ BEGIN
  CREATE TYPE "public"."bill_status" AS ENUM('introduced', 'in_committee', 'passed_chamber', 'passed_both_chambers', 'enacted', 'vetoed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contribution_type" AS ENUM('individual', 'pac', 'super_pac', 'party', 'committee', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."election_level" AS ENUM('federal', 'state', 'local');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."election_status" AS ENUM('scheduled', 'provisional', 'certified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."election_type" AS ENUM('general', 'primary', 'runoff', 'special');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."race_rating" AS ENUM('safe_d', 'likely_d', 'lean_d', 'tossup', 'lean_r', 'likely_r', 'safe_r', 'safe_i');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."result_area_kind" AS ENUM('county', 'precinct', 'district', 'state');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."source_type" AS ENUM('primary', 'secondary', 'transcript', 'article', 'filing', 'video', 'official_statement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."vote_position" AS ENUM('yea', 'nay', 'present', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bill_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"chamber" text,
	"text" text NOT NULL,
	"action_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bill_committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"chamber" text,
	"activity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bill_cosponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"date" timestamp with time zone,
	"is_original" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bill_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"related_external_id" text,
	"related_bill_id" uuid,
	"related_bill_number" text,
	"related_title" text,
	"relationship_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bill_text_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"version_type" text,
	"date" timestamp with time zone,
	"format" text,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_number" text NOT NULL,
	"jurisdiction" text DEFAULT 'us' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" "bill_status" DEFAULT 'introduced' NOT NULL,
	"chamber" text,
	"introduced_date" timestamp with time zone NOT NULL,
	"sponsor_entity_id" uuid,
	"congress" integer,
	"external_id" text,
	"policy_area" text,
	"subjects" text,
	"latest_action_date" timestamp with time zone,
	"latest_action_text" text,
	"source_id" uuid,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "candidacies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"candidate_entity_id" uuid NOT NULL,
	"party" text,
	"incumbent" boolean DEFAULT false NOT NULL,
	"withdrew" boolean DEFAULT false NOT NULL,
	"votes" integer,
	"won" boolean DEFAULT false NOT NULL,
	"status" text,
	"fec_candidate_id" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "candidate_finance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"cycle" integer NOT NULL,
	"fec_candidate_id" text,
	"party" text,
	"office" text,
	"state" text,
	"district" text,
	"incumbent_challenge" text,
	"total_receipts" bigint,
	"total_disbursements" bigint,
	"cash_on_hand" bigint,
	"debts_owed" bigint,
	"individual_contributions" bigint,
	"pac_contributions" bigint,
	"party_contributions" bigint,
	"coverage_end_date" timestamp with time zone,
	"source_record_id" uuid,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"speaker_entity_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"venue" text,
	"quote" text NOT NULL,
	"topic" text,
	"position_classification" text,
	"confidence" integer,
	"contradicts_claim_id" uuid,
	"source_id" uuid,
	"claim_key" text,
	"issue" text,
	"stance_kind" text DEFAULT 'explicit' NOT NULL,
	"summary" text,
	"date_precision" text DEFAULT 'day' NOT NULL,
	"verbatim" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_entity_id" uuid NOT NULL,
	"recipient_entity_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"source_record_id" uuid,
	"notes" text,
	"contribution_type" "contribution_type",
	"donor_state" text,
	"donor_city" text,
	"donor_zip" text,
	"donor_industry" text,
	"employer" text,
	"occupation" text,
	"external_id" text,
	"receipt_type" text,
	"memo_code" text,
	"cycle" smallint,
	"committee_id" text,
	"recipient_kind" text,
	"recipient_party" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "election_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"candidacy_id" uuid NOT NULL,
	"area_kind" "result_area_kind" DEFAULT 'county' NOT NULL,
	"area_id" text NOT NULL,
	"area_name" text,
	"votes" integer NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"office" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"level" "election_level" DEFAULT 'federal' NOT NULL,
	"election_type" "election_type" DEFAULT 'general' NOT NULL,
	"status" "election_status" DEFAULT 'certified' NOT NULL,
	"election_date" timestamp with time zone NOT NULL,
	"total_votes" integer,
	"prior_election_id" uuid,
	"parent_election_id" uuid,
	"external_id" text,
	"cycle" integer,
	"open_seat" boolean DEFAULT false NOT NULL,
	"seat_class" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lobbying_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"issue_code" text,
	"issue_label" text,
	"bill_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lobbying_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_entity_id" uuid NOT NULL,
	"registrant_entity_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"period" text,
	"amount" integer,
	"amount_kind" text,
	"source_record_id" uuid,
	"notes" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "map_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text DEFAULT 'Untitled graphic' NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"map_view" jsonb NOT NULL,
	"layers" jsonb NOT NULL,
	"live_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "race_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"source" text NOT NULL,
	"rating" "race_rating" NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"url" text,
	"notes" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roll_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid,
	"jurisdiction" text DEFAULT 'us' NOT NULL,
	"congress" integer,
	"chamber" text NOT NULL,
	"session" integer,
	"roll_number" integer NOT NULL,
	"question" text,
	"vote_type" text,
	"result" text,
	"date" timestamp with time zone NOT NULL,
	"external_id" text,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"publisher" text,
	"source_type" "source_type" DEFAULT 'secondary' NOT NULL,
	"published_at" timestamp with time zone,
	"notes" text,
	"source_key" text,
	"author" text,
	"document_id" text,
	"accessed_at" date,
	"repeats_source_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'ok' NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"rows_updated" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cursor" text
);

CREATE TABLE IF NOT EXISTS "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid,
	"roll_call_id" uuid,
	"voter_entity_id" uuid NOT NULL,
	"position" "vote_position" NOT NULL,
	"party" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_bill_or_roll_call" CHECK ("votes"."bill_id" is not null or "votes"."roll_call_id" is not null)
);

DO $$ BEGIN
  ALTER TABLE "bill_actions" ADD CONSTRAINT "bill_actions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bill_committees" ADD CONSTRAINT "bill_committees_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bill_cosponsors" ADD CONSTRAINT "bill_cosponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bill_relations" ADD CONSTRAINT "bill_relations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bill_relations" ADD CONSTRAINT "bill_relations_related_bill_id_bills_id_fk" FOREIGN KEY ("related_bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bill_text_versions" ADD CONSTRAINT "bill_text_versions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bills" ADD CONSTRAINT "bills_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_finance" ADD CONSTRAINT "candidate_finance_source_record_id_sources_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "claims" ADD CONSTRAINT "claims_contradicts_claim_id_claims_id_fk" FOREIGN KEY ("contradicts_claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "claims" ADD CONSTRAINT "claims_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_source_record_id_sources_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "election_results" ADD CONSTRAINT "election_results_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "election_results" ADD CONSTRAINT "election_results_candidacy_id_candidacies_id_fk" FOREIGN KEY ("candidacy_id") REFERENCES "public"."candidacies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "elections" ADD CONSTRAINT "elections_prior_election_id_elections_id_fk" FOREIGN KEY ("prior_election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "elections" ADD CONSTRAINT "elections_parent_election_id_elections_id_fk" FOREIGN KEY ("parent_election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lobbying_issues" ADD CONSTRAINT "lobbying_issues_registration_id_lobbying_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."lobbying_registrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lobbying_issues" ADD CONSTRAINT "lobbying_issues_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lobbying_registrations" ADD CONSTRAINT "lobbying_registrations_source_record_id_sources_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "race_ratings" ADD CONSTRAINT "race_ratings_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "votes" ADD CONSTRAINT "votes_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "bill_actions_bill_id_date_idx" ON "bill_actions" USING btree ("bill_id","date");

CREATE INDEX IF NOT EXISTS "bill_committees_bill_id_idx" ON "bill_committees" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "bill_cosponsors_bill_id_idx" ON "bill_cosponsors" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "bill_cosponsors_entity_id_idx" ON "bill_cosponsors" USING btree ("entity_id");

CREATE UNIQUE INDEX IF NOT EXISTS "bill_cosponsors_bill_entity_unique" ON "bill_cosponsors" USING btree ("bill_id","entity_id");

CREATE INDEX IF NOT EXISTS "bill_relations_bill_id_idx" ON "bill_relations" USING btree ("bill_id");

CREATE UNIQUE INDEX IF NOT EXISTS "bill_relations_bill_related_unique" ON "bill_relations" USING btree ("bill_id","related_external_id");

CREATE INDEX IF NOT EXISTS "bill_text_versions_bill_id_idx" ON "bill_text_versions" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "bills_sponsor_entity_id_idx" ON "bills" USING btree ("sponsor_entity_id");

CREATE INDEX IF NOT EXISTS "bills_congress_idx" ON "bills" USING btree ("congress");

CREATE UNIQUE INDEX IF NOT EXISTS "bills_external_id_idx" ON "bills" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "candidacies_election_id_idx" ON "candidacies" USING btree ("election_id");

CREATE INDEX IF NOT EXISTS "candidacies_candidate_entity_id_idx" ON "candidacies" USING btree ("candidate_entity_id");

CREATE INDEX IF NOT EXISTS "candidacies_fec_candidate_id_idx" ON "candidacies" USING btree ("fec_candidate_id");

CREATE UNIQUE INDEX IF NOT EXISTS "candidacies_election_candidate_unique" ON "candidacies" USING btree ("election_id","candidate_entity_id");

CREATE UNIQUE INDEX IF NOT EXISTS "candidacies_external_id_idx" ON "candidacies" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "candidate_finance_entity_idx" ON "candidate_finance" USING btree ("entity_id");

CREATE INDEX IF NOT EXISTS "candidate_finance_cycle_idx" ON "candidate_finance" USING btree ("cycle");

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_finance_external_id_idx" ON "candidate_finance" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "contributions_donor_entity_id_idx" ON "contributions" USING btree ("donor_entity_id");

CREATE INDEX IF NOT EXISTS "contributions_recipient_entity_id_idx" ON "contributions" USING btree ("recipient_entity_id");

CREATE INDEX IF NOT EXISTS "contributions_donor_state_idx" ON "contributions" USING btree ("donor_state");

CREATE INDEX IF NOT EXISTS "contributions_donor_industry_idx" ON "contributions" USING btree ("donor_industry");

CREATE UNIQUE INDEX IF NOT EXISTS "contributions_external_id_idx" ON "contributions" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "election_results_election_id_idx" ON "election_results" USING btree ("election_id");

CREATE INDEX IF NOT EXISTS "election_results_area_id_idx" ON "election_results" USING btree ("area_id");

CREATE UNIQUE INDEX IF NOT EXISTS "election_results_candidacy_area_unique" ON "election_results" USING btree ("candidacy_id","area_kind","area_id");

CREATE UNIQUE INDEX IF NOT EXISTS "election_results_external_id_idx" ON "election_results" USING btree ("external_id");

CREATE UNIQUE INDEX IF NOT EXISTS "elections_external_id_idx" ON "elections" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "elections_election_date_idx" ON "elections" USING btree ("election_date");

CREATE INDEX IF NOT EXISTS "elections_cycle_idx" ON "elections" USING btree ("cycle");

CREATE INDEX IF NOT EXISTS "lobbying_issues_registration_idx" ON "lobbying_issues" USING btree ("registration_id");

CREATE INDEX IF NOT EXISTS "lobbying_issues_bill_idx" ON "lobbying_issues" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "lobbying_registrations_client_idx" ON "lobbying_registrations" USING btree ("client_entity_id");

CREATE INDEX IF NOT EXISTS "lobbying_registrations_registrant_idx" ON "lobbying_registrations" USING btree ("registrant_entity_id");

CREATE INDEX IF NOT EXISTS "lobbying_registrations_year_idx" ON "lobbying_registrations" USING btree ("year");

CREATE UNIQUE INDEX IF NOT EXISTS "lobbying_registrations_external_id_idx" ON "lobbying_registrations" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "map_projects_owner_id_idx" ON "map_projects" USING btree ("owner_id");

CREATE UNIQUE INDEX IF NOT EXISTS "map_projects_share_token_idx" ON "map_projects" USING btree ("share_token");

CREATE INDEX IF NOT EXISTS "race_ratings_election_id_idx" ON "race_ratings" USING btree ("election_id");

CREATE UNIQUE INDEX IF NOT EXISTS "race_ratings_election_source_asof_unique" ON "race_ratings" USING btree ("election_id","source","as_of");

CREATE UNIQUE INDEX IF NOT EXISTS "race_ratings_external_id_idx" ON "race_ratings" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "roll_calls_bill_id_idx" ON "roll_calls" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "roll_calls_congress_chamber_idx" ON "roll_calls" USING btree ("congress","chamber");

CREATE UNIQUE INDEX IF NOT EXISTS "roll_calls_external_id_idx" ON "roll_calls" USING btree ("external_id");

CREATE INDEX IF NOT EXISTS "sync_runs_source_started_at_idx" ON "sync_runs" USING btree ("source","started_at");

CREATE INDEX IF NOT EXISTS "votes_bill_id_idx" ON "votes" USING btree ("bill_id");

CREATE INDEX IF NOT EXISTS "votes_roll_call_id_idx" ON "votes" USING btree ("roll_call_id");

CREATE INDEX IF NOT EXISTS "votes_voter_entity_id_idx" ON "votes" USING btree ("voter_entity_id");

CREATE UNIQUE INDEX IF NOT EXISTS "votes_bill_voter_unique" ON "votes" USING btree ("bill_id","voter_entity_id") WHERE "votes"."roll_call_id" is null;

CREATE UNIQUE INDEX IF NOT EXISTS "votes_roll_call_voter_unique" ON "votes" USING btree ("roll_call_id","voter_entity_id") WHERE "votes"."roll_call_id" is not null;
