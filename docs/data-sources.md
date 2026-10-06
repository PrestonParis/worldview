# Public data sources

Every importer is idempotent (upsert on a stable key) and logs a `sync_runs`
row. Target cloud without touching `.env.local` by prefixing `ENV_FILE=.env.cloud`.
Full load in dependency order: `ENV_FILE=.env.cloud npm run import:all`
(`-- quick` skips the multi-hour sweeps). Weekly refresh:
`.github/workflows/sync-public-data.yml`.

New Postgres tables are in `supabase/sql/2026-10-01-data-imports.sql`
(additive, `npm run db:apply-sql -- <file>`), mirrored in `src/lib/db/schema.ts`.

## Identity spine (run first)

| Script | Source | Writes |
|---|---|---|
| `backfill:members -- --congresses=95-119` | unitedstates/congress-legislators | politician entities keyed by `bioguideId`, plus `icpsrId`, `wikidataId`, `fecCandidateIds`, `govtrackId`, `opensecretsId`, `votesmartId`, `ballotpediaId`, `thomasId`, `lisId`; blank website/social/portrait fields filled |
| `import:committees` | congress-legislators committees + membership | committee/subcommittee org entities (`committeeId`), `sits-on-committee` / `chairs` edges; dropped seats get `validTo` |
| `import:openstates` | Open States people CSVs + openstates/people executive YAML | state legislators + statewide executives (`openstatesId`, `govLevel='state'`, `govState`, `govChamber`, `govDistrict`, `govOffice`), `serves-in` / `holds-office` edges. Feeds My Government (`src/lib/my-government/state.ts`) |

## Datasets

| Script | Source | Table | Key needed |
|---|---|---|---|
| `import:voteview` | Voteview DW-NOMINATE members | `member_ideology` | — |
| `import:congress-bills` / `-votes` | Congress.gov API | `bills`, `roll_calls`, `votes`, … | api.data.gov (`CONGRESS_GOV_API_KEY` or `FEC_API_KEY`) |
| `import:fec-cycle` | OpenFEC | `candidate_finance`, `contributions` | `FEC_API_KEY` |
| `import:fec-ie` | OpenFEC Schedule E (periodic reports only) | `independent_expenditures` | `FEC_API_KEY` |
| `import:lda-lobbying -- --all` | Senate LDA | `lobbying_registrations`, `lobbying_issues` | `LDA_API_KEY` recommended |
| `import:federal-register` | FederalRegister.gov | `executive_documents` (presidential docs since 1994 + significant rules) | — |
| `import:scdb` | Supreme Court Database | `court_cases`, `case_votes` | — (pass `--url=` for a new release) |
| `import:acs` | Census ACS 5-year | `area_stats` (`census-acs5`; us/state/county/cd/sldu/sldl) | `CENSUS_API_KEY` |
| `import:usaspending` | USAspending.gov | `area_stats` (`usaspending`; state/county/cd by award type, agencies) | — |
| `import:fbi-crime` | FBI Crime Data Explorer | `area_stats` (`fbi-cde`; nation/state monthly) | api.data.gov (`FBI_API_KEY` or `FEC_API_KEY`) |
| `import:cbp` | CBP nationwide encounters | `area_stats` (`cbp`; state/border region/nation/citizenship monthly) | — |
| `import:ice-detention` | ICE detention statistics workbooks (FY19–) | `area_stats` (`ice-detention`; nation/state/facility ADP per FY) | — |
| `import:dhs-yearbook` | DHS OHSS Yearbook of Immigration Statistics | `area_stats` (`dhs-yearbook`; LPRs 1820–, naturalizations 1907–, refugees 1980–, asylum 1990–; state, country, class breakdowns) | — |
| `import:census-pep` | Census Population Estimates (V2020 + latest) | `area_stats` (`census-pep`; nation/state/county population + net international/domestic migration, 2011–) | — |
| `import:acs-immigration` | Census ACS 1-year B05002/B05006 | `area_stats` (`census-acs1-immigration`; foreign-born, citizenship, region/country of birth; nation/state 2005–) | `CENSUS_API_KEY` |
| `import:eavs` | EAC EAVS 2024 | `area_stats` (`eavs`; jurisdiction/county/state) | — |

Every importer registers its dataset in the `datasets` catalog (`scripts/lib/catalog.mjs`); see docs/data-hosting.md for the catalog, partner publishing, and the public data API. `scripts/lib/xlsx.mjs` reads Excel workbooks (DHS, ICE) without a dependency.

`area_stats` is one long table: `(source, metric, geo_level, geoid, period) → value`.
State `geoid` is always the 2-digit FIPS; county the 5-digit FIPS; `cd` is
state FIPS + district.

## Not wired (and why)

- **FRED** — needs its own key (not api.data.gov).
- **State bills/votes** — Open States API v3 needs a key and has a low daily quota.
- **FEC individual donors at scale** — bulk files; one entity per donor floods the graph.
- **IRS 990s, Wikidata judges/dynasties** — next pass.
- **Google Civic / ProPublica Congress / OpenSecrets APIs** — shut down or unresponsive.
