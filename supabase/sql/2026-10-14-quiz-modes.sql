-- Tiered political quiz sessions: one answer log can progress through the
-- Snapshot, Profile, and Deep Map checkpoints. Additive and idempotent.

ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "target_mode" text DEFAULT 'deep' NOT NULL;
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "highest_completed_mode" text;
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "entry_variant" text DEFAULT 'general' NOT NULL;
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "entry_topic" text;
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "deferred" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "checkpoint_history" jsonb DEFAULT '[]'::jsonb NOT NULL;

DO $$ BEGIN
  ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_target_mode_check"
    CHECK ("target_mode" in ('quick', 'standard', 'deep'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_highest_completed_mode_check"
    CHECK ("highest_completed_mode" is null or "highest_completed_mode" in ('quick', 'standard', 'deep'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
