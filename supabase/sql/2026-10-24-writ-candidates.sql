-- Writ close races, Oct 24 2026 (docs/elections/ga-close-races.md).
--
-- 1. tracked_contest_areas.linked: false for a county's copy of a state
--    contest that the county feed doesn't link to it (parentId null), which
--    SOS may leave out of the statewide total. Shown, never summed.
-- 2. Candidate registrations from official campaign-finance registries and
--    their matches to contest options, for public campaign contacts. Filled
--    by scripts/sync-ga-candidates.mjs, independently of the results ingest.
--    Mailing addresses are never stored. Mirrors src/lib/db/schema.ts.

ALTER TABLE "tracked_contest_areas" ADD COLUMN IF NOT EXISTS "linked" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "tracked_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ga-gtcfc (Georgia campaign finance commission, PeachFile) | fec
  "source" text NOT NULL,
  -- ga-gtcfc:{filerRegistrationGuid} | fec:{candidate_id}
  "external_id" text NOT NULL,
  "state" text NOT NULL,
  "cycle_year" integer NOT NULL,
  "election_cycle" text,
  "name" text NOT NULL,
  "ballot_name" text,
  "first_name" text,
  "middle_name" text,
  "last_name" text NOT NULL,
  "party" text,
  "office" text NOT NULL,
  -- Normalized office (state_house, county_commission, …) and district number.
  "office_family" text,
  "district" text,
  -- County name for county and municipal offices.
  "jurisdiction" text,
  "registration_status" text,
  "committee_name" text,
  "website" text,
  -- Contacts as published by the registry: the campaign committee's, and the
  -- candidate's own filer contact on the public profile.
  "campaign_email" text,
  "campaign_phone" text,
  "filer_email" text,
  "filer_phone" text,
  "source_url" text NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_candidates_external_id_idx" ON "tracked_candidates" ("external_id");
CREATE INDEX IF NOT EXISTS "tracked_candidates_lookup_idx" ON "tracked_candidates" ("state", "cycle_year", "office_family", "district");

CREATE TABLE IF NOT EXISTS "tracked_candidate_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "option_id" uuid NOT NULL REFERENCES "tracked_contest_options"("id") ON DELETE CASCADE,
  "candidate_id" uuid NOT NULL REFERENCES "tracked_candidates"("id") ON DELETE CASCADE,
  -- verified: office, district, jurisdiction and full name agree.
  -- probable: office, district and jurisdiction agree, last name is unique
  --           there, given name differs (nickname or middle name).
  "confidence" text NOT NULL,
  "evidence" text NOT NULL,
  "matched_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_candidate_matches_pair_idx" ON "tracked_candidate_matches" ("option_id", "candidate_id");
CREATE INDEX IF NOT EXISTS "tracked_candidate_matches_candidate_idx" ON "tracked_candidate_matches" ("candidate_id");

ALTER TABLE "tracked_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracked_candidate_matches" ENABLE ROW LEVEL SECURITY;
