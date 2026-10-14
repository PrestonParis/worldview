ALTER TABLE "map_projects"
  ADD COLUMN IF NOT EXISTS "live_values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "share_token" uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS "map_projects_share_token_idx"
  ON "map_projects" ("share_token");

ALTER TABLE "map_projects"
  ALTER COLUMN "document_version" SET DEFAULT 3;

COMMENT ON COLUMN "map_projects"."share_token" IS
  'Unlisted capability token for the explicitly enabled read-only presentation view.';
