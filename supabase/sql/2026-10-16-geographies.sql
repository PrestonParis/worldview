-- Dimension tables for area_stats (src/lib/db/schema.ts).
--
-- area_stats.geo_level holds three kinds of thing: real geographies (state,
-- county, congressional district, ...), breakdowns of a place (citizenship,
-- age group, visa class, ... with geoid "<place>:<value>" when scoped), and
-- named sites (police agencies, detention facilities, CBP sectors).
-- geo_levels records which is which, so the catalog, the map studio, and
-- cross-dataset queries can tell a map-able place from a category.
--
-- geographies is the canonical list of places (FIPS hierarchy) with one
-- name each, so datasets can be joined by place regardless of how each
-- source spelled the name. Filled by scripts/build-geographies.mjs.

CREATE TABLE IF NOT EXISTS "geo_levels" (
  "level" text PRIMARY KEY,
  -- 'geography' | 'breakdown' | 'site'
  "kind" text NOT NULL,
  "label" text NOT NULL,
  -- The level whose geoid prefixes this one's ("state" for county "06037").
  "parent_level" text,
  "description" text NOT NULL DEFAULT '',
  CONSTRAINT "geo_levels_kind_check" CHECK ("kind" IN ('geography', 'breakdown', 'site'))
);

INSERT INTO "geo_levels" ("level", "kind", "label", "parent_level", "description") VALUES
  ('nation', 'geography', 'United States', NULL, 'geoid "US".'),
  ('us', 'geography', 'United States', NULL, 'Older spelling of nation, geoid "US" (census-acs5).'),
  ('region', 'geography', 'World region', NULL, 'geoid "<scope>:<region>", scope a state FIPS or "US".'),
  ('country', 'geography', 'Country', NULL, 'geoid "<scope>:<country>" for country-of-birth breakdowns, or a country code.'),
  ('state', 'geography', 'State', 'nation', 'Two-digit state FIPS.'),
  ('county', 'geography', 'County', 'state', 'Five-digit county FIPS.'),
  ('cd', 'geography', 'Congressional district', 'state', 'State FIPS + two-digit district.'),
  ('sldu', 'geography', 'State senate district', 'state', 'State FIPS + three-character district.'),
  ('sldl', 'geography', 'State house district', 'state', 'State FIPS + three-character district.'),
  ('eavs_jurisdiction', 'geography', 'Election jurisdiction', 'state', 'EAC election administration jurisdiction code.'),
  ('border_region', 'geography', 'Border region', 'nation', 'CBP land border region.'),
  ('aor', 'site', 'CBP area of responsibility', 'nation', 'Border Patrol sector or OFO field office.'),
  ('agency', 'site', 'Law enforcement agency', 'state', 'FBI ORI code.'),
  ('facility', 'site', 'Detention facility', 'state', '"<state>-<facility slug>".'),
  ('flow', 'breakdown', 'State-to-state flow', 'state', '"<from state FIPS>:<to state FIPS>".'),
  ('citizenship', 'breakdown', 'Citizenship', 'nation', 'Country of citizenship slug.'),
  ('class', 'breakdown', 'Admission class', 'nation', 'Visa or admission class code.'),
  ('entry_period', 'breakdown', 'Period of entry', 'nation', 'Range of entry years.'),
  ('age_group', 'breakdown', 'Age group', 'nation', 'Age band.'),
  ('group', 'breakdown', 'Group', 'nation', 'Religious or demographic group slug.')
ON CONFLICT ("level") DO NOTHING;

CREATE TABLE IF NOT EXISTS "geographies" (
  "level" text NOT NULL REFERENCES "geo_levels" ("level"),
  "geoid" text NOT NULL,
  "name" text NOT NULL,
  -- Two-letter postal code of the containing state, for display.
  "state" text,
  "parent_level" text,
  "parent_geoid" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("level", "geoid")
);
CREATE INDEX IF NOT EXISTS "geographies_parent_idx" ON "geographies" ("parent_level", "parent_geoid");

ALTER TABLE "geo_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "geographies" ENABLE ROW LEVEL SECURITY;
