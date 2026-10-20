// Political quiz — question bank and ideology catalog types. Pure data; the
// engine (later phase) consumes these. See docs/quiz-plan.md.

export const axisIds = ["federalism", "executive", "liberty", "voting", "democracy", "violence", "ownership", "regulation", "redistribution", "trade", "engagement", "force", "social", "religion", "immigration", "justice", "identity", "race", "environment", "technology"] as const;

export type AxisId = (typeof axisIds)[number];

export type AxisGroup = "governance" | "economy" | "foreign" | "society" | "tech";

// How agreement relates to position (see docs/quiz-plan.md, Engine):
// - directional: agreement rises steadily toward the pole on the side of
//   `location`; `location` is the threshold where agreement turns positive,
//   so a ±1 item is agreed with only at the extreme. Most policy statements.
// - ideal: agreement peaks at `location` and falls off on both sides —
//   compromise statements that both extremes reject.
export type ItemModel = "directional" | "ideal";

export interface AxisPole {
  label: string;
  description: string;
}

export interface Axis {
  id: AxisId;
  group: AxisGroup;
  name: string;
  // Positions run from -1 (negative pole) to +1 (positive pole). The sign
  // carries no left/right meaning.
  negative: AxisPole;
  positive: AxisPole;
}

// Where an item sits on one axis. `location` is the position (-1…+1) of the
// respondent who would agree with it most; `weight` (0…1) is how strongly it
// informs that axis — 1 for the axis it was written for, less for side
// loadings.
export interface AxisLoading {
  location: number;
  weight: number;
}

export type Loadings = Partial<Record<AxisId, AxisLoading>>;

// Match-only signals distinguish traditions where the distinction should not
// be presented as a public political axis. They are deliberately absent from
// `axisIds`, result charts, comparisons, and coverage requirements.
export const internalSignalIds = ["antisemitism"] as const;
export type InternalSignalId = (typeof internalSignalIds)[number];
export type InternalSignals = Partial<Record<InternalSignalId, number>>;

// An agree/disagree statement, answered on a 7-point scale plus Skip.
export interface Statement {
  id: string; // stable forever; stored answers reference it
  text: string;
  model: ItemModel;
  axes: Loadings;
}

// Categorical preferences that can't sit on a line. Recorded from choice
// options and used only to tell ideologies apart when matching; they never
// move an axis (docs/quiz-plan.md, principle 3).
export const traditions = ["none", "pluralist", "catholic", "protestant", "orthodox", "christian", "sunni", "shia", "jewish", "hindu", "buddhist", "sikh", "other"] as const;
export type Tradition = (typeof traditions)[number];

export const authorities = ["elected", "assemblies", "party", "leader", "monarch", "clergy", "experts", "military", "owners", "no-state"] as const;
export type Authority = (typeof authorities)[number];

export const nationBases = ["civic", "ethnic", "religious", "civilizational", "class"] as const;
export type NationBasis = (typeof nationBases)[number];

// Whose interests, if any racial or ethnic people's, come first. "every" is
// the ethnopluralist answer: each people should put its own first.
export const peoples = ["none", "white", "black", "indigenous", "hispanic", "jewish", "every", "other"] as const;
export type People = (typeof peoples)[number];

// What politics should do with the existing order: go back to an earlier
// one, keep what exists, improve it, or replace it with something new. This
// is what separates reactionaries from conservatives, and both from
// revolutionaries of the left and right.
export const changes = ["restore", "conserve", "reform", "transform"] as const;
export type Change = (typeof changes)[number];

// How a communist or socialist judges the 20th-century communist states:
// the line that divides Marxist-Leninists, Trotskyists, left communists and
// anarchists, and democratic socialists. Asked only of communists and socialists.
export const legacies = ["achievement", "degenerated", "state-capitalist", "dictatorship"] as const;
export type Legacy = (typeof legacies)[number];

