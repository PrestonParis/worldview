-- Duplicate entities merged by scripts/merge-entities.mjs. The merged id
-- no longer exists; pages and links that still carry it resolve through
-- this table to the entity it was folded into. `snapshot` records every row
-- the merge moved or dropped, so it can be undone (--unmerge).

CREATE TABLE IF NOT EXISTS "entity_merges" (
  "merged_id" uuid PRIMARY KEY,
  "into_id" uuid NOT NULL REFERENCES "entities" ("id") ON DELETE CASCADE,
  "merged_name" text NOT NULL,
  "reason" text NOT NULL,
  "snapshot" jsonb NOT NULL DEFAULT '{}',
  "merged_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "entity_merges" ADD COLUMN IF NOT EXISTS "snapshot" jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "entity_merges_into_idx" ON "entity_merges" ("into_id");

ALTER TABLE "entity_merges" ENABLE ROW LEVEL SECURITY;

-- One id per entity in each one-per-person scheme (Bioguide, ICPSR, Open
-- States, Wikidata, ...); FEC and LDA ids can repeat (a member's House and
-- Senate runs, a firm's several registrations).
CREATE UNIQUE INDEX IF NOT EXISTS "entity_identifiers_single_valued_idx" ON "entity_identifiers" ("entity_id", "scheme")
  WHERE "scheme" NOT IN ('fec_candidate', 'fec_committee', 'lda_client', 'lda_registrant');
