# Political Quiz — an adaptive, US-specific ideology quiz

**Status (2026-10-01):** v1 built in the **extensive** mode, Phases 1–5. Routes are `/quiz` and
`/quiz/[slug]`. Engine and bank: `src/lib/quiz/`. Table: `quiz_sessions` (`supabase/sql/2026-10-01-quiz.sql`,
applied locally). Purge job: `.github/workflows/purge-quizzes.yml`. Phases 6–7 and other modes come later.

## Context

Existing quizzes, and what they get wrong. These are the patterns to copy or avoid:

| Quiz | Model | Keep | Avoid |
|---|---|---|---|
| 12axes | 12 axes; statements graded by intensity (±1…±4) per axis; 5 random per axis, agree/disagree | The graded-intensity statement bank | Scoring ignores the intensity: every answer is ±1 (`50 + 5·score`) |
| 8values | 4 axes; each question has a weight per axis; score = total / max; nearest hand-placed ideology | One question moving several axes | Fixed 70 questions; percentages that read as precise |
| Political Compass | 2 axes | — | 36 right-coded vs 20 left-coded items (people who tend to agree drift right); statements that make two claims at once |
| Pew Typology | 9 clusters fit on survey data; nearest group profile | Clusters fitted on real data | Forced fit: everyone gets put in a group |
| iSideWith | Issue questions + importance + "other stances" | Detailed answers per issue; importance | Long, with no underlying axes |
| smartvote / Wahl-O-Mat | Distance-based matching | Published methodology | Research shows the choice of statements changes who people get matched to |

The "smart" part comes from **computerized adaptive testing** (Montgomery & Cutler,
*Political Analysis* 2013). The engine keeps a running estimate of each axis
plus its uncertainty, asks whatever narrows that uncertainty most, and stops an
axis once it's settled. It uses two response models. Most policy statements are
**directional**: the further toward a pole you are, the more you agree. Compromise
statements are **ideal-point** (GGUM-style): people at both extremes reject them.

## Scope & definition of done

- [ ] `/quiz` landing → start → `/quiz/[hash]`, the same URL while in progress and after finishing.
- [ ] US-adapted axes (below), each reported as a position with a precision.
- [ ] Issue modules (abortion, guns, …), each reported as a structured **policy profile**:
      one stance per attribute (legality, gestational limit, exceptions, who decides, …).
- [ ] Adaptive engine: settled axes stop early, unresolved axes and issues get more
      questions, follow-ups only appear when the earlier answers leave the stance unclear. No fixed length; a
      typical run is ~100–170 questions (see *Length*).
- [ ] Every quiz is saved after each answer. Anyone can resume from the browser that
      started it.
- [ ] Signed-in users can **claim** a quiz, then set it **public** (anyone with the
      link) or **private** (owner only).
- [ ] Results: axis chart with a confidence level per axis, policy profiles, a distance-ranked match
      against every ideology in the catalog (never a percentage), and "why you landed here" for each axis.
- [ ] Finishing isn't final: after completion, any low-confidence axis offers "answer N more
      questions to refine this", appended to the same quiz.
- [ ] **Not in scope yet:** matching users to politicians or other real people.

## Design decisions taken up front

1. **Two layers: axes and issues.** Axes are the abstract ideology. Issues are the
   concrete US fights. Issue answers *also* feed the axes, so one answer does
   double duty. That's the main reason 100+ questions can still feel efficient.
2. **Branching per issue.** Each issue opens with one multiple-choice question
   that spans the whole range ("legal in all cases … illegal in all cases").
   Follow-ups are a small decision tree, and only the branches that matter for that
   answer appear. Someone who answers "illegal in all cases" isn't asked about
   trimester limits.
3. **Score each axis on its own.** One axis's answers never set another
   axis's score. Correlations between axes can later help *choose* questions,
   never *score* them, so results don't turn into stereotypes.
4. **Pure engine, pure data.** `src/lib/quiz/` holds the engine as pure TS with no I/O,
   tested like `votingRecord.ts`, plus the question bank as versioned TS data.
   Results are recomputed by replaying stored answers, so engine fixes apply to old quizzes.
