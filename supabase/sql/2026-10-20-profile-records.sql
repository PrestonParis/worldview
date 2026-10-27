-- Structured records behind people profiles (docs/people/profile-model.md).
-- A profile's prose lives in entity_profiles; everything a paragraph asserts
-- that can be reused — facts, dated events, relationships, statements,
-- contributions — is its own row, and every row points at the sources that
-- support it through record_evidence. The donor's profile, the recipient's
-- profile, the network and the timeline all read the same rows.
--
-- Filled by scripts/import-profile.mjs from data/profiles/*.json and from
-- FEC Schedule A. Mirrors src/lib/db/schema.ts.

-- Sources gain a stable key (so dossiers can cite them), authorship, access
-- date and a pointer to the outlet a syndicated copy repeats, so two copies
-- of one report never count as independent confirmation.
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "source_key" text;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "author" text;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "document_id" text;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "accessed_at" date;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "repeats_source_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "sources_source_key_idx" ON "sources" ("source_key") WHERE "source_key" IS NOT NULL;

-- FEC Schedule A detail. Memo lines (memo_code 'X') itemize money already
-- counted on another line — joint-fundraising allocations, conduit
-- earmarks — and are excluded from every total.
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "receipt_type" text;
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "memo_code" text;
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "cycle" smallint;
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "committee_id" text;
-- 'candidate' | 'party' | 'pac' | 'super_pac' | 'hybrid_pac' | 'joint_fundraising' | 'other'
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "recipient_kind" text;
-- The recipient committee's or candidate's party as FEC records it ('REP', 'DEM', ...).
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "recipient_party" text;
CREATE INDEX IF NOT EXISTS "contributions_committee_idx" ON "contributions" ("committee_id");

-- Relationships: review status and how prominent the tie is for the subject,
-- so the network defaults to the few that matter.
ALTER TABLE "entity_edges" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'verified';
ALTER TABLE "entity_edges" ADD COLUMN IF NOT EXISTS "prominence" smallint NOT NULL DEFAULT 0;

-- Statements: the existing claims table, keyed for import and grouped by
-- issue. stance_kind separates a first-person position from an editorial
-- reading of one.
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "claim_key" text;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "issue" text;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "stance_kind" text NOT NULL DEFAULT 'explicit';
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "date_precision" text NOT NULL DEFAULT 'day';
-- false: a widely cited quotation whose exact wording couldn't be checked
-- against the original; the profile labels it "Not verbatim".
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "verbatim" boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "claims_claim_key_idx" ON "claims" ("claim_key") WHERE "claim_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "claims_speaker_idx" ON "claims" ("speaker_entity_id");

-- The editorial layer: summary, roles, biography chapters, ideas, coverage
-- notes and the three freshness dates (review, source check, finance sync is
-- read from the contributions themselves).
CREATE TABLE IF NOT EXISTS "entity_profiles" (
  "entity_id" uuid PRIMARY KEY REFERENCES "entities" ("id") ON DELETE CASCADE,
  "summary" text NOT NULL DEFAULT '',
  "roles" jsonb NOT NULL DEFAULT '[]',
  "chapters" jsonb NOT NULL DEFAULT '[]',
  "ideas" jsonb NOT NULL DEFAULT '{}',
  "coverage" jsonb NOT NULL DEFAULT '{}',
  "editorial_reviewed_at" date,
  "sources_verified_at" date,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Reference facts: birth, citizenship, education, net-worth estimates.
CREATE TABLE IF NOT EXISTS "entity_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "fact_key" text NOT NULL,
  "label" text NOT NULL,
  "value" text NOT NULL,
  "detail" text NOT NULL DEFAULT '',
  -- For values that change (net worth): the date the value describes.
  "as_of" date,
  "sort" smallint NOT NULL DEFAULT 0,
  "featured" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "entity_facts_key" UNIQUE ("entity_id", "fact_key")
);

-- Dated events. A partial date is allowed ('1998', '2004-08').
CREATE TABLE IF NOT EXISTS "entity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_key" text NOT NULL UNIQUE,
  "subject_entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "date_start" text NOT NULL,
  "date_end" text NOT NULL DEFAULT '',
  "title" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  -- 'career' | 'finance' | 'politics' | 'ideas' | 'legal' | 'personal'
  "category" text NOT NULL,
  -- 1 minor, 2 notable, 3 defining. The timeline shows 2+ by default.
  "significance" smallint NOT NULL DEFAULT 2,
  "chapter_key" text NOT NULL DEFAULT '',
  -- 'verified' | 'disputed' | 'unresolved'
  "status" text NOT NULL DEFAULT 'verified',
  "status_note" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "entity_events_category_check" CHECK ("category" IN ('career', 'finance', 'politics', 'ideas', 'legal', 'personal')),
  CONSTRAINT "entity_events_status_check" CHECK ("status" IN ('verified', 'disputed', 'unresolved'))
);
CREATE INDEX IF NOT EXISTS "entity_events_subject_idx" ON "entity_events" ("subject_entity_id");

-- Everyone else an event involves; the event shows on their profiles too.
CREATE TABLE IF NOT EXISTS "entity_event_participants" (
  "event_id" uuid NOT NULL REFERENCES "entity_events" ("id") ON DELETE CASCADE,
  "entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT '',
  PRIMARY KEY ("event_id", "entity_id")
);
CREATE INDEX IF NOT EXISTS "entity_event_participants_entity_idx" ON "entity_event_participants" ("entity_id");

-- Which sources support (or dispute) which record. record_type is
-- 'fact' | 'event' | 'edge' | 'claim'; contributions carry their filing in
-- contributions.source_record_id.
CREATE TABLE IF NOT EXISTS "record_evidence" (
  "record_type" text NOT NULL,
  "record_id" uuid NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "sources" ("id") ON DELETE CASCADE,
  -- 'supports' | 'disputes' | 'context'
  "relation" text NOT NULL DEFAULT 'supports',
  -- Where in the source: a page, a timestamp, a quoted passage.
  "locator" text NOT NULL DEFAULT '',
  "note" text NOT NULL DEFAULT '',
  PRIMARY KEY ("record_type", "record_id", "source_id"),
  CONSTRAINT "record_evidence_type_check" CHECK ("record_type" IN ('fact', 'event', 'edge', 'claim')),
  CONSTRAINT "record_evidence_relation_check" CHECK ("relation" IN ('supports', 'disputes', 'context'))
);
CREATE INDEX IF NOT EXISTS "record_evidence_source_idx" ON "record_evidence" ("source_id");

ALTER TABLE "entity_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_facts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_event_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "record_evidence" ENABLE ROW LEVEL SECURITY;
