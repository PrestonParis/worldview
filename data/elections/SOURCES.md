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
