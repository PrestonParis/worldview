-- User-owned state for the Worldview Atlas exploration layer. Political quiz
-- answers stay in quiz_sessions; this table only holds deliberate saves and
-- compact specialist-assessment results.
CREATE TABLE IF NOT EXISTS "atlas_profiles" (
  "owner_id" uuid PRIMARY KEY REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "saved_philosophies" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "economic_result" jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "atlas_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "atlas_profiles" FROM anon, authenticated;
