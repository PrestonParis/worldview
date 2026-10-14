# Public data sources

Every importer is idempotent (upsert on a stable key) and logs a `sync_runs`
row. Target cloud without touching `.env.local` by prefixing `ENV_FILE=.env.cloud`.
Full load in dependency order: `ENV_FILE=.env.cloud npm run import:all`
(`-- quick` skips the multi-hour sweeps). Weekly refresh:
`.github/workflows/sync-public-data.yml`.

New Postgres tables are in `supabase/sql/2026-10-01-data-imports.sql`
(additive, `npm run db:apply-sql -- <file>`), mirrored in `src/lib/db/schema.ts`.

## Two databases: Supabase + Neon

`area_stats` is split across two Postgres databases. Supabase (`DATABASE_URL`)
is kept just under its 500 MB plan cap, since past the cap it goes
read-only. The datasets that don't fit go to Neon (`NEON_DATABASE_URL`, project
`lucky-dew-67554375`, 1 GB per branch). Each dataset's rows are all in
one of the two; `datasets.storage` (`supabase` | `neon`, kept in Supabase)
records which. Everything else, including the catalog, accounts and other
tables, stays in Supabase.

- Reads: `src/lib/db/stores.ts` sends each query to the right database and
  merges queries that span datasets.
- Writes: importers' `upsertRows(pg, "area_stats", ...)` routes by dataset
  (`scripts/lib/stores.mjs`). If a write would take Supabase past
  `SUPABASE_LIMIT_MB` (480), that dataset is moved to Neon first.
- Rebalancing: `ENV_FILE=.env.cloud npm run db:rebalance` prints the plan,
  and `-- --apply` carries it out. It fills Supabase up to `--target`
  (`SUPABASE_TARGET_MB`, 450) and moves the rest to Neon. Moves copy the
  rows, switch `datasets.storage`, wait out the app's 60s placement cache,
  then delete the old copy. Afterwards it rebuilds Supabase's `area_stats`
  so the freed space counts. Don't run imports during a rebalance.
- Schema: `scripts/migrate.mjs` also applies `supabase/sql/neon/*.sql` to
  Neon. In both databases `area_stats`' primary key is the natural key
  `(source, metric, geo_level, geoid, period)`, and it's the table's only
  index. Every query filters by `source`.
- Bloat: re-imports skip rows whose values haven't changed, so
  `updated_at` means "last changed". `ENV_FILE=.env.cloud npm run
  db:rebalance -- --compact` rewrites `area_stats` in both databases to
  reclaim dead space.
- Local: the local stack is a single database with no cap.
  `NEON_DATABASE_URL` stays unset in `.env.local`, and `npm run db:pull`
  mirrors both clouds into it.
