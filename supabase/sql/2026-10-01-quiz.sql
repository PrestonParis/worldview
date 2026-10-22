-- Political quiz sessions (src/lib/quiz, docs/quiz.md).
-- Idempotent and additive: apply with `node scripts/apply-sql.mjs supabase/sql/2026-10-01-quiz.sql`.
-- Mirrors quizSessions in src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"edit_token_hash" text NOT NULL,
	"owner_id" uuid,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"bank_version" text NOT NULL,
	"engine_version" text NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refine" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "quiz_sessions_visibility_check" CHECK ("visibility" in ('public', 'private')),
	CONSTRAINT "quiz_sessions_status_check" CHECK ("status" in ('in_progress', 'complete'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_sessions_slug_idx" ON "quiz_sessions" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "quiz_sessions_owner_id_idx" ON "quiz_sessions" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "quiz_sessions_unclaimed_created_idx" ON "quiz_sessions" USING btree ("created_at") WHERE "owner_id" is null;

-- RLS on with no policies: the public Supabase REST API (anon key) can't
-- read quiz rows — private results and edit-token hashes stay server-side.
-- The app connects through DATABASE_URL as the table owner, which bypasses RLS.
ALTER TABLE "quiz_sessions" ENABLE ROW LEVEL SECURITY;
