#!/usr/bin/env bash
# Full public-data load, in dependency order. Backs up first.
#
#   ENV_FILE=.env.cloud npm run import:all          # everything
#   ENV_FILE=.env.cloud npm run import:all -- quick # skip the multi-hour sweeps
#
# Each step is idempotent, so a failed run can simply be re-run. Steps that
# need a key they don't have fail loudly and the script continues.
set -u
QUICK="${1:-}"
step() {
  echo; echo "=== $* ==="
  "$@" || echo "!!! step failed: $*"
}

step node scripts/export-db.mjs
step node scripts/apply-sql.mjs supabase/sql/2026-10-01-data-imports.sql
step node scripts/apply-sql.mjs supabase/sql/2026-10-05-data-hosting.sql
step node scripts/sync-catalog.mjs

# Identity spine first — everything below resolves people through it.
step node scripts/backfill-members.mjs --congresses=95-119
step node scripts/import-congress-committees.mjs
step node scripts/import-openstates-people.mjs
step node scripts/import-voteview.mjs

# Reference datasets (fast).
step node scripts/import-scdb.mjs
step node scripts/import-federal-register.mjs
step node scripts/import-cbp-encounters.mjs
step node scripts/import-ice-detention.mjs
step node scripts/import-dhs-yearbook.mjs
step node scripts/import-dhs-unauthorized.mjs
step node scripts/import-census-historical-nativity.mjs
step node scripts/import-census-pep.mjs
step node scripts/import-state-migration.mjs
step node scripts/import-un-migrant-stock.mjs
step node scripts/import-eavs.mjs
step node scripts/import-cps-voting.mjs
step node scripts/import-acs.mjs
step node scripts/import-acs-immigration.mjs
step node scripts/import-usaspending.mjs
step node scripts/import-cdc-violent-deaths.mjs
step node scripts/import-bjs-ncvs.mjs
step node scripts/import-abortion.mjs
step node scripts/import-acs-social.mjs
step node scripts/import-fertility.mjs
step node scripts/import-religion.mjs
step node scripts/import-federal-budget.mjs
step node scripts/import-fred.mjs
step node scripts/import-acs-issues.mjs
step node scripts/import-health.mjs
step node scripts/import-guns.mjs
step node scripts/import-naep.mjs
step node scripts/import-climate.mjs

# Rate-limited API sweeps (slow).
step node scripts/import-congress-bills.mjs --congress=119
step node scripts/import-congress-votes.mjs --congress=119
step node scripts/import-fec-cycle.mjs --office=H,S
step node scripts/import-fec-independent-expenditures.mjs
step node scripts/import-fbi-crime.mjs
step node scripts/import-fbi-annual.mjs
step node scripts/import-fbi-cities.mjs
if [ "$QUICK" != "quick" ]; then
  step node scripts/import-congress-bills.mjs --congress=118
  step node scripts/import-congress-votes.mjs --congress=118
  step node scripts/import-fec-cycle.mjs --cycle=2024 --office=H,S,P
  step node scripts/import-fec-independent-expenditures.mjs --cycle=2024
  step node scripts/import-lda-lobbying.mjs --all --years=2025,2026
fi
echo; echo "import-all finished"
