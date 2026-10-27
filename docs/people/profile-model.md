# People profile model

The records behind Subpoena case files (`/subpoena/[slug]`; old `/people/[slug]` URLs redirect). Peter Thiel (`data/profiles/peter-thiel.json`) is the reference profile. The [profile guide](./profile-guide.md) covers research, writing, review and import.

## Model

One rule: **a fact that can be reused is a row, and every row points at its sources.** Prose cites sources by key; it never stores a number or relationship that exists only in the paragraph.

| Record | Table | Notes |
|---|---|---|
| Person / identity | `entities`, `entity_identifiers` | unchanged |
| Editorial layer | `entity_profiles` | summary, roles (each sourced), biography chapters, ideas (traditions, influences, works, featured quotes), coverage notes, editorial review and source-check dates |
| Reference facts | `entity_facts` | birth, citizenship, education, roles, net worth with `as_of` |
| Relationships | `entity_edges` + `status`, `prominence` | type from `src/lib/relationships.ts` (now includes `invested-in`, `collaborated-with`), role, dates |
| Events | `entity_events`, `entity_event_participants` | partial dates, category, significance 1–3, biography chapter, `verified / disputed / unresolved` with a note |
| Statements | `claims` + `claim_key`, `issue`, `stance_kind`, `summary`, `date_precision` | `explicit` (own words), `reported` (relayed by others), `interpretation` (editorial). Empty `quote` = paraphrase |
| Contributions | `contributions` + `receipt_type`, `memo_code`, `cycle`, `committee_id`, `recipient_kind`, `recipient_party` | FEC Schedule A. Memo lines (`memo_code = 'X'`) are excluded from every total |
| Outside spending | `money_flows` (existing FEC Schedule E totals) | read from both sides: the donor's funded committees, and the candidate's races |
| Sources | `sources` + `source_key`, `author`, `document_id`, `accessed_at`, `repeats_source_key` | a syndicated copy names what it repeats and is never counted as independent confirmation |
| Evidence | `record_evidence (record_type, record_id, source_id, relation, locator)` | `supports / disputes / context` for facts, events, edges and claims |

Migration: `supabase/sql/2026-10-20-profile-records.sql`, mirrored in `src/lib/db/schema.ts`.

### One record, every interface

`loadProfileBundle()` (`src/lib/db/profile-records.ts`) loads everything for an entity in a handful of queries, cached per request and shared by the layout and the open tab. The same rows feed:

- Thiel's Money tab and the Overview's key dates (gifts of $5M+ per recipient and cycle are built from the rows, not written as events).
- Vance's Money tab ("Outside spending in JD Vance's races": Protect Ohio Values PAC, $14.7M, funded by Peter Thiel, $15M).
- Events Thiel's dossier lists with participants appear on the participants' timelines, prefixed with the actor ("Peter Thiel: Trump picks JD Vance as his running mate").
- Every total on the site: `countedContribution` in `src/lib/db/contributions.ts` and `moneyOverview.ts` exclude memo lines.

## Tabs and availability

Four tabs: `/subpoena/[slug]` (Overview), `/biography`, `/money`, `/quotes`, inside Subpoena's tool shell. Each is its own ISR route, so tab links are real URLs with no query variants. A tab without data returns 404 and is absent from the nav (`availableTabs`, `src/lib/people/profile-modules.ts`):

| Tab | Shown when | Contents |
|---|---|---|
| Overview | always | biography chapter list, political-money preview, key relationships (list, no graph), quote preview, key dates (defining events plus $5M+ gifts), elections and legislative record for officials, reference facts not already in the hero |
| Biography | dossier chapters, legacy `metadata.profile.sections`, or `entities.biography` | chapters with no inline markers; a plain source list closes each chapter; a collapsed "All sources" list at the end |
| Money | counted gifts given, contributions received, or outside spending in the person's races | cycle chart, recipient types, largest recipients, funded committees' spending, candidates backed, every contribution, outside spending (candidates), companies and investments, wealth estimate, lobbying |
| Quotes | at least one quote | traditions row (Atlas links), quotes grouped by topic with venue, date and linked source (non-verbatim ones labelled), writings |

Quotes are checked against their source before they are added. An important quote whose exact wording can't be confirmed is still included, marked `verbatim: false` and labelled "Not verbatim" (see the [profile guide](./profile-guide.md)). There is one model for every entity type, not one per type.

## FEC identity matching

Schedule A name search is fuzzy. `finance.fec` sets `namePattern`, `employerPattern` and `cities`; a row counts only if the name matches exactly and the employer or city matches. Each row stores its basis (`Identity match: employer|city`), and the transactions table marks address-only matches. For Thiel: 544 search rows, 371 matched, 186 counted lines (excluding memos), $50,752,542.

## Profiles without a dossier

A profile with no dossier reads `metadata.profile` (sections, facts), Wikidata traits (birth, religion; current affiliations only), edges and highlights. Highlights become unsourced timeline entries, labelled as such. Dossiers are written as JSON in `data/profiles/` and loaded with `npm run import:profile`; there is no editor UI.
