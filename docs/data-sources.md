# Public data sources

Every importer is idempotent (upsert on a stable key) and logs a `sync_runs`
row. Target cloud without touching `.env.local` by prefixing `ENV_FILE=.env.cloud`.
Full load in dependency order: `ENV_FILE=.env.cloud npm run import:all`
(`-- quick` skips the multi-hour sweeps). Weekly refresh:
`.github/workflows/sync-public-data.yml`.

Tables come from the dated migrations in `supabase/sql/`, applied by
`npm run db:migrate` (and automatically before `npm run dev` and on every
production build), mirrored in `src/lib/db/schema.ts`.

## Two databases: Supabase + Neon

`area_stats` is split across two Postgres databases. Supabase (`DATABASE_URL`)
is on the Pro plan (8 GB disk) and is filled to about 80% of it. The
datasets that don't fit go to Neon (`NEON_DATABASE_URL`, 1 GB
per branch). Each dataset's rows are all in
one of the two; `datasets.storage` (`supabase` | `neon`, kept in Supabase)
records which. Everything else, including the catalog, accounts and other
tables, stays in Supabase.

- Reads: `src/lib/db/stores.ts` sends each query to the right database and
  merges queries that span datasets.
- Writes: importers' `upsertRows(pg, "area_stats", ...)` routes by dataset
  (`scripts/lib/stores.mjs`). If a write would take Supabase past
  `SUPABASE_LIMIT_MB` (6550, about 80% of the Pro plan's 8 GB disk), that
  dataset is moved to Neon first.
- Rebalancing: `ENV_FILE=.env.cloud npm run db:rebalance` prints the plan,
  and `-- --apply` carries it out. It fills Supabase up to `--target`
  (`SUPABASE_TARGET_MB`, 6000) and moves the rest to Neon. Moves copy the
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

## The lake: files outside the databases

Supabase Storage holds files the databases don't need to: it has its own
quota, separate from the database's disk.

- `raw` (private): source files as downloaded. An importer that calls
  `fetchArchived(pg, source, url)` (`scripts/lib/lake.mjs`) keeps each
  distinct version once, by content hash, in `source_snapshots`, so a past
  import can be replayed. It's skipped when Storage credentials aren't set.
- `lake` (public): Parquet extracts, catalogued in `lake_files`.
  `npm run data:lake` exports every published dataset
  (`area-stats/<slug>.parquet`) and the public record tables
  (`tables/<table>.parquet`); accounts, quizzes, saved maps and partner keys
  never leave. Unchanged files aren't re-uploaded. `/datasets/<slug>` and the
  dataset API link them, and DuckDB, pandas, R or Polars read them straight
  from the URL. The weekly `export-lake.yml` workflow rebuilds them.
- Detail too large for Postgres (individual donations, precinct returns)
  goes to the lake as Parquet via `exportParquet`; Postgres keeps only the
  aggregates pages read. Supabase's free plan caps one upload at 50 MB, so
  split larger extracts.

## Data health

`npm run data:health` lists importers whose latest run failed or never
finished, and datasets whose newest period is older than their cadence
allows. The weekly `export-lake.yml` workflow runs it into the run summary
and goes red when an importer failed.

## Entity cleanup

- `npm run data:merge-entities` reports duplicate entities. Those proven by
  a shared FEC id merge with `-- --apply`; name-only matches are listed for
  review and merged with `-- --merge=<from>:<into>`. Entities with different
  ids in a one-per-person scheme (Bioguide, ICPSR, Open States, ...) are never
  merged; a unique index enforces one such id per entity. Each merge records
  a snapshot in `entity_merges`, `-- --unmerge=<id>` reverses it, and old
  links to a merged id redirect.
- `npm run data:repair-donors` restores donors that contributions point at
  but the graph lost, from OpenFEC.
- `npm run db:validate-fks` validates each entity foreign key once no row
  breaks it. Repair and validation run after every production deploy.

## Room for new records

- State legislatures: `bills.jurisdiction` and `roll_calls.jurisdiction`
  are `us` for Congress or a state's postal code; state roll calls have no
  `congress`.
- Polls: `polls` (pollster, field dates, population, sample, the race
  polled, where the sample was drawn) and `poll_results` (one row per choice,
  linked to an entity when it's a candidate).

## Places and breakdowns

`area_stats.geo_level` covers three kinds of thing, recorded in the
`geo_levels` table:

- **geography**: places with boundaries or a FIPS code (`nation`, `state`,
  `county`, `cd`, `sldu`, `sldl`, `eavs_jurisdiction`, `region`, `country`,
  `border_region`).
- **breakdown**: categories of a place (`citizenship`, `class`,
  `entry_period`, `age_group`, `group`, `flow`). A breakdown scoped to one
  place uses geoid `<place>:<value>`, e.g. `01:afghanistan`.
- **site**: named units (`agency`, `facility`, `aor`).

A new importer that adds a level registers it in `geo_levels` in its
migration. `geographies` holds one canonical name and parent state per
place, so datasets that spell names differently still line up. Rebuild it
with `npm run data:geographies`; it runs after every production deploy.
`compareByGeo` (`src/lib/db/stats.ts`) and the public
`GET /api/data/v1/compare?level=county&series=source:metric,...&within=06`
put any published metrics side by side by place.

## Identity spine (run first)

People and organizations live in Postgres (`entities`, `entity_edges`); their
external ids are in the `entity_identifiers` crosswalk, keyed by scheme. Every
importer resolves people through it (`scripts/lib/entities.mjs`), and
`npm run graph:sync` copies the graph to Neo4j.

| Script | Source | Writes |
|---|---|---|
| `backfill:members -- --congresses=95-119` | unitedstates/congress-legislators | politician entities; crosswalk schemes `bioguide`, `icpsr`, `wikidata`, `fec_candidate`, `govtrack`, `opensecrets`, `votesmart`, `ballotpedia`, `thomas`, `lis`; blank website/social/portrait fields filled |
| `import:committees` | congress-legislators committees + membership | committee/subcommittee org entities (scheme `congress_committee`), `sits-on-committee` / `chairs` edges; dropped seats get `valid_to` |
| `import:openstates` | Open States people CSVs + openstates/people executive YAML | state legislators + statewide executives (scheme `openstates`), their current office in `entity_offices` (source `openstates`), `serves-in` / `holds-office` edges. Feeds My Government (`src/lib/my-government/state.ts`) |

FEC and lobbying importers add `fec_candidate`, `fec_committee`, `lda_client`
and `lda_registrant` ids as they match or create entities.

## Datasets

| Script | Source | Table | Key needed |
|---|---|---|---|
| `import:voteview` | Voteview DW-NOMINATE members | `member_ideology` | — |
| `import:congress-bills` / `-votes` | Congress.gov API | `bills`, `roll_calls`, `votes`, … | api.data.gov (`CONGRESS_GOV_API_KEY` or `FEC_API_KEY`) |
| `import:fec-bulk -- --cycles=2022,2024,2026` | FEC bulk files (cn, cm, weball, pas2), cached in `.cache/fec/` | `fec_candidates`, `fec_committees`, `money_flows` (committee → candidate totals per cycle and kind), `candidate_finance`; entities for candidates with money and every giving committee, matched by FEC id only; `--lake` writes itemized pas2 to `fec/pas2/<cycle>.parquet` | none |
| `import:fec-cycle` | OpenFEC | `candidate_finance`, `contributions` | `FEC_API_KEY` |
| `import:fec-ie` | OpenFEC Schedule E (periodic reports only) | `independent_expenditures` | `FEC_API_KEY` |
| `import:lda-lobbying -- --all` | Senate LDA | `lobbying_registrations`, `lobbying_issues` | `LDA_API_KEY` recommended |
| `import:federal-register` | FederalRegister.gov | `executive_documents` (presidential docs since 1994 + significant rules) | — |
| `import:scdb` | Supreme Court Database | `court_cases`, `case_votes` | — (pass `--url=` for a new release) |
| `import:supreme-court` | `data/supreme-court.json` (hand-curated: seats, appointing president, nomination/confirmation/seating dates, Senate vote, Wikidata id, Commons portrait) | `judge` entities matched by SCDB code (`scdb` crosswalk scheme, never by name), `nominated` + `serves-in` edges, fills `case_votes.justice_entity_id`; run after `import:scdb` | — |
| `import:administration` | `data/administration.json` (hand-curated cabinet and cabinet-level roster, map group, start dates, departures under `former`) | `appointed` + `serves-in` edges from the President, `metadata.branch`/`office` on current appointees; prunes this term's edges the file no longer produces | — |
| `import:acs` | Census ACS 5-year (`--year=`; county history loaded for 2009–2024, education from B15002 before 2012, unemployment from 2011) | `area_stats` (`census-acs5`; us/state/county/cd/sldu/sldl) | `CENSUS_API_KEY` |
| `import:usaspending` | USAspending.gov | `area_stats` (`usaspending`; state/county/cd by award type, agencies) | — |
| `import:fbi-crime` | FBI Crime Data Explorer | `area_stats` (`fbi-cde`; nation/state monthly) | api.data.gov (`FBI_API_KEY`, `FEC_API_KEY`, or `CONGRESS_GOV_API_KEY`) |
| `import:fbi-cities` | FBI Crime Data Explorer, agency level | `area_stats` (`fbi-cde-cities`; police departments of cities over 100k, monthly offenses + annual staffing; geo_level `agency`, geoid = ORI) | api.data.gov + `CENSUS_API_KEY` (city list) |
| `import:fbi-annual` | FBI Crime Data Explorer hate crime + arrest tables | `area_stats` (`fbi-hate-crime`, `fbi-arrests`; nation/state annual) | api.data.gov |
| `import:cdc-violent-deaths` | CDC Mapping Injury, Overdose, and Violence (NVSS) | `area_stats` (`cdc-violent-deaths`; homicide + firearm deaths, nation/state 2019–, county homicide; `*_ttm` trailing 12 months) | — |
| `import:ncvs` | BJS National Crime Victimization Survey (NCVS Select microdata via api.ojp.gov) | `area_stats` (`bjs-ncvs`; national victimization rates, share reported to police, domestic violence, 1993–; offender race as victims perceived it, 2012–) | — |
| `import:fbi-arrest-demographics` | FBI Crime Data Explorer arrest tables by offense id (`--nation-only`, `--states=`) | `area_stats` (`fbi-arrest-demographics`; nation 17 offenses + violent, states 5 offenses; race, sex, age bands; 2015–; no ethnicity in CDE) | api.data.gov |
| `import:fbi-homicide` | CDE Supplementary Homicide Reports + NIBRS 09A/11A/120/13A (`--only=shr,nibrs`) | `area_stats` (`fbi-shr`: victims/offenders by race, ethnicity, sex, age; victims by weapon, relationship, circumstance; nation 1990–, states 2010–. `fbi-nibrs-people`: nation 2016–) | api.data.gov |
| `import:fbi-leoka` | CDE LEOKA year-to-date JSON (`cde.ucr.cjis.gov/LATEST/leoka/ytd`) | `area_stats` (`fbi-leoka`; officers killed felonious/accidental, weapons, offender race/sex; 2020–) | — |
| `import:police-violence` | Mapping Police Violence incident workbook (`--file=` for a downloaded .xlsx) + NCHS injury mortality (data.cdc.gov nt65-c7a7). `--only=mpv,cdc` | `area_stats` (`mpv`: people killed by police by year, nation + state, 2013–, by race/sex/armed/cause/encounter/fleeing/charges; current year partial. `cdc-legal-intervention`: death-certificate legal-intervention deaths, nation 1999–2016, by mechanism/race/sex) | — |
| `import:bjs-ppcs` | BJS Contacts Between Police and the Public CSV bundle (`--report=cbpp22`; tables mapped by column, check a new edition's layout first) | `area_stats` (`bjs-ppcs`; 2018–2022: contact rates and reasons, force, traffic/street stop outcomes, misconduct, perceived excessive force; nation + `group` by race/sex/age/income) | — |
| `import:death-penalty` | DPIC execution database CSV + DPIC state-by-state page + BJS Capital Punishment statistical tables (`--bjs-report=cp23st`). `--only=executions,status,bjs` | `area_stats` (`dpic-executions`: executions by year, nation/state/county 1977–, by race/sex/method/victim race; `dpic-status`: has death penalty, abolition year, executive hold; `bjs-capital-punishment`: death row 1953–, by race 1968–, admissions/removals 1973–, executions 1930–, death row by state and race) | — |
| `import:ussc` | U.S. Sentencing Commission Sourcebook Tables 5 and 9 (PDF, via `scripts/lib/pdf.mjs`) | `area_stats` (`ussc-sourcebook`; sentenced individuals by citizenship and by race, overall + geo_level `offense`; FY2016–) | — |
| `import:bop` | BOP quick-facts JSON | `area_stats` (`bop-population`; weekly snapshot: citizenship, race, ethnicity, sex, age, offense, sentence; accumulates per run) | — |
| `import:texas-dps` | Texas DPS criminal illegal noncitizen page (text parsed) | `area_stats` (`texas-dps-noncitizen`; cumulative charges/convictions by offense since June 2011, snapshot per as-of date) | — |
| `import:bjs-prisoners` | BJS Prisoners in 2023 statistical tables (`--report=p24st` next year) | `area_stats` (`bjs-prisoners`; imprisonment rates by race 2013–2023; prisoners by race and by citizenship per state + federal) | — |
| `import:bjs-recidivism` | BJS recidivism of prisoners released in 2012 (CSV tables) | `area_stats` (`bjs-recidivism`; arrested/convicted/reimprisoned within 1–5 years by group, geo_level `group`) | — |
| `import:fred` (additions) | FRED: native- vs foreign-born CPS series, food-at-home CPI + BLS average prices, business applications | `area_stats` (`fred-economy`) | — |
| `import:bls-cps` | BLS Public Data API v1 (keyless, 25 requests/day) | `area_stats` (`bls-cps`; prime-age LFPR and employment by sex, 1948–) | — |
| `import:world-bank-remittances` | World Bank API | `area_stats` (`world-bank-remittances`; U.S. paid, received by country + % of GDP) | — |
| `import:irs-migration` | IRS SOI state inflow/outflow CSVs | `area_stats` (`irs-soi-migration`; state in/out/net returns, people, AGI; state-pair flows; 2012–) | — |
| `import:irs-tax-shares` | IRS SOI Table 4.1 (`--file=` for a newer year) | `area_stats` (`irs-soi-tax-shares`; tax and AGI shares, average rates, floors by percentile, 2001–) | — |
| `import:fed-dfa` | Federal Reserve Distributional Financial Accounts (dfa.zip) | `area_stats` (`fed-dfa`; quarterly 1989-Q3–, geo_level `group`: wealth/income percentiles, race, generation, age, education; balance-sheet levels in $M, shares, households, net worth per household, wealth cutoffs) | — |
| `import:hud-pit` | HUD point-in-time counts by state and CoC (.xlsb workbooks read with `scripts/lib/xlsb.mjs`; `--year=` for the release) | `area_stats` (`hud-pit`; nation/state 2007–: sheltered/unsheltered, individuals/families, chronic, veterans, youth, age 2013–, race/ethnicity 2015–; geo_level `coc` core counts) | — |
| `import:cbo` | CBO open data repository (github.com/US-CBO/cbo-data; cbo.gov itself 403s automated requests). `--vintage=YYYY-MM` | `area_stats` (`cbo-budget`; nation by fiscal year: historical budget 1962–, 10-year baseline `proj_*`, 30-year extended baseline `lt_*`, trust funds `tf_*`; metric labels from CBO schema.json) | — |
| `import:medicare-trustees` | Medicare Trustees Report expanded tables zip from CMS (`--report=` year) | `area_stats` (`medicare-trustees`; nation 1967–2100: cost % GDP by part, enrollment, trust fund income/spending/assets, HI ratio, cost/income rates, workers per beneficiary; `metadata.projected`) | — |
| `import:census-stc` | Census Annual Survey of State Government Tax Collections historical database (STC-Historical-DB.xlsx) | `area_stats` (`census-stc`; nation 1902–, states 1951–: total, income, corporate, sales, excise, fuel, tobacco, alcohol, sports betting, severance, estate, licenses, in dollars) | — |
| `import:state-taxes` | Tax Foundation state income tax rates and brackets workbook (`--rates-url=` for a newer one) + ITEP Who Pays? 7th edition data workbook. `--only=rates,whopays` | `area_stats` (`tax-foundation-state-income-tax`: top rate, brackets, top-bracket start, standard deduction, exemption by state 2015–; `itep-who-pays`: state+local taxes as % of income by income group and tax type, inequality index, revenue mix, 2024 law) | — |
| `import:labor` | unionstats.com Stata files (Hirsch–Macpherson, CPS) + DOL state minimum wage history table. `--only=unions,minwage` | `area_stats` (`unionstats`: membership/coverage rates and counts, nation 1980– + `group` by sector/industry/sex/race/education, states 1983– by sector; `dol-minimum-wage`: federal + state minimum wage 1968–, effective minimum) | — |
| `import:ukraine-support` | Kiel Institute Ukraine Support Tracker workbook (link found on the tracker page; `--file=`/`--url=`) | `area_stats` (`kiel-ukraine-support`; geo_level `donor`: cumulative allocations/commitments by type in $, monthly allocations in €) | — |
| `import:ohss-monthly` | DHS OHSS enforcement and legal processes monthly workbook (last edition Nov 2024) | `area_stats` (`ohss-enforcement`; border book-outs, ICE arrests/book-ins/removals by criminality, credible fear, CBP One, CHNV; monthly FY2014–) | — |
| `import:eoir` | EOIR adjudication statistics PDFs | `area_stats` (`eoir`; backlog, receipts, completions 1983–; asylum decisions, grant rates, applications 2016–; current-FY removal orders and decision outcomes) | — |
| `import:uscis-forms` | USCIS quarterly "Number of Service-wide Forms" (Q4 editions FY2022–, latest quarter) | `area_stats` (`uscis-forms`; I-129/130/140/485/539, N-400 received, approved, denied, pending; I-485 pending by category) | — |
| `import:refugee-admissions` | State Dept Refugee Processing Center admissions workbook | `area_stats` (`wraps-refugees`; ceilings and admissions FY2001–, monthly, by nationality) | — |
| `import:lpr-population` | OHSS LPR population estimates (`data/immigration/lpr-population.json` + latest report's tables) | `area_stats` (`ohss-lpr-population`; LPRs and eligible to naturalize 2006–; latest by country, state, class) | — |
| `import:dhs-overstays` | CBP Entry/Exit Overstay Report PDFs, Table 1 (FY2022–) | `area_stats` (`dhs-overstays`; expected departures, suspected in-country overstays, rate, by visitor type) | — |
| `import:unauthorized-estimates` | Pew and CIS reports, transcribed with quotes in metadata | `area_stats` (`unauthorized-estimates`) | — |
| `import:acs-pums-nativity` | ACS 1-year PUMS via the Census microdata API (`tabulate`) | `area_stats` (`census-pums-welfare`; SNAP, Medicaid, cash, SSI by citizenship; nation 2012–, states 2021–) | `CENSUS_API_KEY` |
| `import:acs-family-groups` | ACS 1-year B13008, B13002H/B/D/I, B11001H/B/D/I, B17006 | `area_stats` (`census-acs1-family-groups`; births by nativity and race, unmarried share, families by race, child poverty by family type; 2010–) | `CENSUS_API_KEY` |
| `import:h1b` | USCIS H-1B Employer Data Hub archive CSVs (FY2009–2023) | `area_stats` (`uscis-h1b`; nation, state, industry, top 250 employers) | — |
| `import:abortion` | Guttmacher Monthly Abortion Provision Study + 1973–2020 series (OSF), CDC Abortion Surveillance tables (PubMed Central), Guttmacher state policy summaries | `area_stats` (`guttmacher-monthly-abortions`: nation/state monthly 2023–, annual travel + telehealth, occurrence×residence flows; `guttmacher-pregnancy-history`: state of residence 1973–2020; `cdc-abortion-surveillance`: state of occurrence 2019–, method/age/gestation/race; `abortion-gestational-limits`: monthly snapshot). `--only=monthly,history,cdc,limits`. New CDC reports are added to `CDC_REPORTS` by hand | — |
| `import:cbp` | CBP nationwide encounters (state + area-of-responsibility files) | `area_stats` (`cbp`; state/border region/nation/citizenship monthly; Border Patrol vs. Field Operations; sector/field office) | — |
| `import:ice-detention` | ICE detention statistics workbooks (FY19–) | `area_stats` (`ice-detention`; nation/state/facility ADP per FY) | — |
| `import:dhs-yearbook` | DHS OHSS Yearbook of Immigration Statistics | `area_stats` (`dhs-yearbook`; LPRs 1820–, naturalizations 1907–, refugees 1980–, asylum 1990–, nonimmigrant admissions by class, removals/returns 1892–; state, country, class breakdowns) | — |
| `import:dhs-unauthorized` | DHS OHSS unauthorized immigrant population estimates (PDF, transcribed) | `area_stats` (`dhs-unauthorized`; nation 2000, 2005–2022; top countries, top states, period of entry) | — |
| `import:census-historical-nativity` | Census foreign-born population by decennial census (Working Paper 29 + Census 2000 brief, transcribed) | `area_stats` (`census-historical-nativity`; nation 1850–2000: foreign-born, share, total population) | — |
| `import:census-pep` | Census Population Estimates (V2020 + latest) | `area_stats` (`census-pep`; nation/state/county population, births, deaths, net international/domestic migration, 2011–) | — |
| `import:census-race` | Census population estimates by race, Hispanic origin and age (1990s ST-99-28 text tables, 2000s intercensal, V2020 + latest county ALLDATA/AGESEX and state ALLDATA6), cached in `.cache/census-race/` | `area_stats` (`census-pep-race`; nation/state race counts + shares 1990–, county shares 2010–; median age overall and by group, under 18, 65+). `--levels=nation,state,county` | — |
| `import:census-projections` | Census 2023 National Population Projections (np2023_d1 files) | `area_stats` (`census-projections`; nation 2022–2100 population, race shares to 2060, median age; low/high/zero-immigration scenarios; majority-minority year) | — |
| `import:acs-ancestry` | Census ACS 1-year ancestry (B04006) and Hispanic origin (B03001), matched by label | `area_stats` (`census-acs1-ancestry`; nation/state 2010–, share + count per group) | `CENSUS_API_KEY` |
| `import:gallup-lgbt` | Gallup annual LGBTQ+ identification release (`--url=` for a newer one) | `area_stats` (`gallup-lgbt`; nation 2012–, identities 2020–, latest year by age/gender/race/party/place as geo_level `group`) | — |
| `import:gss` | NORC General Social Survey cumulative Stata file (`--file=` for a downloaded .zip/.dta; read with `scripts/lib/stata.mjs`) | `area_stats` (`gss`; ~90 attitude items as weighted percents, nation 1972–2024 + by party/ideology/race/sex/age/education as geo_level `group`; items in `scripts/lib/gss-items.mjs`) | — |
| `import:gallup-confidence` | Gallup confidence-in-institutions trend tables (read with `scripts/lib/gallup.mjs`) | `area_stats` (`gallup-confidence`; nation 1973–: "great deal/quite a lot" and "very little" for 17 institutions) | — |
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
| `import:guns` | CDC NCHS injury mortality (data.cdc.gov nt65-c7a7, 1999–2016) + Gallup gun trend tables + FBI NICS background checks + NCHS quarterly provisional mortality (489q-934x) + Pew's 2023 gun-owner survey | `area_stats` (`cdc-injury-mortality`: firearm deaths by intent, crude rates, rates by age group; `gallup-guns`: gun in home, ownership, opinion on gun laws, 1959–; `fbi-nics`: annual checks by state and type 1999– and national monthly 1998–, from FBI's PDFs plus the BuzzFeed News transcription before 2016/2022; `cdc-quarterly-mortality`: firearm death rates by age group and sex per calendar year; `pew-guns`: ownership by group and reasons, transcribed). `--only=cdc,gallup,nics,cdcq,pew`. Gallup's CDN sometimes serves the page without tables; the importer retries. FBI's newer PDF pages drop spaces in state names and merge cells; the parser handles both | — |
| `build:guns` | RAND State Firearm Law Database 6.0 (laws through Sept 2025, ODbL) + Appendix B of RAND's *The Science of Gun Policy*, 5th ed. (2026) | Files, not tables: `public/data/guns/laws.json` (each state's category per policy in `src/lib/guns/policies.ts`), `states/<ST>.json` (every record with citation, dates, statute text), `studies.json` (669 effect estimates). Downloads cached in `.cache/guns`. RAND's policy × outcome ratings (Table S.1) are transcribed in `src/lib/guns/evidence.ts` | — |
| `import:naep` | NAEP Data Service API | `area_stats` (`naep`: grade 4/8 math and reading average scores and % at or above Proficient, national public + every state; math 1996–, reading 1998–, accommodated samples only) | — |
| `import:climate` | Our World in Data `co2-data` and `energy-data` CSVs (GitHub) + NOAA Climate at a Glance JSON | `area_stats` (`owid-energy`: CO₂ totals, per person, global share 1950–, electricity mix by source 1985–, for the U.S., 9 other emitters and the world; `noaa-climate`: annual average temperature, contiguous U.S. and 49 states, 1895–). `--only=owid,noaa` | — |
| `import:emissions` | EPA state GHG inventory workbook (`--epa-url=` for a newer release) + Our World in Data co2-data CSV. `--only=epa,owid` | `area_stats` (`epa-ghg`: nation/state 1990–, gross/net, by economic sector and gas, Mt CO₂e; `owid-co2`: every country + world 1850–, CO₂ totals/per capita/consumption/cumulative/by fuel, methane, N₂O, total GHG, share of warming) | — |
| `import:eavs` | EAC EAVS (`--year=` 2016, 2018, 2020, 2022, 2024; per-year item-code maps checked against each year's variable labels) | `area_stats` (`eavs`; jurisdiction/county/state) | — |
| `import:eavs-policy` | EAC Election Administration Policy Survey Stata files, 2018–2024 (items matched by variable label; `--year=`) | `area_stats` (`eavs-policy`; state 1/0: voter ID, photo ID, same-day/online/automatic/pre-registration, mail excuse, permanent absentee, all-mail, drop boxes, curing, vote centers) | — |
| `import:cps-voting` | Census CPS November Voting and Registration Supplement, 2020–2024 (public-use microdata) | `area_stats` (`cps-voting`; nation/state; citizens, registered, voted by age, race, sex, education, income, voting method) | — |

## Elections and pilot imports

| Script | Source | Table | Key needed |
|---|---|---|---|
| `import:elections` | MIT Election Lab President and Senate returns committed in `data/elections/` (2000– by default; `-- --cycles=1976-2024`, `-- --offices=president`, `-- --all-candidates`) | `elections`, `candidacies`; politician entities for candidates it can't match. Ambiguous name matches go to `backups/<ts>/election-import-report.json` and are skipped, never guessed. House needs its source file placed by hand (`data/elections/SOURCES.md`) | — |
| `import:county-results` | Two-party county presidential returns (2020, 2024) committed as `data/elections/tonmcg-*` | `election_results`, keyed by county FIPS so the `/elections/<id>` choropleth joins directly; run after `import:elections` | — |
| `import:race-ratings -- --year=2026` | `data/elections/<year>-ratings.csv`, transcribed from Sabato's Crystal Ball; seats missing from the file get an inferred safe rating for the holding party | `race_ratings` (history: a newer snapshot appends) | — |
| `sync:ga-results` | Georgia Secretary of State results feed | the `tracked_*` close-races tables (see docs/elections/ga-close-races.md) | — |
| `import:fec-donors` | OpenFEC, for a pilot set of politicians | `contributions` (PAC/committee money with donor geography, employer and a heuristic industry from `src/lib/money/industries.ts`); `-- --refresh` re-stamps those columns on existing rows | `FEC_API_KEY` recommended (`DEMO_KEY` allows 40 requests/hour) |

## Hand entry and the ingest API

Both go through the same Zod schemas (`src/lib/validation/`) as the importers.

- **By hand:** `/data` in the app has forms for entities, relationships, claims,
  sources, bills, contributions and elections (editor role required).
- **Programmatically:** `POST /api/ingest/batch` with
  `Authorization: Bearer <INGEST_API_KEY>` takes any mix of `entities`,
  `sources`, `edges`, `claims`, `elections` and `candidacies` arrays in one
  request. Give an item a `clientId` and reference it from a later item as
  `"$ref:<clientId>"` to link records created in the same call. `elections`
  and `candidacies` items with an `externalId` are idempotent upserts on it.
  See `src/lib/ingest/batch.ts`.

## Catalog

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
