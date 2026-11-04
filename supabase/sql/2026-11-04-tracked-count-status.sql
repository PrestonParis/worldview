-- SOS separates "election night complete" from "fully reported", and the
-- results hub reports both, plus turnout and certification by county
-- (docs/elections/ga-close-races.md, "Report").
ALTER TABLE "tracked_contests" ADD COLUMN IF NOT EXISTS "units_fully_reported" integer;
ALTER TABLE "tracked_contests" ADD COLUMN IF NOT EXISTS "units_night_complete" integer;
ALTER TABLE "tracked_contests" ADD COLUMN IF NOT EXISTS "units_partial" integer;
ALTER TABLE "tracked_contests" ADD COLUMN IF NOT EXISTS "units_not_reported" integer;

CREATE TABLE IF NOT EXISTS "tracked_county_status" (
  "source_election_id" text NOT NULL,
  "county_slug" text NOT NULL,
  "county" text NOT NULL,
  "registered" integer,
  "ballots_cast" integer,
  "units_fully_reported" integer,
  "units_night_complete" integer,
  "units_partial" integer,
  "units_not_reported" integer,
  "is_official" boolean NOT NULL DEFAULT false,
  "source_updated_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_election_id", "county_slug")
);
ALTER TABLE "tracked_county_status" ENABLE ROW LEVEL SECURITY;
