-- Registered accounts (src/lib/auth, docs/auth-plan.md).
-- Idempotent and additive: apply with `node scripts/apply-sql.mjs supabase/sql/2026-10-02-profiles.sql`.
-- Mirrors profiles in src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Grandfather everyone who already has an account (the old invite list), so
-- the registration-code gate only applies to new sign-ups.
INSERT INTO "profiles" ("id", "registered_at")
SELECT "id", "created_at" FROM auth.users
ON CONFLICT ("id") DO NOTHING;

-- RLS on with no policies: only the server (DATABASE_URL, table owner) reads
-- or writes profiles; the anon key can't register itself.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