5. **Store raw answers, not just results.** A quiz row stores the answer log plus
   the bank and engine versions. That allows changing an answer, recomputing
   results, and later re-fitting each question's parameters from real response data.
   Each answer also stores a `shown` snapshot (the item text, options, and response
   label as displayed), so a log stays readable after items are reworded or retired.
   `npm run quiz:answers -- <slug>` prints a session's full log with current scoring;
   `-- --backfill` fills snapshots on older answers (run it before changing wording).
   Retired statement ids stay listed in `retiredStatements` and no longer score.
6. **Postgres (Drizzle) + Supabase auth**, same ownership pattern as `map_projects`.
7. **The axes are a hypothesis, not a fixed map of politics.** The 18 axes are versioned
   with the bank. Once there is response data, factor analysis tests whether each axis's
   statements really move together, and axes get split, merged, or redrawn when they don't.
   Raw answers plus `bankVersion` make old quizzes re-scorable under a new axis set.

## Axes (US-adapted, v1)

Poles are named so that both sides would accept the description. 18 axes in 5 groups:

| # | Group | Axis (− pole ↔ + pole) | Covers | 12axes origin |
|---|---|---|---|---|
| 1 | Governance | States ↔ Federal | Federal preemption, state experimentation | Federal–Unitary |
| 2 | Governance | Checks & balances ↔ Strong executive | Executive orders, independent agencies, filibuster | Democratic–Autocratic (reframed; pro-democracy statements get near-universal agreement in the US) |
| 3 | Governance | Civil liberty ↔ Security | Surveillance, emergency powers, policing powers | Security–Freedom |
| 4 | Governance | Majoritarian ↔ Safeguarded | Electoral College, Senate, filibuster, voter ID, mail voting | new (*watch: ballot access and counter-majoritarian structure may prove to be two dimensions*) |
| 4b | Governance | Democratic ↔ Autocratic | Whether government must be chosen in free elections; opposition, press, term limits | Democratic–Autocratic (added in bank 3.0.0, worded without US references so non-democratic views can be stated directly) |
| 5 | Economy | Public ownership ↔ Private ownership | Public option, utilities, nationalization | Collectivize–Privatize |
| 6 | Economy | Regulated ↔ Laissez-faire | Business, finance, labor regulation | Planned–Laissez-Faire |
| 7 | Economy | Redistributive ↔ Self-reliant | Taxes, welfare, entitlements | new (split out of 5/6) |
| 8 | Economy | Protectionist ↔ Free trade | Tariffs, offshoring, industrial policy | Isolationism–Globalism |
| 9 | Foreign | Internationalist ↔ America First | Alliances, UN, foreign aid | Nationalism–Internationalism |
| 10 | Foreign | Interventionist ↔ Restraint | Use of force, defense spending | Militarist–Pacifist |
| 11 | Society | Progressive ↔ Traditional | Gender, sexuality, family norms | Progressive–Traditional |
| 12 | Society | Secular ↔ Religious | Religion and the state, from a state that discourages religion to one governed by religious law; statements are tradition-neutral | Irreligious–Religious |
| 13 | Society | Open/pluralist ↔ Restrictive/assimilationist | Immigration levels, language, national identity | Assimilationist–Multiculturalist |
| 14 | Society | Reform ↔ Law & order | Sentencing, policing, drugs, death penalty | new |
| 15 | Society | Group-conscious ↔ Colorblind | Affirmative action, disparate impact, DEI | new |
| 16 | Tech & nature | Environmental ↔ Growth-first | Climate, fossil fuels, conservation, energy | new |
| 17 | Tech & nature | Precautionary ↔ Accelerationist | AI, biotech, nuclear, automation | Acceleration–Bioconservative |

Axis 2 (executive) and axis 4 (elections) keep their US meaning; whether there should be
elections at all is the democracy axis, so a strong-president populist no longer sits with
monarchism and fascism.

### Lenses

Some differences are categorical, not positions on a line: which religious tradition should
shape the law, who should hold final authority, and what defines the nation. These are
recorded as **lenses** (`types.ts`, `lenses.ts`) from the Religion & law and Political
system modules. Lenses never move an axis (decision 3). In matching, each lens the
respondent answered adds one well-measured pseudo-axis per ideology: no gap if the
ideology accepts the answer, `LENS_GAP` if not. Ideologies list accepted values (Islamism:
Sunni or Shia, clerical rule); untagged ones get defaults from their positions (secular
ones accept no tradition, democratic ones accept elected rule, and untagged religious
Western entries accept the Christian traditions).

