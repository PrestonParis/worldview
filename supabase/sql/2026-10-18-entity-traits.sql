-- Personal traits of people entities (sex, birth year, birthplace, race and
-- ethnicity, ancestry, religion), filled by scripts/import-entity-traits.mjs.
-- Every row comes from a published record — Wikidata statements, Wikipedia
-- article categories, Open States — never inferred from a name or photo.
-- A trait can hold several values (two ancestries, a Jewish atheist), so
-- the value is part of the key.
--
-- Derived data: the import rewrites a source's rows on every run, so merged
-- entities lose theirs by cascade and the kept entity regains them on the
-- next run through the crosswalk ids the merge moved over.

CREATE TABLE IF NOT EXISTS "entity_traits" (
  "entity_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  -- 'sex' | 'birth_year' | 'birth_country' | 'race' | 'ancestry' | 'religion'
  "trait" text NOT NULL,
  "value" text NOT NULL,
  -- The specific record behind a grouped value: "Southern Baptist Convention"
  -- under religion 'protestant', the category or statement that set it.
  "detail" text NOT NULL DEFAULT '',
  -- 'wikidata' | 'wikipedia' | 'openstates'
  "source" text NOT NULL,
  "source_url" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id", "trait", "value")
);
CREATE INDEX IF NOT EXISTS "entity_traits_trait_value_idx" ON "entity_traits" ("trait", "value");

ALTER TABLE "entity_traits" ENABLE ROW LEVEL SECURITY;
