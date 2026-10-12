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
| `import:fbi-crime` | FBI Crime Data Explorer | `area_stats` (`fbi-cde`; nation/state monthly) | api.data.gov (`FBI_API_KEY`, `FEC_API_KEY`, or `CONGRESS_GOV_API_KEY`) |
| `import:fbi-cities` | FBI Crime Data Explorer, agency level | `area_stats` (`fbi-cde-cities`; police departments of cities over 100k, monthly offenses + annual staffing; geo_level `agency`, geoid = ORI) | api.data.gov + `CENSUS_API_KEY` (city list) |
| `import:fbi-annual` | FBI Crime Data Explorer hate crime + arrest tables | `area_stats` (`fbi-hate-crime`, `fbi-arrests`; nation/state annual) | api.data.gov |
| `import:cdc-violent-deaths` | CDC Mapping Injury, Overdose, and Violence (NVSS) | `area_stats` (`cdc-violent-deaths`; homicide + firearm deaths, nation/state 2019–, county homicide; `*_ttm` trailing 12 months) | — |
| `import:ncvs` | BJS National Crime Victimization Survey (NCVS Select microdata via api.ojp.gov) | `area_stats` (`bjs-ncvs`; national victimization rates, share reported to police, domestic violence, 1993–) | — |
| `import:abortion` | Guttmacher Monthly Abortion Provision Study + 1973–2020 series (OSF), CDC Abortion Surveillance tables (PubMed Central), Guttmacher state policy summaries | `area_stats` (`guttmacher-monthly-abortions`: nation/state monthly 2023–, annual travel + telehealth, occurrence×residence flows; `guttmacher-pregnancy-history`: state of residence 1973–2020; `cdc-abortion-surveillance`: state of occurrence 2019–, method/age/gestation/race; `abortion-gestational-limits`: monthly snapshot). `--only=monthly,history,cdc,limits`. New CDC reports are added to `CDC_REPORTS` by hand | — |
| `import:cbp` | CBP nationwide encounters (state + area-of-responsibility files) | `area_stats` (`cbp`; state/border region/nation/citizenship monthly; Border Patrol vs. Field Operations; sector/field office) | — |
| `import:ice-detention` | ICE detention statistics workbooks (FY19–) | `area_stats` (`ice-detention`; nation/state/facility ADP per FY) | — |
| `import:dhs-yearbook` | DHS OHSS Yearbook of Immigration Statistics | `area_stats` (`dhs-yearbook`; LPRs 1820–, naturalizations 1907–, refugees 1980–, asylum 1990–, nonimmigrant admissions by class, removals/returns 1892–; state, country, class breakdowns) | — |
| `import:dhs-unauthorized` | DHS OHSS unauthorized immigrant population estimates (PDF, transcribed) | `area_stats` (`dhs-unauthorized`; nation 2000, 2005–2022; top countries, top states, period of entry) | — |
| `import:census-pep` | Census Population Estimates (V2020 + latest) | `area_stats` (`census-pep`; nation/state/county population + net international/domestic migration, 2011–) | — |
| `import:acs-immigration` | Census ACS 1-year B05002/B05006 | `area_stats` (`census-acs1-immigration`; foreign-born, citizenship, region/country of birth; nation/state 2005–) | `CENSUS_API_KEY` for 2005–2019; without one, 2021+ loads from the keyless summary files |
| `import:state-migration` | Census State-to-State Migration Flows (ACS 1-year) | `area_stats` (`census-state-migration`; origin→destination flows + in/out/net/from-abroad per state, 2022–) | — |
| `import:un-migrant-stock` | UN DESA International Migrant Stock | `area_stats` (`un-migrant-stock`; U.S.-born living abroad by country/region, foreign-born in the U.S., 1990–) | — |
| `import:eavs` | EAC EAVS 2024 | `area_stats` (`eavs`; jurisdiction/county/state) | — |
| `import:cps-voting` | Census CPS November Voting and Registration Supplement, 2020–2024 (public-use microdata) | `area_stats` (`cps-voting`; nation/state; citizens, registered, voted by age, race, sex, education, income, voting method) | — |

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