`npm run quiz:audit` checks that the catalog stays separable. It reports close pairs that
no lens separates, whether a simulated respondent placed on each ideology (answering lens
questions as it would) ranks it first, match calibration distances, and simulated accuracy.
Bank 3.0.0: 80/80 rank first, no unseparated close pairs, mean axis error 0.07,
~144 answers on average.

Environment and technology are separate because people combine them freely
(pro-nuclear but AI-cautious; green but pro-biotech). Term limits doesn't count toward
any axis; it's recorded as a stance only.

## Issue modules (v1)

Each has a screener question, a short follow-up tree, and axis loadings. Every question
names the **attribute** it answers, so a module's result is a policy profile rather
than one sentence. For example, immigration covers undocumented residents, the legal
immigration level, selection priority, the border wall, Dreamers, birthright citizenship,
asylum, interior enforcement, and temporary work visas. Broad answers never fill narrower
attributes automatically: the quiz records only answers the respondent actually supplies.
Compact multiple-selection batteries are used where several independent policies belong
together; an unchecked option is not treated as opposition.
Each screener also records whether the issue is of low, medium, or high importance. That
modestly changes how much evidence the answer contributes without changing its direction.
Policy answers are weighted up (`CHOICE_WEIGHT`) relative to statements, so one strong
reaction to an abstract statement can't outweigh several concrete policy choices. When the
statement answers alone and the policy answers alone each place an axis clearly but in
different places, the axis is reported as mixed and its uncertainty widened to span both,
which also lowers its weight in ideology matching.

Modules:

Abortion · Guns · Immigration & border · Health care · Taxes · Labor &
minimum wage · Social Security & Medicare · Climate & energy · Policing ·
Death penalty · Drugs · LGBTQ rights · Affirmative action · Education & school
choice · Speech & content moderation · Voting rules · Supreme Court & judiciary
· Israel/Gaza · Ukraine/Russia · China · Trade & tariffs · AI & tech regulation
· Religious liberty · Housing & zoning · Federal debt · Religion & law · Political system

## Question model

Implemented in `src/lib/quiz/types.ts`. In short:

```ts
interface Statement {
  id: string;                    // stable forever; answers reference it
  text: string;
  model: "directional" | "ideal";
  axes: Partial<Record<AxisId, { location: number; weight: number }>>;
}

interface ChoiceQuestion { id; attribute; prompt; selection?: "single" | "multiple"; options: ChoiceOption[] }
interface ChoiceOption  { id; text; stance; axes; exclusive?: boolean }
interface FollowUp extends ChoiceQuestion { when?: Condition }   // serializable branching
```

- **Directional** (most statements): agreement rises toward the pole on the side of
  `location`, and `location` is the threshold where agreement turns positive. A +0.8
  statement is agreed with by everyone from +0.8 to +1, including people at +1.
- **Ideal** (compromise statements, all at location 0): agreement peaks at `location` and
  falls off on both sides.
- **Choice options** are categorical ideal points: the option whose location is nearest the
  respondent is the most likely pick.

Answer scale for statements: 7 points (Strongly disagree … Strongly agree) plus **Skip**.
Skip is "no answer" and carries no information. It never counts as neutral.

**Writing rules (checked in tests where possible):**
- One claim per statement.
- No statements everyone agrees with ("corruption is bad").
- No "more/less than currently" (people disagree about what "currently" is). State the policy itself.
- For each axis, pro and con statements must sit within ±10% of each other in total weight (unit test). This cancels the tendency to just agree.
- Mix concrete policies with abstract values on each axis.
- Locations spread across the whole range on each axis, with no gaps (unit test).
- At least 2 statements per location, so retakes don't repeat questions.
- Location 0 statements are ideal-point; directional statements never sit at 0 (unit test).

## Engine

Everything lives in `src/lib/quiz/engine.ts`, as pure functions.

- **Posterior per axis on a grid.** 41 points over [-1, 1], starting from a flat prior.
  Exact, cheap to compute, easy to debug.
