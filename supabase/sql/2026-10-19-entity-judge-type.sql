-- Judges join the entity types, for the Supreme Court justices loaded by
-- scripts/import-supreme-court.mjs. Mirrors src/lib/db/schema.ts.
ALTER TABLE "entities" DROP CONSTRAINT IF EXISTS "entities_type_check";
ALTER TABLE "entities" ADD CONSTRAINT "entities_type_check"
  CHECK ("type" IN ('politician', 'judge', 'pundit', 'journalist', 'organization', 'company', 'lobbyist', 'donor'));
