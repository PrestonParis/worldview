-- Which vote groups each county still owes, and precinct results for close and
-- unplaced contests (docs/elections/ga-close-races.md, "Keeping the count right").
ALTER TABLE "tracked_county_status" ADD COLUMN IF NOT EXISTS "percent_reporting" double precision;
ALTER TABLE "tracked_county_status" ADD COLUMN IF NOT EXISTS "groups_unreported" text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "tracked_contest_precincts" (
  "contest_id" uuid NOT NULL REFERENCES "tracked_contests"("id") ON DELETE CASCADE,
  "county_slug" text NOT NULL,
  "precinct" text NOT NULL,
  "total_votes" integer NOT NULL DEFAULT 0,
  "votes" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("contest_id", "county_slug", "precinct")
);
ALTER TABLE "tracked_contest_precincts" ENABLE ROW LEVEL SECURITY;
