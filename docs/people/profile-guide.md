# Political person profile research and writing guide

This is the working plan for researching, writing, reviewing, importing and maintaining Worldview profiles of people with political influence: elected officials, candidates, donors, advisers, appointees, judges, activists, executives, media figures and intellectuals whose money, institutions, ideas or relationships affect public life.

Peter Thiel is the reference implementation:

- dossier: `data/profiles/peter-thiel.json`
- profile: `/subpoena/peter-thiel-8eefc9bc` (Overview), plus `/biography`, `/money` and `/quotes`
- data model and tab rules: [profile-model.md](./profile-model.md)
- importer: `scripts/import-profile.mjs`

The goal is not a long biography assembled from search results. It is one sourced record of the person that answers, without exaggeration:

1. Who is this person?
2. What did they do, and when?
3. Where do their money and institutional power come from?
4. How have they used that power in politics?
5. Which people and organizations connect them to public outcomes?
6. What ideas have they stated in their own words?
7. Why are they relevant now?
8. What is known, disputed, reported by others or still unknown?

## 1. Editorial standard

A finished profile must be:

- **Structured.** Reusable facts, relationships, events, statements and transactions are records, not facts trapped in prose.
- **Sourced.** Every consequential claim resolves to evidence. A source attached somewhere else on the page does not count.
- **Subject-centered.** It distinguishes what the person did from what an associate, company, campaign or government later did.
- **Chronological and causal.** It explains how one stage created the conditions for the next, without claiming causation the evidence does not support.
- **Current.** The latest political activity, office, financial disclosure and institutional role get a fresh-source check before publication.
- **Proportionate.** Public importance determines space. A profile is not a résumé, a list of every investment or a catalog of private-life trivia.
- **Explicit about uncertainty.** Conflicting dates and accounts are shown as unresolved or disputed instead of silently picking the convenient version.
- **Neutral in voice, not empty of context.** Consequences and criticism are described with attribution, never with praise, insinuation or rhetorical labels.

The page must not infer race, religion, sexuality, ideology or ancestry from a name, photograph, birthplace, spouse, associates or donations. Religion appears only when it is self-described or independently documented and bears on public ideas or conduct. Sex, race and the other core attributes are recorded from documented evidence, with the basis in `detail` (§7, Core attributes). Ideology comes from first-person statements or the Atlas, never from the candidates a person funds.

## 2. Every profile is a full profile

The Thiel dossier is the bar for every person on Worldview, whether they are a billionaire donor, a cabinet secretary or a first-time candidate. There is no lighter version of a profile.

For reference, the Thiel dossier has 36 sources, 6 facts, 21 relationships, 32 events, 11 statements and 8 chapters, plus 371 matched FEC rows. These are not quotas; they show the depth a finished profile reaches.

- **A thin public record means more research, not a smaller profile.** Go further into the record: local and regional press archives, state campaign-finance and business filings, court dockets, archived campaign and company sites (Wayback Machine), school and alumni publications, local TV and podcast interviews, testimony and public-meeting minutes.
- **Detail comes from records, not filler.** Background on the office, district, party or industry is not a substitute for facts about the person.
- **A profile can be built in phases.** Records can be imported before the chapters are written, and a profile can go live with some tabs still empty (tabs with no data are hidden by `availableTabs` in `src/lib/people/profile-modules.ts`). It is not finished until it meets every item in §11.

## 3. Production workflow

Every profile moves through the same stages.

| Stage | Output | Done when |
|---|---|---|
| 1. Brief | `brief` block in the dossier (§4) | identity resolved and inclusion sentence written |
| 2. Sources | `sources` ledger | every research pass in §5 has been run, including the contradictions and criticism pass |
| 3. Records | `entities`, `facts`, `roles`, `relationships`, `events`, `statements`, `finance`, `ideas` | `--dry-run` passes |
| 4. Chapters | `summary`, `chapters` | prose cites every paragraph and adds no fact that lacks a record where a record type exists |
| 5. Review | four separate reviews (§9) | each review is recorded in the brief's `review` list |
| 6. Import | local import, then cloud | rendered totals match the records (§10) |
| 7. Retire legacy | the person's legacy `biography`, `highlights` and `metadata.profile` in the collection file are cut back to identity fields | only one version of the profile exists |

