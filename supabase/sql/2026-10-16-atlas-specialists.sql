-- Additional specialist assessments in the user-owned Atlas profile.
ALTER TABLE "atlas_profiles" ADD COLUMN IF NOT EXISTS "authority_result" jsonb;
ALTER TABLE "atlas_profiles" ADD COLUMN IF NOT EXISTS "foreign_policy_result" jsonb;
