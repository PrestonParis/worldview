ALTER TABLE "map_projects"
  ADD COLUMN IF NOT EXISTS "document_version" integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN "map_projects"."document_version" IS
  'Version of the saved Geography project document; migrated on read.';
