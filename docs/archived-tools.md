# Archived tools

Worldview is organized around five tool categories: **People & Power**,
**Legislation & Courts**, **Money & Influence**, **Elections & Maps**, and
**Geography**. Anything outside those has been removed from `main` and preserved on
the **`archive/legacy-tools`** branch (`git show archive/legacy-tools`).

## What was removed (de-bloat, 2026-09-06)

| Route | Was | Why archived |
|---|---|---|
| `/statements` | Statement & position history, quote/phrase provenance, rhetoric tracker | Never got past reusing the People graph view; no dedicated data model. Position history now lives implicitly in `claims.position_classification`. |
| `/fact-check` | Claim verdict workbench, argument maps, "can they do that" | Cosmetic workbench only. The `claims` verdict columns and `setClaimVerdict*` code that backed it were removed with it (columns still exist in Postgres — drop with a `db:push` when ready). |
| `/news` | News organizer, story evolution, primary-source finder | Stub view over shared entities; no ingestion or story model behind it. |
| `/alignment` | Coalition / voting-bloc detection, agreeability, ideology mapper | Stub `position-matrix` view; the real `votes` model that would feed it is unused for now. |
| `/education` | "Guided explainers" nav entry | Placeholder — never had a route. |

Base **claims** are not archived: they still power the homepage Claim Watch, global
search, and `/data/claims` CRUD. Only the fact-check *verdict* layer went.

Also on the archive branch: `scratch-dbcheck.cjs` / `scratch-db-ukraine-wipe.cjs`,
the one-off scripts from the 2026-09-06 data-loss incident (see
`backups/2026-09-06T21-05-25/manifest.json` and the README's Backups section).

## Restoring one

```bash
git checkout archive/legacy-tools -- "src/app/(shell)/statements" "src/components/..."
```

Then re-add its entry to `src/lib/nav.ts`, `src/lib/pages-content.ts`, and
`src/lib/type-colors.ts`, and (for `/fact-check`) restore the verdict columns/code.