Work one person per branch or commit so a dossier can be reviewed as a unit. A dossier that fails review stays in the repository but is not imported to the cloud.

## 4. The research brief

Write the brief before opening sources, and store it in the dossier as a `brief` block. The importer ignores it, so it stays an internal working record and is never rendered.

```json
"brief": {
  "inclusion": "One sentence naming the form of power, e.g. the largest individual funder of a party's Senate candidates since 2016.",
  "identifiers": { "wikidata": "Q…", "fec_contributor": "LAST, FIRST", "bioguide": "…" },
  "namesakes": "Who else shares the name in public records, and the fact that tells them apart",
  "coverage": { "from": "YYYY", "through": "YYYY-MM-DD", "lags": "Reporting not yet available, e.g. the latest FEC quarter" },
  "openQuestions": ["Example: board start date, 2004 in one source vs 2005 in the company's disclosure"],
  "review": [{ "kind": "evidence", "by": "<initials>", "at": "YYYY-MM-DD" }]
}
```

### Identity

- canonical name and common aliases
- existing Worldview entity and public slug (`<name>-<first 8 characters of the entity id>`)
- stable identifiers: Wikidata, Bioguide, FEC candidate or committee IDs, SEC CIK, court identifiers, official website
- likely namesakes and the facts that distinguish them
- places, employers or occupations needed to disambiguate public records

Never create a second person because a source uses a shortened name. Resolve the existing entity first. In the dossier, the subject should use `match`; prefer `match.identifier` when one exists (Vance matches on `["fec_candidate", "S2OH00436"]`).

### Reason for inclusion

One sentence naming the form of power involved: elected authority, appointments, political giving, party organization, litigation, ownership, government contracting, media reach or intellectual influence. It is a research scope, not page copy, and it keeps a profile from becoming a collection of whatever facts were easiest to find.

### Coverage period

Set the earliest period that explains the person's formation or entry into public life, the date through which politics, money, office and major roles are checked, and any known reporting lag. Keep `reviewedAt`, `sourcesVerifiedAt` and `finance.coverage` separate. Import time is not an editorial review date.

## 5. Sources and research passes

Research by claim area, not by reading one biography from top to bottom. Start the source ledger immediately.

### Source hierarchy

1. **Primary and official records:** legislation, votes, government biographies and appointment notices; FEC filings, financial disclosures and state campaign-finance records; SEC filings, corporate reports and court records; contracts, nonprofit filings (990s) and business records; books, essays, speeches, interviews, testimony and official statements by the subject.
2. **Independent reporting:** original reporting with named authors, dates and transparent corrections; investigations that explain records a reader could not reconstruct.
3. **Institutional biographies:** employer, campaign, university, board and foundation biographies. These are good for roles and dates, but they are not independent evidence of disputed accomplishments.
4. **Reference sources:** Wikidata, encyclopedias and directories. Use them for discovery and basic cross-checks, and replace them for consequential claims whenever possible.

Search snippets, AI summaries, social posts that repeat reporting and unsourced aggregator profiles are leads, not evidence.

### Source records

