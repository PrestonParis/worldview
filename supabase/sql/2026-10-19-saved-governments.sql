-- A member's saved My Government result: the districts and officials for
-- their address, so elections and profiles can point out their own. The
-- street address itself is never stored.
CREATE TABLE IF NOT EXISTS "saved_governments" (
  "owner_id" uuid PRIMARY KEY REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "data" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "saved_governments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "saved_governments" FROM anon, authenticated;