- **Likelihood.** The answer probability on the −3…+3 scale is a discretized normal around a
  predicted agreement μ(θ):
  - **Directional:** `μ(θ) = 3·tanh(k·s·(θ − location))`, where s is the sign of the location
    and k is a slope.
  - **Ideal:** `μ(θ) = 3 − 6·min(1, |θ − location| / width)`.
  - **Choice questions:** a softmax over negative squared distance to each option's location.
  - When an item loads on several axes, each axis gets its own update, scaled by that axis's weight.
- **Picking the next question.** Among unanswered statements on unsettled axes, take
  the one with the greatest expected drop in posterior variance. A coverage rule
  comes first: every axis gets 2 statements and every issue screener gets asked before
  the engine is allowed to concentrate on any one axis. Exposure control picks randomly among
  the top-k so everyone doesn't get identical quizzes.
- **Branching.** Issue screeners are queued like statements, and their follow-ups
  are inserted when their `askIf` is true. A screener answer also updates the axes
  it loads on.
- **Stopping rules.**
  - An axis is settled when its posterior SD is below 0.12 *and* it has at least 4 answers, or
    when it reaches 15 answers.
  - An issue is settled when its follow-up tree has nowhere left to go.
  - The quiz ends when everything is settled.
  - These thresholds are constants, tuned by simulation (below).
  - "Complete" means the stopping rules were met, not that the quiz is closed. An axis that hit
    the 15-answer cap still unsettled stays refinable afterward.
- **Changing an answer.** Edit the stored answer and replay. Questions already asked stay
  in the log even if the new path wouldn't have asked them, because they're still information.
  Anything newly needed gets queued.
- **Progress.** Length isn't fixed, so the progress bar shows the share of axes and issues settled,
  not "question N of M".
- **Simulation harness** (`engine.sim.test.ts`). Generate synthetic respondents
  (consistent, ambivalent, extreme, contrarian, random clickers), run the engine,
  and assert recovery error and length distribution. This is how thresholds get tuned
  before any real data exists.

### Length

Estimate:

| Respondent | Axis statements | Issue questions | Total |
|---|---|---|---|
| Clear-cut | 18 × ~4–5 | ~27 screeners + few follow-ups | ~120 |
| Ambivalent | 18 × ~8–12 | ~27 screeners + many follow-ups | ~180–210 |

The minimum per axis and the issue screeners set a floor of roughly 100. The point of the adaptivity is
to spend extra questions where someone is torn, not to cut the quiz short.

## Persistence & sharing

```ts
quizSessions = pgTable("quiz_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),        // 12-char base62 random: the URL hash, unguessable
  editToken: text().notNull(),            // hashed; raw value is set as an httpOnly cookie on the starting browser
  ownerId: uuid(),                        // null until claimed (Supabase auth.users.id, no FK — map_projects convention)
  visibility: quizVisibilityEnum().notNull().default("link"), // "link" | "public" | "private"
  bankVersion: text().notNull(),
  engineVersion: text().notNull(),
  answers: jsonb().notNull(),             // [{ itemId, value, answeredAt }] in order
  result: jsonb(),                        // cached replay output; recomputable
  status: quizStatusEnum().notNull(),     // "in_progress" | "complete"
  createdAt, updatedAt, completedAt,
});
```

- **Unclaimed** (`ownerId` null):
  - Anyone with the link can view it.
  - Only the browser holding the edit cookie can answer or edit.
- **Claim:** a signed-in user who holds the edit cookie sets `ownerId`. A bare link can't claim,
  so someone who was only sent the link can't take ownership. Once a quiz is claimed, its edit rights follow the owner's account.
- **Visibility once claimed:**
  - `public`: anyone with the link can see the results.
  - `private`: only the owner can see them; everyone else gets a 404.
- Server actions in `src/lib/actions/quiz.ts` (`startQuiz`, `answer`, `editAnswer`,
  `claimQuiz`, `setVisibility`), following `src/lib/actions/mapProjects.ts`.
