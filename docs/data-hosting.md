# Data hosting

Worldview hosts statistical data from two kinds of publisher:

- **Public imports**: federal datasets pulled on a schedule by the importers in `scripts/` (docs/data-sources.md).
- **Partner datasets**: data that an approved institution (a university, research center, think tank, agency, or newsroom) pushes to the platform through the partner API.

Both land in the same place and render with the same charts, maps, and API.

## Model

| Table | Holds |
|---|---|
| `area_stats` | Every value: `(source, metric, geo_level, geoid, period) → value`, plus `unit` and `metadata` (MOE, coverage, footnotes). `source` is the dataset slug. |
| `datasets` | The catalog. One row per `area_stats.source`: title, topic, publisher, description, methodology, source URL, license, cadence, metric definitions (`metrics` jsonb: `{ <metric>: { label, unit, description? } }`), and `status`: `draft` \| `published` \| `retired`. Only `published` datasets show on the site or in the public API. |
| `data_partners` | Partner institutions. `status`: `pending` \| `approved` \| `suspended`. Only approved partners can write. |
| `partner_keys` | API keys for partners. Only the SHA-256 is stored, plus a 12-character display prefix. |

Migration: `supabase/sql/2026-10-05-data-hosting.sql`, applied by `npm run db:migrate`.

Built-in datasets are defined in `scripts/lib/catalog.mjs`. Every importer calls `registerDataset()`, and `npm run data:catalog` registers them all at once. Edit the catalog, not the table.

Geography conventions: state `geoid` = 2-digit FIPS, county = 5-digit FIPS, cd = state FIPS + district, nation = `US`. When a breakdown has no geography (country of birth, class of admission, facility), `geo_level` names the dimension and `geoid` is a slug. If the breakdown is within a place, the slug is prefixed with the place, e.g. ACS `country` rows use `06:mexico`.

## Onboarding a partner

```bash
# ENV_FILE=.env.cloud to target cloud
npm run data:partner -- add example --name="Example Policy Institute" --kind=think-tank --website=https://example.org --email=data@example.org
npm run data:partner -- approve example
npm run data:partner -- dataset example example-removals-by-state --title="Removals by state" --topic=immigration \
  --description="..." --methodology="..." --source-url=https://... --license="CC BY 4.0" --cadence=Annual
npm run data:partner -- key example --label="ETL server"     # prints the key once; send it securely
# partner pushes data; review it at /api/data/v1/datasets/<slug>/observations after publishing, or in the DB
npm run data:partner -- publish example-removals-by-state
npm run data:partner -- list
```

Revoke a key with `revoke-key <prefix>`; cut off a partner with `suspend <partner>`; take a dataset down with `unpublish` (back to draft) or `retire` (also blocks writes). Partner dataset slugs must start with the partner slug, so they can never overwrite a built-in source.

`/datasets/publish` is the public guide. Set `DATA_PARTNERS_CONTACT` to show a "Request access" button there.

## Partner API

`POST /api/data/v1/datasets/{slug}/observations` with `Authorization: Bearer wvp_...`

```json
{
  "metrics": { "removals": { "label": "Removals", "unit": "people", "description": "..." } },
  "observations": [
    { "metric": "removals", "geoLevel": "state", "geoid": "48", "period": "FY2025", "value": 4567, "metadata": { "moe": 89 } }
  ]
}
```

- Up to 10,000 observations per request. Re-sending the same `(metric, geoLevel, geoid, period)` replaces the value.
- Validation is all-or-nothing (422 with per-row issues). Each metric must be defined, either in this request's `metrics` or in an earlier one.
- `period`: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, `YYYY-Qn`, or `FYYYYY`.
- Known geography levels are format-checked (`state` = 2 digits, `county` = 5, etc.). Other levels accept any code.
- Every accepted push is logged in `sync_runs` as `partner:<slug>`.

Errors: 401 bad or revoked key · 403 partner not approved, or the dataset isn't theirs · 409 dataset retired · 422 validation.

## Public read API

No key needed.

- `GET /api/data/v1/datasets[?topic=immigration]`: the catalog, with coverage
- `GET /api/data/v1/datasets/{slug}`: metadata, metric definitions, coverage
- `GET /api/data/v1/datasets/{slug}/observations?metric=&geoLevel=&geoid=&from=&to=&limit=&offset=`: values, oldest first. `from`/`to` take period strings and match periods that start within that range. `limit` max 10,000; follow `next`.

## Not built yet

- Self-serve application form and an admin UI for partners (the CLI covers it for now).
- Per-partner rate limits.
- File upload (CSV) as an alternative to the JSON API.
