# Data and maintenance commands

The root `package.json` is the supported command index. Commands fall into these groups:

- `infra:*` starts and inspects local Supabase and Neo4j infrastructure.
- `db:*` migrates, inspects, exports, restores and validates relational storage.
- `import:*` loads one authoritative external source. Importers should be repeatable and delegate shared behavior to `scripts/lib`.
- `data:*` builds derived geography files, checks data health and maintains the lake/catalog.
- `graph:*` synchronizes the read-only graph projection.
- `quiz:*` audits, traces and maintains quiz results.
- `auth:*` performs explicitly requested account administration.

Prefer adding behavior to an existing domain command over introducing another one-off root script. New importers should expose a dry-run or bounded mode when the source size or write volume is material.

## Curated political profiles

`data/political-figures.json` and `data/political-influence-wealth.json` hold baseline profiles (description, portrait, identifiers, highlights, sources) for people and institutions.

Full research profiles are dossiers in `data/profiles/<slug>.json`, loaded by `scripts/import-profile.mjs` into structured records: sources, facts, relationships, events, statements and the editorial layer (summary, roles, biography chapters, ideas). `data/profiles/peter-thiel.json` is the reference. [docs/people/profile-model.md](../docs/people/profile-model.md) describes the model, and [docs/people/profile-guide.md](../docs/people/profile-guide.md) covers research, writing, quotes, attributes, review and maintenance. With `--fec` the importer also pulls the subject's itemized FEC Schedule A contributions, matched by name plus employer or city.

```sh
npm run import:profile -- --profile=peter-thiel --dry-run --fec
npm run import:profile -- --profile=peter-thiel --fec
```

Baseline profiles without a dossier still load through:

```sh
node scripts/import-political-figures.mjs --dry-run --profile="Peter Thiel"
node scripts/import-political-figures.mjs --force --profile="Peter Thiel"
```