- "My quizzes" list for signed-in users (retakes over time come free).
- **Retention:** unclaimed quizzes are deleted 7 days after `createdAt`:
  - The app treats them as missing from that moment.
  - `scripts/purge-quizzes.mjs`, run daily by `.github/workflows/purge-quizzes.yml` with
    `secrets.DATABASE_URL`, deletes the rows.
  - The result page for an unclaimed quiz shows its deletion date next to the claim button.

## Results page

- Axis chart: one bar per axis, grouped by category, each with a marker and a precision band.
  This replaces bare percentages.
- **Confidence per axis**, from posterior SD: High / Medium / Low. Low comes with the reason
  ("your answers on this axis pointed both ways" or "few answers") and a button: "Answer N
  more questions to refine this". It reopens the engine on that axis alone and appends to the same quiz.
- **Policy profiles:** one card per module listing each explicitly supplied stance.
- **Closest ideological traditions:** every ideology in the catalog, ranked by distance weighted by
  precision and counting only each ideology's defining axes.
  - Shown as distances, never as percentages or "You are X". There's no probability model
    behind a percentage.
  - The top 10 are featured, with the full ranking expandable.
  - Each ideology expands to "Why this matched": the respondent's position beside the
    ideology's reference point on each defining axis, closest and furthest first.
  - Reference points are hand-placed for v1 (Phase 6 fits them from data).
- **Why you landed here** (per axis): the 3 most influential answers, each phrased as the
  answer and the pole it pushed toward, e.g. "Strongly agreed: '…' → toward States". Each
  links to editing that answer, and results recompute on change.
- Owner controls: claim / visibility / retake. Open Graph image for shared links.

## Phases

1. **Engine + simulation.** ✅ Built and tested:
   - `engine.ts` (grid posterior, directional/ideal/choice likelihoods, overdispersion-widened
     uncertainty, selection, stopping, refine) and `results.ts`.
   - `sim.ts`, covered by `engine.test.ts`.
   - Policy answers count toward axis coverage, avoiding abstract questions that duplicate
     an issue answer. Follow-ups are interleaved with statements instead of shown in blocks.
   - A respondent placed at an ideology's reference point ranks it first in 52 of 55 cases.
2. **Question bank.** ✅ v1 done (`src/lib/quiz/bank/`, `BANK_VERSION` 1.0.0), covered by
   `bank.test.ts` and awaiting review:
   - 340 statements: 20 per axis, balanced, covering the full range, with the item model set
   - 25 issue modules with screeners, follow-ups, and compact multiple-selection batteries.
   - 55 ideologies.
3. **Persistence + routes.** ✅ Schema migration, actions, `/quiz`, `/quiz/[hash]`
   (read `node_modules/next/dist/docs/` before writing routes), a top-level "Quiz" nav entry in
   `primaryPages` next to Demographics, a tool-modules card, and the 7-day purge job.
4. **Results page.** ✅ Charts, issue stances, ideology matching, influence breakdown, OG image.
5. **Claiming & visibility.** ✅ Claim flow via the existing `/login`, the private-quiz 404,
   and a "Your quizzes" list on `/quiz`.
6. **Calibration (needs real data).**
   - Re-fit statement locations, weights, and item models, and the ideology reference
     points, from stored answers.
   - Factor-analyze each axis to test it, revising axes as needed (decision 7).
   - Add correlation-aware question selection.
   - Bump `bankVersion`.
7. **Population analysis (later, needs scale).** Aggregate views over completed quizzes:
   - how positions on one issue are distributed on another axis
   - which positions cluster together
   - which issues divide people most.

   Aggregates only, with minimum cell sizes so no small group is identifiable. No
   demographic questions are asked in v1, so any demographic breakdowns are a later,
   opt-in addition.

## Decided

- 18 axes (technology split into environment + technology after review; democracy added in bank 3.0.0); issue list as drafted; the bank's v1 is up for review.
- No matching to politicians or other real people yet; ideology labels only, with the full ranking shown.
- Unclaimed quizzes are kept for 7 days.
- "Quiz" sits at the top level next to Demographics.

## Later

- **Quiz modes.** Decided: there will be several, but v1 ships only the extensive mode.
  Quick (~30–45) and Standard (~70–100) would use the same bank and engine with looser
  stopping thresholds and fewer issue screeners. With "refine this axis", a short quiz can be
  extended later. Add a `mode` column when they arrive.
