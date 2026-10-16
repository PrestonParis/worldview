-- Quiz analytics (docs/quiz-plan.md, Analytics). Additive and idempotent.
-- Mirrors quizResponses / quizOpenerEvents in src/lib/db/schema.ts.

-- Sessions started by the site owner (testing), or marked as such on /quiz/stats.
ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT false NOT NULL;

-- Anonymized answer logs of unclaimed quizzes, copied here by the purge job
-- before the session is deleted. No slug, edit token, owner, or session id:
-- nothing links a row back to the quiz link or a person.
CREATE TABLE IF NOT EXISTS "quiz_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_version" text NOT NULL,
	"engine_version" text NOT NULL,
	"target_mode" text NOT NULL,
	"highest_completed_mode" text,
	"status" text NOT NULL,
	"entry_variant" text NOT NULL,
	"entry_topic" text,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refine" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deferred" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checkpoint_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "quiz_responses_created_idx" ON "quiz_responses" USING btree ("created_at");

-- One row per landing-page visit that answered openers or picked a mode.
-- No cookies, IPs, or user agents: only the opener answers and timing.
CREATE TABLE IF NOT EXISTS "quiz_opener_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started" boolean DEFAULT false NOT NULL,
	"mode" text
);

CREATE INDEX IF NOT EXISTS "quiz_opener_events_created_idx" ON "quiz_opener_events" USING btree ("created_at");

ALTER TABLE "quiz_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_opener_events" ENABLE ROW LEVEL SECURITY;