- The Neon CLI (`neon link` / `neon deploy`) writes its variables to `.env`.
  The app never reads that file's `DATABASE_URL`.

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
| `import:census-historical-nativity` | Census foreign-born population by decennial census (Working Paper 29 + Census 2000 brief, transcribed) | `area_stats` (`census-historical-nativity`; nation 1850–2000: foreign-born, share, total population) | — |
| `import:census-pep` | Census Population Estimates (V2020 + latest) | `area_stats` (`census-pep`; nation/state/county population, births, deaths, net international/domestic migration, 2011–) | — |
| `import:acs-immigration` | Census ACS 1-year B05002/B05006 | `area_stats` (`census-acs1-immigration`; foreign-born, citizenship, region/country of birth; nation/state 2005–) | `CENSUS_API_KEY` for 2005–2019; without one, 2021+ loads from the keyless summary files |
| `import:state-migration` | Census State-to-State Migration Flows (ACS 1-year) | `area_stats` (`census-state-migration`; origin→destination flows + in/out/net/from-abroad per state, 2022–) | — |
| `import:un-migrant-stock` | UN DESA International Migrant Stock | `area_stats` (`un-migrant-stock`; U.S.-born living abroad by country/region, foreign-born in the U.S., 1990–) | — |
| `import:religion` | Pew Religious Landscape Study (state, religious-group, and denomination pages, scraped; 2007, 2014, 2023–24) and Gallup's religion trend tables | `area_stats` (`pew-rls`: affiliation, attendance, prayer, belief, importance, party by state, nation, and `group` (tradition slug), plus each group's age/race/education; `gallup-religion`: national yearly membership, attendance, preference since 1948). `--only=pew,gallup`; `--cache=<dir>` keeps Pew pages between runs (Pew's bot check 403s bursts; the importer backs off) | — |
| `import:acs-social` | Census ACS 1-year (B12001, B12501/B12503, B12007, B13002, B11001, B25010, B09002, B06007, B15002, B19013, B17001) + decennial urban/rural (2000/2010 SF1, 2020 DHC) | `area_stats` (`census-acs1-family`: marriage, divorce, births, households, children's families; `census-acs1-social`: language, education, income, poverty; `census-urban-rural`; nation/state, 2008–). `--only=acs,urban` | `CENSUS_API_KEY` |
| `import:fertility` | NCHS births and fertility (CDC open data e6fc-ccez, daba-4vfq) + World Bank SP.DYN.TFRT.IN | `area_stats` (`cdc-natality`: births, general fertility rate, birth rate, 1909–; `world-bank-fertility`: births per woman, U.S. + 13 comparison countries and the world, 1960–) | — |
| `import:federal-budget` | OMB Historical Tables (latest Budget edition; tables 1.1, 1.2, 3.1, 7.1, 11.3, 12.1, actual years only), Treasury Fiscal Data API (Debt to the Penny, Monthly Treasury Statement Table 1, average interest rates), PaymentAccuracy.gov | `area_stats` (`omb-historical-tables`: receipts/outlays/deficit since 1901, outlays by function and benefit program, grants to states, debt, FY periods; `treasury-fiscal-data`: month-end debt 1993–, monthly receipts/outlays/deficit FY2014–, interest rate 2001–; `payment-accuracy`: government-wide improper-payment rates FY2021–). `--only=omb,treasury,accuracy` | — |
| `import:fred` | FRED keyless CSV endpoint (`fredgraph.csv`), republishing BLS, BEA, Census, Fed, Freddie Mac, FHFA, S&P CoreLogic, EIA, and University of Michigan series | `area_stats` (`fred-economy`: unemployment, payrolls, CPI/inflation, wages, GDP, household income, fed funds, sentiment, recessions, federal minimum wage; states: monthly unemployment 2015–, annual 1976–, per capita income, state minimum wage. `fred-housing`: Case-Shiller, median sale price, mortgage rate, starts, homeownership, vacancy, rent inflation; states: FHFA index + homeownership. `fred-energy-prices`: gasoline, electricity, WTI, Henry Hub. `fred-education`: student loans, tuition CPI). Monthly `2026-08`, quarterly `2026-Q2`. `--only=economy,housing,energy,education,states` | — |
| `import:acs-issues` | Census ACS 1-year (B27010, C27007, C27006; B25064, B25077, B25070, B25071, B25003) | `area_stats` (`census-acs1-health`: uninsured, Medicaid, Medicare, nation/state 2009–; `census-acs1-housing`: rent, home value, rent burden, owner share, 2008–). `--only=health,housing` | `CENSUS_API_KEY` |
| `import:health` | CDC VSRR provisional overdose deaths (data.cdc.gov xkb8-kh2a) + World Bank WDI health indicators | `area_stats` (`cdc-overdose-deaths`: 12-month-ending deaths by drug, nation 2015–, states total; NY + NYC summed. `world-bank-health`: life expectancy, infant mortality, health spending for the U.S., 15 peers, OECD, world). `--only=overdose,worldbank` | — |
| `import:guns` | CDC NCHS injury mortality (data.cdc.gov nt65-c7a7, 1999–2016) + Gallup gun trend tables | `area_stats` (`cdc-injury-mortality`: firearm deaths by intent, crude rates, rates by age group; `gallup-guns`: gun in home, ownership, opinion on gun laws, 1959–). `--only=cdc,gallup`. Gallup's CDN sometimes serves the page without tables; the importer retries | — |
| `import:naep` | NAEP Data Service API | `area_stats` (`naep`: grade 4/8 math and reading average scores and % at or above Proficient, national public + every state; math 1996–, reading 1998–, accommodated samples only) | — |
| `import:climate` | Our World in Data `co2-data` and `energy-data` CSVs (GitHub) + NOAA Climate at a Glance JSON | `area_stats` (`owid-energy`: CO₂ totals, per person, global share 1950–, electricity mix by source 1985–, for the U.S., 9 other emitters and the world; `noaa-climate`: annual average temperature, contiguous U.S. and 49 states, 1895–). `--only=owid,noaa` | — |
| `import:eavs` | EAC EAVS 2024 | `area_stats` (`eavs`; jurisdiction/county/state) | — |
| `import:cps-voting` | Census CPS November Voting and Registration Supplement, 2020–2024 (public-use microdata) | `area_stats` (`cps-voting`; nation/state; citizens, registered, voted by age, race, sex, education, income, voting method) | — |

Every importer registers its dataset in the `datasets` catalog (`scripts/lib/catalog.mjs`); see docs/data-hosting.md for the catalog, partner publishing, and the public data API. `scripts/lib/xlsx.mjs` reads Excel workbooks (DHS, ICE) without a dependency.

`area_stats` is one long table: `(source, metric, geo_level, geoid, period) → value`.
State `geoid` is always the 2-digit FIPS; county the 5-digit FIPS; `cd` is
state FIPS + district.

## Not wired (and why)

- **FRED API** — needs its own key; `import:fred` uses the keyless `fredgraph.csv` download instead.
- **HUD homelessness (PIT counts)** — huduser.gov answers scripted downloads with a bot check.
- **NICS background checks, gun laws by state** — FBI publishes NICS only as PDFs; no maintained machine-readable gun-law source.
- **EIA state energy data** — needs an EIA key.
- **State bills/votes** — Open States API v3 needs a key and has a low daily quota.
- **FEC individual donors at scale** — bulk files; one entity per donor floods the graph.
- **IRS 990s, Wikidata judges/dynasties** — next pass.
- **Google Civic / ProPublica Congress / OpenSecrets APIs** — shut down or unresponsive.
