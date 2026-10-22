-- Account roles (src/lib/auth/guard.ts, docs/auth.md).
-- Registration is open, so a profile no longer implies write access to shared
-- data: 'editor' can change shared records, 'member' only owns its own map
-- projects and quizzes. Mirrors profiles.role in src/lib/db/schema.ts.

-- Everyone registered before this migration came in through the registration
-- code, which granted editing — they start as editors; new sign-ups default to
-- member.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'editor' NOT NULL;
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'member';

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_check" CHECK ("role" IN ('member', 'editor'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