export interface Lens {
  tradition?: Tradition; // the religious tradition that should shape the law
  authority?: Authority; // who should hold final political authority
  nation?: NationBasis; // what defines membership in the nation
  people?: People; // which racial or ethnic people's interests come first
  change?: Change; // restore, conserve, reform, or transform the existing order
  legacy?: Legacy; // a socialist's verdict on the 20th-century communist states
}
export type LensId = keyof Lens;
export const lensIds: LensId[] = ["tradition", "authority", "nation", "people", "change", "legacy"];

export type IssueId = "abortion" | "guns" | "immigration" | "healthcare" | "taxes" | "labor" | "entitlements" | "climate" | "policing" | "death-penalty" | "drugs" | "lgbtq" | "affirmative-action" | "race" | "violence" | "family" | "education" | "speech" | "voting-rules" | "judiciary" | "israel" | "ukraine" | "china" | "tariffs" | "ai" | "religious-liberty" | "housing" | "debt" | "religion-law" | "regime" | "economic-system";

export interface ChoiceOption {
  id: string; // unique within its question
  text: string;
  // Plain-language stance this option contributes to the issue summary.
  stance: string;
  // Axis evidence. Options are scored as ideal points: the chosen option is
  // most likely for respondents located nearest its locations.
  axes: Loadings;
  // In a multiple-selection question this option cannot be combined with
  // any other option (for example, "None of these").
  exclusive?: boolean;
  // Categorical preference this option records (see Lens).
  lens?: Lens;
  // Internal-only match evidence. Values run from 0 to 1 and never move a
  // displayed axis or appear in the result payload.
  internal?: InternalSignals;
  // Checklist options only: what leaving the box unchecked means. Each
  // checklist option is its own yes/no item, scored as a choice between
  // `axes` (checked) and these loadings (unchecked).
  unchecked?: { stance: string; axes: Loadings };
}

export interface ChoiceQuestion {
  id: string; // globally unique, `${issueId}.${slug}`
  // The policy-profile attribute this question answers, e.g. "Gestational
  // limit". Each module's results are one stance per attribute.
  attribute: string;
  prompt: string;
  // Multiple-selection questions are submitted once, as a single compact
  // policy battery. Unchecked options are not treated as opposition.
  // A checklist ("select all you support") is shown the same way, but every
  // option is a separate yes/no item and an unchecked box counts as "no":
  // one screen in place of several yes/no follow-ups.
  selection?: "single" | "multiple" | "checklist";
  options: ChoiceOption[];
}

// Serializable branching condition over earlier choice answers.
export type Condition =
  | { q: string; in: string[] } // question q was answered with one of these option ids
  | { all: Condition[] }
  | { any: Condition[] };

export interface FollowUp extends ChoiceQuestion {
  // Omitted: asked whenever the screener was answered (not skipped).
  when?: Condition;
  // Narrows within a group rather than placing someone in one: held back
  // until the broad pass has placed the respondent, then asked before any
  // new issue. Used for a foundation's specialist follow-ups.
  later?: boolean;
}

export interface IssueModule {
  id: IssueId;
  name: string;
  // Foundations frame everything else (political system, economic system,
  // religion's place in law) and are asked before anything else.
  foundation?: boolean;
  // Not asked when a foundation answer already rules out the premise, e.g.
  // minimum-wage levels for someone who wants private enterprise abolished.
  // Leaving the foundation unanswered never skips a module.
  unless?: Condition;
  // Asked only from this checkpoint on; Snapshot leaves it out.
  minMode?: "standard" | "deep";
  screener: ChoiceQuestion;
  followUps: FollowUp[];
}

export type IdeologyFamily = "left" | "liberal" | "center" | "conservative" | "right" | "libertarian" | "populist" | "religious" | "other";

export interface Ideology {
  id: string;
  name: string;
  family: IdeologyFamily;
  description: string;
  // Reference position on every axis.
  position: Record<AxisId, number>;
  // The axes that define this ideology; omitted means all of them. Other axes
  // carry a typical adherent's position and count less when matching.
  core?: AxisId[];
  // Accepted lens values; omitted means the ideology takes no position.
  tradition?: Tradition[];
  authority?: Authority[];
  nation?: NationBasis[];
  people?: People[];
  change?: Change[];
  legacy?: Legacy[];
  // Umbrella labels only: the specific traditions the label spans.
  covers?: string[];
}
