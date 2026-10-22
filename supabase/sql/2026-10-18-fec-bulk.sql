-- FEC bulk data for Subpoena (docs/data-sources.md), filled by
-- scripts/import-fec-bulk.mjs from https://www.fec.gov/data/browse-data/?tab=bulk-data.
--
-- Everything here is keyed by FEC's own ids, not entity ids. Entities attach
-- through the crosswalk (entity_identifiers schemes fec_candidate and
-- fec_committee), so a re-import never depends on entity ids and entity
-- merges carry the money with them for free.

-- Candidate master (cn) merged across cycles; the latest cycle's fields win.
CREATE TABLE IF NOT EXISTS "fec_candidates" (
  "candidate_id" text PRIMARY KEY,
  "name" text NOT NULL,
  "party" text,
  -- 'H' | 'S' | 'P'
  "office" text,
  "state" text,
  "district" text,
  -- 'I' incumbent | 'C' challenger | 'O' open seat
  "incumbent_challenge" text,
  "principal_committee_id" text,
  "first_cycle" smallint NOT NULL,
  "last_cycle" smallint NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Committee master (cm) merged across cycles.
CREATE TABLE IF NOT EXISTS "fec_committees" (
  "committee_id" text PRIMARY KEY,
  "name" text NOT NULL,
  -- A authorized | B lobbyist/registrant PAC | D leadership PAC | J joint
  -- fundraiser | P principal campaign committee | U unauthorized
  "designation" text,
  -- FEC committee type: H/S/P campaign, Q/N PAC, O super PAC, X/Y party, ...
  "committee_type" text,
  "party" text,
  "city" text,
  "state" text,
  -- C corporation | L labor | M membership | T trade | V cooperative | W corp. w/o stock
  "org_type" text,
  "connected_org" text,
  "candidate_id" text,
  "first_cycle" smallint NOT NULL,
  "last_cycle" smallint NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "fec_committees_candidate_idx" ON "fec_committees" ("candidate_id");

-- Committee -> candidate money (pas2), one row per giver, candidate, cycle
-- and kind. Memo lines are dropped and amended transactions counted once.
-- The itemized rows are in the lake (fec/pas2/<cycle>.parquet).
--   contribution  24K direct, 24Z in-kind
--   coordinated   24C party coordinated expenditure
--   ie_support    24E independent expenditure, 24F communication cost, for
--   ie_oppose     24A independent expenditure, 24N communication cost, against
CREATE TABLE IF NOT EXISTS "money_flows" (
  "candidate_id" text NOT NULL,
  "cycle" smallint NOT NULL,
  "kind" text NOT NULL,
  "committee_id" text NOT NULL,
  -- Whole dollars; refunds net out, so a total can be negative.
  "total" bigint NOT NULL,
  "n" integer NOT NULL,
  PRIMARY KEY ("candidate_id", "cycle", "kind", "committee_id"),
  CONSTRAINT "money_flows_kind_check" CHECK ("kind" IN ('contribution', 'coordinated', 'ie_support', 'ie_oppose'))
);
CREATE INDEX IF NOT EXISTS "money_flows_committee_idx" ON "money_flows" ("committee_id", "cycle");

ALTER TABLE "fec_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fec_committees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "money_flows" ENABLE ROW LEVEL SECURITY;