| Field | Required | Notes |
|---|---|---|
| `key` | yes | stable and readable: `<publisher>-<topic>-<year>`, e.g. `forbes-gawker-2016`, `fec-sa-thiel`, `cato-2009` |
| `title` | yes | exact title |
| `publisher`, `author`, `publishedAt` | when known | `publishedAt` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD` |
| `type` | yes | one of `primary`, `secondary`, `transcript`, `article`, `filing`, `video`, `official_statement` |
| `url` or `documentId` | one is required | `documentId` for filings and court records without a stable URL |
| `repeats` | when syndicated | key of the original; a repeat is never independent confirmation |
| `accessedAt` | optional | defaults to `sourcesVerifiedAt` |
| `notes` | when limited | paywall, partial transcript, unnamed sourcing, missing date, inaccessible underlying record |

The claims a source supports are not a field; they come from the citations on records and chapters. Two URLs carrying the same wire story are one line of evidence.

### Common research passes

Run a separate pass for each area that applies:

| Area | Questions to answer |
|---|---|
| Identity and background | Birth, citizenship, education, formative institutions and pre-public career. Which facts explain later activity? |
| Offices and roles | What does the person hold now? When did each role begin and end? Is the title formal, informal or self-described? |
| Career and wealth | Which companies, funds, inheritances, transactions or holdings created their resources? Which estimates need an as-of date? |
| Electoral politics | Candidacies, endorsements, campaign roles, transition work, appointments and party activity. What did the subject personally do? |
| Political money | Direct contributions, super PAC funding, joint fundraising, state giving, nonprofits and disclosed in-kind support. What falls outside the dataset? |
| Institutions and policy | Companies, foundations, think tanks, media outlets, litigation, lobbying or contracts through which the person exercises influence. |
| Network | Mentors, protégés, employers, partners, appointees, recipients, co-authors and adversaries. What is the evidenced relationship, and when? |
| Ideas | Important works, recurring claims, changes in position, acknowledged influences and exact statements in context. |
| Legal and controversy | Charges, judgments, settlements, investigations and documented disputes. What was alleged, decided, appealed or left unresolved? |
| Personal information | Only public facts that explain political identity, legal status, a public controversy or the person's own stated worldview. |
| Present relevance | What changed in the current and previous election cycles? What would make the profile stale tomorrow? |

End with a dedicated search for corrections, contradictions and critical accounts. A profile researched only from the subject's own institutions inherits their omissions.

### Additional passes by type of person

Most people fit more than one row. Run every row that applies.

| Type | Additional passes | Primary sources |
|---|---|---|
| **Donor** | FEC identity rule (§7, Political money); super PACs the person funded and what those PACs spent (Schedule E); state giving in the person's home state; foundations and donor-advised funds (990s); ownership of media or political organizations | FEC API, state campaign-finance portals, ProPublica Nonprofit Explorer, OpenSecrets for cross-checks |
| **Elected official** | Offices and terms; committee assignments and leadership posts; signature legislation, key votes and reversals; election results and margins; leadership PAC; staff who went on to power; disclosed personal finances | Bioguide, Congress.gov, the Clerk and Senate roll calls, FEC candidate and committee pages, House and Senate financial disclosures, state legislature sites |
| **Candidate** | Campaign committee, principal donors, endorsements, prior offices or careers, stated platform, primary and general results | FEC candidate pages, state election offices, campaign site (archived), debate transcripts |
| **Appointee or executive-branch official** | Nomination, hearing and confirmation dates; testimony; prior industry roles and recusals; ethics agreements and OGE 278 disclosures; actions taken in office | Congress.gov nominations, committee hearing records, OGE disclosures, Federal Register, agency press releases |
| **Judge** | Appointing president, confirmation vote, prior roles, notable majority opinions and dissents (quote opinions as statements), financial disclosure and recusal issues | Federal Judicial Center, court opinions, Senate Judiciary records, judicial financial disclosures |
| **Adviser, operative or lobbyist** | Clients and campaigns worked on, firms, registrations, payments from committees (FEC disbursements to their firm) | LDA lobbying disclosures, FARA, FEC Schedule B, firm sites |
| **Media figure** | Outlets, shows and audience figures with as-of dates; ownership; guest relationships that matter politically; notable broadcasts quoted from transcripts | network transcripts, ratings reports, archived episodes |
| **Intellectual or activist** | Major works and their reception, organizations founded or led, students and followers in government, changes in position | the works themselves, publisher records, institutional pages, reviews |
| **Company or organization** (when profiled as the subject) | Ownership and control, lobbying spending, PAC, government contracts, regulatory actions | LDA, FEC, USAspending, SEC, agency enforcement records |

### Researching with AI agents

Agents are useful for finding leads, pulling public records and drafting worksheets. They are not a source.

- An agent can search, list candidate sources, fetch FEC and Congress.gov data, and propose events and relationships with the URLs it found.
- A person (or a separate verification pass) opens every URL before it enters `sources`, and confirms that the page supports the exact claim.
- Copy quotations only from the underlying text, transcript or recording. Never take a quote from a model's output, a search snippet or another outlet's paraphrase.
- Record a lead an agent could not verify under `brief.openQuestions`, not as a source.
- Run the research passes as separate tasks. One "research this person" request produces an unbalanced profile that leans on whatever was easiest to find.

## 6. Make the chronology before the prose

Build the events list before drafting chapters. Missing decades, unsupported transitions and false causal jumps are easier to find in a chronology than in polished prose.

Each event has:

- `date`: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, preserving the source's precision; `date_end` for spans
- `title`: neutral, beginning with the action or outcome
- `summary`: one or two sentences on what changed and why the event belongs
- `category`: `career`, `finance`, `politics`, `ideas`, `legal` or `personal`
- `significance`: 3 (defining), 2 (notable) or 1 (supporting)
- `status`: `verified`, `disputed` or `unresolved`, with `statusNote` for the last two
- `participants`: `[entityKey, role]` pairs
- `sources` and `chapter`

### Selection rules

- An event must change the person's role, resources, public position, network or consequences.
- Do not add an associate's achievement unless it explains the subject's influence, and say how in the summary.
- Record announcements and completed outcomes separately when both matter. An announced plan must not read as a completed fact.
- Resolve predictions and reported intentions after the election, appointment or transaction they concerned.
- A display threshold is not an editorial rule. A sub-$1 million gift can matter more than a larger routine one if it marks a return to politics, a new recipient or a reversal.
- Do not hand-write events for routine gifts. The Overview builds key dates from contributions of $5M or more per recipient and cycle. Write an event only for a gift with a story the rows cannot tell.
- Give major institutional milestones their own events when they materially change the subject's wealth or power, and title them as company events when the subject did not personally act.
- The publication date of an investigation is not the date of the conduct. When both matter, write a conduct event and a disclosure event.
- Check every decade and every transition between chapters. An empty period can be accurate, but it should be deliberate.
- Run a final current-year pass. A profile reviewed this year should not end its chronology in a previous year without a reason.

The Thiel profile shows why: raw FEC rows accurately show large gifts, but they do not explain the formation of the Thiel–Vance relationship, Palantir's part in his present power, how his wealth was built, or the gap between a 2023 reported intention and later giving.

## 7. The dossier

`data/profiles/<slug>.json` is the canonical editorial source, not an export from prose. The importer validates before touching the database: every citation must resolve to a source, every relationship and event needs evidence, every participant must be a declared entity, and every `relType` must exist in `src/lib/relationships.ts`.

### Field reference

| Key | Shape | Notes |
|---|---|---|
| `subject` | entity key | must be a key in `entities` |
| `reviewedAt`, `sourcesVerifiedAt` | `YYYY-MM-DD` | editorial review and last full source check |
| `brief` | object | internal only, not imported (§4) |
| `summary` | string | two or three sentences (§8) |
| `roles` | `[{ label, detail, sources }]` | four to six at most |
| `entities` | `{ key: { match } \| { create } }` | `match: { identifier: [scheme, value] }` or `match: { name, type }`; `create: { name, type, description, websiteUrl }`. Matching runs first, so re-runs never duplicate |
| `sources` | see §5 | |
| `facts` | `[{ key, label, value, detail, asOf, featured, sources }]` | `featured` facts appear in the hero |
| `relationships` | `[{ key, source, target, relType, role, from, until, status, prominence, notes, sources }]` | `source`/`target` are entity keys (direction runs source → target); `from`/`until` are dates; a relationship with no `until` reads as current; `prominence` 0–3 |
| `events` | see §6 | |
| `statements` | `[{ key, date, datePrecision, venue, issue, quote, summary, stance, source }]` | `stance` defaults to `explicit`; `issue` groups quotes on the Quotes tab |
| `finance` | `{ fec: { contributorName, namePattern, employerPattern, cities, source }, coverage }` | `coverage` is the text shown with the Money data |
| `ideas` | `{ traditions, influences, works, featuredQuotes }` | traditions: `{ label, atlasId, basis, context, sources }`; influences: `{ name, note, sources }`; works: `{ title, year, kind, detail, source }`; `featuredQuotes` are statement keys |
| `chapters` | `[{ key, title, dek, body }]` | Markdown with `[[source-key]]` or `[[key-a, key-b]]` citations and `> ` quote blocks |

### What goes where

| Record | Put here | Not only in prose |
|---|---|---|
| `entities` | the subject and every person or organization used by an event or relationship | an unnamed "network" that cannot be linked |
| `sources` | the complete ledger | bare URLs at the end of a chapter |
| `facts` | stable reference facts and dated estimates | current roles, citizenship or net worth mentioned only in a paragraph |
| `relationships` | directed connection, role, dates, status and evidence | "close to," "linked to" or "part of the network" |
| `events` | the selected chronology | a list of dates copied into highlights |
| `statements` | exact quotations and attributed paraphrases | ideology inferred from friends, donations or party labels |
| `finance` | identity matching and coverage limits | a total with no definition |
| `roles` | concise current or defining functions | promotional titles unsupported outside a biography |
| `chapters` | narrative synthesis | new facts with no record where a record type exists |
| `ideas` | traditions, influences, works and changes in position | a broad label with no stated basis |

### Facts

- Store birth date, not age; age is derived.
- Net worth and similar estimates need a named estimator in `detail` and an `asOf` date.
- Current roles need a current primary or institutional source.
- Citizenship, education and religion say exactly what the evidence establishes.
- Do not add a row because a generic people database usually has that field.

**Core attributes.** Every dossier records, when a source documents them: born (date and place), sex (biological sex, `Male` or `Female`), ethnicity, race, citizenship, sexual orientation, spouse, children, residence, religion, party, education, current roles and net worth (with `asOf`). Fact keys: `born`, `sex`, `ethnicity`, `race`, `citizenship`, `sexual-orientation`, `spouse`, `children`, `residence`, `religion`, `party`, `education`, `current-roles`, `net-worth`. The Overview shows them as a grouped attributes panel. Sex also sets pronouns in profile copy ("In his words"); with no male or female record, copy uses wording that needs no pronoun.

**Attribute lookups.** `npm run profile:lookup-queue -- --write` lists curated people missing core attributes (born, sex, ethnicity, race, citizenship, religion) in both their dossier and their Wikidata/Wikipedia traits, and saves the list to `data/profiles/lookup-queue.json` (gitignored). Check Wikidata (P21, P172, P27, P140, P91, P26), the Wikipedia article's categories ("of German descent", "Emigrants from West Germany") and biographies, and cite whatever source settles the value. When race isn't stated directly, determine it from the documented ethnicity or descent and give the basis in `detail` (Thiel: White, "From ethnic German descent"). Religion lists current affiliations only.

### Relationships

Relationships are records even though the interface shows them as a list with no graph. They feed the Overview's key-relationships list, participant links and counterpart timelines.

- Choose the most specific `relType` from `src/lib/relationships.ts` (`co-founded`, `board-member-of`, `invested-in`, `mentee-of`, `adviser-to`, `appointed`, `donated-to`, `opposed` and so on). If none fits, add one there; do not misuse a near match.
- Put the concrete role in `role` ("Co-founded Confinity (1998); CEO, president and chairman 2000–2002"), not a vague association.
- Set `until` for ended relationships; leaving it off asserts the relationship is current.
- Do not infer friendship, mentorship, control or ideological agreement from a donation, board seat, shared employer or event attendance.
- Put conflicting accounts in `notes`, and set `status` when the relationship itself is disputed.

### Statements and quotations

Store a statement when the person's words establish a position, change, qualification or recurring idea.

- Copy exact quotations from the underlying text, audio or transcript, and keep them short enough to preserve context and stay within copyright limits.
- Record the date, venue, issue and source.
- `stance: explicit` is the subject's own position; `reported` is a view described by another person or outlet; `interpretation` is clearly attributed analysis.
- An empty `quote` with a `summary` is a paraphrase. **Paraphrases are stored but not shown on the Quotes tab, which lists verbatim quotations only.** A profile whose positions exist only as paraphrase has no Quotes tab.
- Use the summary to supply context, not to intensify the language.
- When a later statement qualifies or reverses an earlier one, keep both and connect them in the chronology and chapters.
- Aim for 8–12 quotes per person, each checked against the original or a full transcript. Prefer primary sources and cite the primary even when a secondary copy was used to check the wording. `ideas.featuredQuotes` picks the two shown on the Overview; prefer verbatim ones.
- An important quote (widely cited, or the clearest statement of a defining view) whose exact wording can't be confirmed is still included with `"verbatim": false` and a `summary` saying where the wording comes from; the importer rejects it without one, and the page labels it "Not verbatim" (Thiel's "Capitalism and competition are opposites", WSJ, 2014). Minor quotes that can't be confirmed are left out instead.

### Political money

One dataset is not all political spending.

For FEC Schedule A:

- Set `finance.fec.contributorName` to the FEC search form (`"LAST, FIRST"`), `namePattern` to a regex for the exact name variants, `employerPattern` to the employers that appear in filings (including misspellings; Thiel's matches six spellings of Clarium), and `cities` to the subject's known filing cities.
- A row counts only if the name matches and the employer or city matches. Each row stores which test it passed.
- Memo lines (`memo_code = 'X'`) are excluded from every total.
- Before importing, dry-run with `--fec`, then check a sample of rejected rows for real gifts and a sample of matched rows for namesakes. Tighten or loosen the patterns until both samples are clean.
- `finance.coverage` states the dataset, dates and exclusions: state and local giving, nonprofits, donor-advised funds, dark-money groups, independent expenditures not attributable to the person, and gifts below reporting thresholds.
- When a news report gives a different total, reconcile the definitions instead of picking one number.

## 8. Write the page

Write only after the sources, facts, relationships, events and statements are substantially complete. The profile has four tabs; each appears only when it has data.

### Hero: summary, roles and featured facts

The summary is two or three sentences: what the person is best known for, the form of political power they exercise, the strongest concrete evidence of it, and why they are relevant now. Avoid "important," "controversial," "powerful" and "influential" unless the following words show how and according to whom.

Roles: four to six, each a plain label with a dated, concrete detail. Separate current roles from historical ones.

### Overview

Assembled from records, not written separately:

- the biography chapter list
- a political-money preview
- key relationships (by `prominence`)
- a quote preview (`ideas.featuredQuotes`)
- key dates: significance-3 events plus $5M+ gifts per recipient and cycle
- elections and the legislative record for officials, from existing data
- reference facts not already in the hero

The writing task here is choosing which events are significance 3, which relationships carry high prominence and which quotes are featured. Those choices decide what a reader sees first, so they should reflect the argument of the profile.

### Biography

Chronological-thematic chapters, usually six to ten (Thiel has eight).

A strong chapter:

1. opens with what changed;
2. names the institutions and people involved;
3. gives the decisive dates and amounts, which must match the records;
4. explains the public or political consequence;
5. attributes criticism and disputed interpretations;
6. ends where the next chapter begins;
7. cites every paragraph with `[[source-key]]` markers.

The markers are stripped when the page renders, and the cited sources are listed after each chapter, so a paragraph's sources must be specific to that chapter. A collapsed "All sources" list closes the tab.

Cover political actions and outcomes inside the chapters: offices and appointments, endorsements and campaign roles, giving and the recipients' races, transition and policy work, protégés and appointees (with evidence for the subject's role), and withdrawals and returns. Do not present a recipient's later success as the donor's achievement.

Do not repeat a claim across the summary, chapters and Overview unless each occurrence serves a distinct purpose. No "why X matters" sections.

### Money

Built from records: cycle chart, recipient types, largest recipients, funded committees' outside spending, candidates backed, every contribution, outside spending in the person's own races, companies and investments, wealth estimate and lobbying. The writer's job is the `finance.coverage` note, the identity rule, and making sure any number in prose matches a reproducible total or is labeled as an outside estimate.

### Quotes

Traditions (linked to the Atlas, each with its `basis`), verbatim quotations grouped by issue with venue, date and linked source, and works. Distinguish self-description, a direct policy or philosophical claim, reported private views, and Worldview's placement in a broader tradition. Traditions follow the key-figures rule: placement is based on stated ideas, never on office or party.

### What the page deliberately leaves out

There is no network graph, separate timeline tab, sources tab or inline citation markers; the profile stays at four tabs. Relationships, events and evidence are still recorded in full because the Overview, participant pages and Money views reuse them.

## 9. Review for fairness and accuracy

Run four reviews separately, and record each in `brief.review`. Combining them into one proofread makes omissions easier to miss.

### Evidence review

- Open every source URL.
- Confirm that each source supports the exact claim it is cited for.
- Replace Wikipedia-only support for major events where possible.
- Confirm quotations word for word, with meaningful context.
- Verify names, titles, dates, amounts and entity identities.
- Mark syndicated stories with `repeats`.
- Record contradictions as `status: "unresolved"` or `"disputed"` with a `statusNote`, instead of averaging or silently resolving them.

### Quantitative review

- Recompute totals from counted rows, confirming memo exclusions and refunds.
- Check that prose, facts, charts and transaction tables use the same definition.
- Add as-of dates to estimates and current holdings.
- Explain discrepancies between datasets and reporting.

### Editorial review

- Remove speculation and mind-reading.
- Attribute criticism, allegations and ideological labels.
- Check that detail follows public importance rather than sensationalism.
- Confirm that downstream events explain their connection to the subject.
- Look for missing formation periods, reversals and current-year developments.
- Confirm that any sensitive personal information has a clear public-interest reason to appear.

### Product review

- One canonical profile URL; old slugs redirect.
- Each available tab renders, on mobile and in dark mode; tabs without data are absent rather than empty.
- Every participant, recipient and relationship link resolves to the right entity.
- The Overview's key dates, relationships and featured quotes are the ones the editor intended.
- The Money totals match the import log.
- No browser console errors; the metadata title and canonical URL are correct.

## 10. Import, verify and roll out

### Local

```sh
npm run import:profile -- --profile=<slug> --dry-run          # validate records
npm run import:profile -- --profile=<slug> --dry-run --fec    # check FEC matching
npm run import:profile -- --profile=<slug> --fec              # write
```

`FEC_API_KEY` in `.env.local` is used automatically. Without it the importer falls back to `DEMO_KEY`, which is slow and allows about 1,000 requests an hour. `--fec-cache=<file>` saves Schedule A rows to a file on first fetch and reads them on later runs, which is useful while tuning the identity patterns. `--all` imports every dossier in `data/profiles/`.

After import:

1. Compare the import log's counts (sources, facts, relationships, events, statements, contributions, counted total) with the dry run.
2. Open the profile and each available tab, and compare the rendered totals with the log.
3. Test one source, one relationship, one quote, one money record and one unresolved record end to end.
4. Run `npm run check` if any code changed.
5. Record remaining gaps in `brief.openQuestions` or `finance.coverage`.

An importer success proves that references resolve. It does not prove that the research is complete or the writing fair.

### Cloud

1. Check the Supabase size budget first (`SUPABASE_LIMIT_MB`, 6550 MB on the Pro plan). A full profile with FEC data adds a few hundred rows plus any new committee entities, which is small, but check before batch imports.
2. Run `ENV_FILE=.env.cloud npm run import:profile -- --profile=<slug> --fec`.
3. Repeat the product review on the live site.

### Retire the legacy profile

Once a dossier is imported, cut the person's entry in the collection file (`data/political-influence-wealth.json`, `data/political-figures.json`, `data/administration.json`) back to identity fields, removing the long `biography`, `highlights` and any `metadata.profile`. Otherwise a re-run of the collection importer can bring back text the dossier replaced.

## 11. Definition of done

A profile is ready to publish when:

- [ ] identity is resolved to one canonical entity;
- [ ] the `brief` records the inclusion sentence and coverage period;
- [ ] the summary explains political relevance with concrete evidence;
- [ ] roles and reference facts are sourced, and estimates have as-of dates;
- [ ] every consequential claim has evidence;
- [ ] the biography covers formation, acquisition of resources, entry into politics and current position;
- [ ] political money, if any, has an explicit identity rule, coverage note and cutoff;
- [ ] major relationships are directional, dated where possible and sourced;
- [ ] stated ideas and quotations are distinguished from reported views and editorial placement;
- [ ] the chronology has formation, turning points, reversals, outcomes and a current-year check;
- [ ] institutional developments are tied to the subject without attributing company actions to them;
- [ ] contradictions and unresolved claims are visible;
- [ ] no sensitive attribute is inferred;
- [ ] all four reviews are recorded in `brief.review`;
- [ ] `--dry-run` passes, and the import counts match the rendered page;
- [ ] known omissions are stated rather than disguised by empty sections or zeroes;
- [ ] the legacy profile block is retired.

## 12. Maintenance

Profiles of active political figures are living records. Recheck them:

- after an election, appointment, resignation, verdict, settlement, major filing or change in company control;
- when a new FEC reporting period or financial disclosure becomes available (rerun `--fec`);
- when a reported intention can be compared with the outcome;
- when a current role or net-worth estimate is displayed prominently;
- at least once per election cycle for active donors and operators.

Each update answers three questions:

1. What changed in the structured records?
2. Which chapter sentence or event interpretation is now stale?
3. Does the new information resolve, qualify or contradict an earlier claim?

Do not move `reviewedAt` for a mechanical FEC refresh unless an editor also did the currentness and source checks.

## 13. Tooling backlog

Gaps that affect how dossiers are written. None blocks a new profile.

- **Disputing evidence.** `record_evidence.relation` allows `supports`, `disputes` and `context`, but the importer writes every citation as `supports`. Until dossiers can mark a source as disputing, contradictions live in `status` and `statusNote`.
- **Committee donors.** Outside-spending tables show "Donor records not imported" for committees whose donors are not loaded; a committee-level Schedule A importer would fill these.
- **State campaign finance.** No state importer exists, so state giving is a coverage exclusion for every donor.
- **Editor UI.** Dossiers are edited as JSON. A schema file for editor autocompletion would catch mistakes before `--dry-run`.

## 14. Lessons from the Thiel reference profile

- A rich biography is not a substitute for relationship records, events or contributions.
- A large donation total does not explain a political network; the formation of that network needs its own chronology.
- A company milestone belongs when it changes the person's wealth or power, but the page must distinguish the company's action from the person's.
- A future intention reported by unnamed sources needs a reported status and a later outcome check.
- A fixed money threshold is useful for display, not for deciding political importance.
- Quotations belong in statement records so every view can reuse the same evidence.
- "Updated today" is misleading if the research stops before the latest material developments.
- Citations attached to the wrong section are worse than none: the old Palantir section cited an AP article about a Vatican visit.
- The strongest profile is not the one with the most events. It is the one where a reader can trace resources, relationships, ideas and actions to public consequences and see the evidence for each step.
