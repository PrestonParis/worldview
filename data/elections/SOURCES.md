# Election data sources

`scripts/import-elections.mjs` reads the files in this directory. They come
from the **MIT Election Data + Science Lab (MEDSL)** on the Harvard Dataverse.
MEDSL data is released under a Creative Commons licence — cite it as:

> MIT Election Data and Science Lab, *<dataset title>*, Harvard Dataverse.

## Committed files

| File | Dataset | DOI | Dataverse file id | Retrieved |
|---|---|---|---|---|
| `1976-2024-president.csv` | U.S. President 1976–2024 (state-level) | [10.7910/DVN/42MVDX](https://doi.org/10.7910/DVN/42MVDX) | 13887042 | 2026-09-07 |
| `1976-2024-senate-state.tab` | U.S. Senate statewide 1976–2024 | [10.7910/DVN/PEJ5QU](https://doi.org/10.7910/DVN/PEJ5QU) | 13887039 | 2026-09-07 |

`scripts/import-elections.mjs` sniffs the delimiter per file (the president file
is CSV, the Senate file is TSV) and only reads general-election, `mode = TOTAL`
rows.

### County-level presidential returns — `scripts/import-county-results.mjs`

| File | Source | Licence | Retrieved |
|---|---|---|---|
| `tonmcg-county-president-2024.csv` | [tonmcg/US_County_Level_Election_Results_08-24](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) | MIT | 2026-09-08 |
| `tonmcg-county-president-2020.csv` | same repo | MIT | 2026-09-08 |

Two-party only (`votes_gop` / `votes_dem`), keyed by 5-digit county FIPS. The
importer attaches these to the state-level `medsl:president:<year>:<ST>`
elections, so run `import:elections` first. Alaska reports by state-house
district, not county, so its rows don't match the county map and are skipped.

For older cycles (2016 and back) the MEDSL `countypres_2000-2024.tab`
([10.7910/DVN/VOQCHQ](https://doi.org/10.7910/DVN/VOQCHQ)) is the better source,
but it's guestbook-gated — download it by hand and add a branch to the importer.

### County polygons — `public/data/us-counties.geojson`

Census cartographic-boundary counties (500k), redistributed by the
[plotly/datasets](https://github.com/plotly/datasets) project as one GeoJSON
FeatureCollection with each feature's `id` set to the 5-digit FIPS — the same key
the result rows use, so the choropleth joins with no lookup table. ~3 MB,
committed (comparable to the existing `public/data/countries.geojson`).

### 2026 results while the count runs — `scripts/sync-race-results.mjs`

Fetched live, nothing committed. Run `npm run sync:wiki-races` first so the
nominee rows are current, then `npm run sync:race-results`.

| Source | Supplies | Notes |
|---|---|---|
| New York Times results JSON, `static01.nyt.com/elections-assets/pages/data/2026-11-03/results-{senate,governor,house}.json` | Votes, percent counted, race calls, flips | Undocumented. Votes are AP's; most calls are AP's and a few are the NYT's own (`outcome.called_by`). Credited on the page. |
| Wikipedia overview pages | Winner marks (`{{aye}}`), "gain"/"hold" wording, candidate lists | Vote boxes were empty when this was built. |

**Call rule.** Only the feed can call a race. Wikipedia naming another winner
blocks the call, and a Wikipedia-only call is logged but not shown.

**Flips.** The feed's `gained` is null in states with redrawn maps (CA, FL, NC,
OH, TX and others), so its flip count runs low; the sync falls back to
Wikipedia's wording for those seats.

**Party totals.** The feed credits a party with uncalled seats where only that
party is left, such as California's same-party generals. The site counts called
races only, so its House totals can sit a few below the feed's.

Certified state or MEDSL returns replace these rows when they are published.

## Not committed — download by hand

**U.S. House 1976–2024** — [10.7910/DVN/IG0UN2](https://doi.org/10.7910/DVN/IG0UN2),
file `1976-2024-house.tab` (id 13592823, ~4 MB). Dataverse requires a guestbook
acknowledgement for this file, so it can't be fetched automatically. Download it
from the dataset page and save it here as `1976-2024-house.tab`, then run
`npm run import:elections -- --offices=house`.

**Governor** — MEDSL's gubernatorial returns are split across per-state datasets
rather than one national file, so there's no single drop-in yet. When a
consolidated file is available, add an entry to `OFFICE_SOURCES` in the importer
(office `"Governor"`, level `"state"`) and drop the file here.

## County-level returns (Phase 3)

`countypres_2000-2024.tab` — [10.7910/DVN/VOQCHQ](https://doi.org/10.7910/DVN/VOQCHQ)
(~10 MB). Not used yet; Phase 3 (the choropleth map) will fetch it to
`data/elections/cache/` and load it into `election_results`.

## Boundaries (Phase 3)

County and district polygons will come from the U.S. Census TIGER/Line
shapefiles, simplified with `mapshaper`. Not committed yet.
