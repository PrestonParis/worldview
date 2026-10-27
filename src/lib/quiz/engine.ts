// Adaptive quiz engine — pure functions over the answer log. No I/O; the
// stored answers are the source of truth and everything here is a replay.
// See docs/quiz.md (Engine).

import { axisIds, type AxisId, type ChoiceOption, type ChoiceQuestion, type Condition, type FollowUp, type IssueModule, type Lens, type Loadings, type Statement } from "./types";
import { statements, issues } from "./bank";
import { inMode, modeAxes, QUIZ_MODES, type QuizModeId, type QuizSelectionContext } from "./modes";
import { candidateWeights, questionScore, splitScore } from "./funnel";

// ── Answers ──

// value: statements -3 (strongly disagree) … +3 (strongly agree); choices an
// option id. null = skipped, which carries no information.
export type QuizAnswer =
  | { kind: "statement"; id: string; value: number | null; shown?: AnswerSnapshot }
  | { kind: "choice"; id: string; value: string | string[] | null; importance?: 1 | 2 | 3; shown?: AnswerSnapshot };

// The item and response exactly as the respondent saw them, saved with each
// answer so the log stays readable after the bank is reworded or an item is
// retired. Display only: scoring always reads the current bank by id.
export interface AnswerSnapshot {
  text: string; // statement text or question prompt
  options?: string[]; // choice options in the order shown
  answer: string; // "Strongly agree", the chosen option text(s), or "Skipped"
  importance?: string; // "Low" | "Medium" | "High" for issue screeners
  at: string; // ISO time the answer was saved
}

export type NextItem =
  | { kind: "statement"; statement: Statement }
  | { kind: "choice"; question: ChoiceQuestion; module: IssueModule; isScreener: boolean };

// Per-axis extra statements the respondent asked for after finishing
// ("answer N more to refine this"): the axis stays open until it has had at
// least this many statements asked.
export type RefineTargets = Partial<Record<AxisId, number>>;

// ── Tunables (set by engine.sim.test.ts) ──

export const GRID_SIZE = 41;
export const PRIOR_SD = 0.75;
export const RESPONSE_SD = 1.2; // noise on the -3…+3 agreement scale
export const DIRECTIONAL_SLOPE = 3;
export const DIRECTIONAL_THRESHOLD = 0.85; // threshold = location × this, so ±1 items are still agreeable at the pole
export const IDEAL_WIDTH = 0.7;
export const CHOICE_SHARPNESS = 6;
// Concrete policy answers are scaled up against abstract statements: a
// strong reaction to one statement shouldn't outweigh several issue answers.
export const CHOICE_WEIGHT = 2;
// Answers in one checklist share wording and context, so they are correlated.
// Preserve every stance while capping how much one screen can tighten an axis.
export const CHECKLIST_AXIS_EVIDENCE_CAP = 2;
// Statement and policy evidence on an axis count as conflicting when their
// means differ by more than their combined SDs plus this margin.
export const CONFLICT_MARGIN = 0.4;
export const MIN_PER_AXIS = 5;
export const MAX_PER_AXIS = 15;
export const SD_TARGET = 0.12;
export const COVERAGE_PER_AXIS = 2;
// In the shorter checkpoints, an axis this uncertain still earns a direct
// statement when it divides the traditions in play, even if a side loading
// already counted toward its coverage.
export const WEAK_SD = 0.3;
// The order coverage statements visit the axes: the questions that divide
// political systems first, institutional detail last. Matches the broad-to-
// narrow order of the issue modules (bank/index.ts).
export const COVERAGE_ORDER: AxisId[] = [
  "democracy",
  "ownership",
  "redistribution",
  "regulation",
  "social",
  "religion",
  "immigration",
  "justice",
  "identity",
  "race",
  "violence",
  "engagement",
  "force",
  "trade",
  "environment",
  "technology",
  "liberty",
  "executive",
  "federalism",
  "voting",
];
export const EXPOSURE_TOP_K = 3;
export const REFINE_STEP = 4;
export const ENGINE_VERSION = "5.3.0";
export const NO_FIT_OPTION_ID = "__none_fit__";

// ── Lookups ──

export const statementById = new Map(statements.map((s) => [s.id, s]));
const questionIndex = new Map<string, { question: ChoiceQuestion; module: IssueModule; isScreener: boolean }>();
for (const m of issues) {
  questionIndex.set(m.screener.id, { question: m.screener, module: m, isScreener: true });
  for (const f of m.followUps) questionIndex.set(f.id, { question: f, module: m, isScreener: false });
}
export const questionById = questionIndex;

// Concrete policy answers supersede these substantially equivalent abstract
// statements. Keeping the statements in the bank preserves adaptive coverage
// for people who have not reached the issue module.
export const coveredStatementsByQuestion: Record<string, string[]> = {
  "economic-system.ownership": ["ownership.01", "ownership.02"],
  "healthcare.system": ["ownership.05", "ownership.07"],
  "labor.minimum-wage": ["federalism.19", "regulation.15"],
  "labor.unions": ["regulation.04", "regulation.14"],
  "entitlements.solvency": ["ownership.16", "redistribution.16"],
  "climate.approach": ["environment.02", "environment.17"],
  "ai.governance": ["technology.02", "technology.03", "technology.13"],
  "voting-rules.rules": ["voting.04", "voting.05", "voting.12", "voting.14"],
  "lgbtq.marriage": ["social.15"],
  "lgbtq.policies": ["social.03", "social.12", "social.20"],
  "affirmative-action.admissions": ["identity.03", "identity.13"],
  "affirmative-action.policies": ["identity.01"],
  "policing.direction": ["justice.02", "justice.03", "justice.09", "justice.13"],
  "immigration.undocumented": ["immigration.03", "immigration.15"],
  "immigration.levels": ["immigration.04", "immigration.20"],
  "immigration.enforcement": ["immigration.07", "immigration.11", "immigration.13", "immigration.16"],
  "climate.policies": ["technology.04"],
  "religious-liberty.vendors": ["religion.20"],
  "education.choice": ["ownership.15"],
  "race.differences": ["race.14"],
  "race.jewish": ["race.21", "race.16"],
  "race.marriage": ["race.09"],
  "race.association": ["identity.18"],
};

export const primaryAxis = (s: Statement) => s.id.split(".")[0] as AxisId;

export function isValidAnswer(a: QuizAnswer): boolean {
  if (a.kind === "statement") {
    if (!statementById.has(a.id)) return false;
    return a.value === null || (Number.isInteger(a.value) && a.value >= -3 && a.value <= 3);
  }
  const q = questionIndex.get(a.id);
  if (!q) return false;
  if (a.importance !== undefined && ![1, 2, 3].includes(a.importance)) return false;
  if (a.value === null) return true;
  if (q.question.selection === "multiple" || q.question.selection === "checklist") {
    if (!Array.isArray(a.value) || a.value.length === 0 || new Set(a.value).size !== a.value.length) return false;
    const selected = a.value.map((id) => q.question.options.find((o) => o.id === id));
    if (selected.some((o) => !o)) return false;
    return selected.filter((o) => o?.exclusive).length === 0 || a.value.length === 1;
  }
  return typeof a.value === "string" && (a.value === NO_FIT_OPTION_ID || q.question.options.some((o) => o.id === a.value));
}

// ── Grid posterior ──

export const GRID = Array.from({ length: GRID_SIZE }, (_, i) => -1 + (2 * i) / (GRID_SIZE - 1));

function priorLog(): number[] {
  return GRID.map((t) => -(t * t) / (2 * PRIOR_SD * PRIOR_SD));
}

function normalize(logp: number[]): number[] {
  const max = Math.max(...logp);
  const p = logp.map((l) => Math.exp(l - max));
  const sum = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / sum);
}

export function moments(p: number[]): { mean: number; sd: number } {
  let mean = 0;
  for (let i = 0; i < GRID_SIZE; i++) mean += p[i] * GRID[i];
  let v = 0;
  for (let i = 0; i < GRID_SIZE; i++) v += p[i] * (GRID[i] - mean) ** 2;
  return { mean, sd: Math.sqrt(v) };
}

// Predicted agreement (-3…+3) at position θ.
export function predictedAgreement(model: Statement["model"], location: number, theta: number): number {
  if (model === "ideal") {
    return 3 - 6 * Math.min(1, Math.abs(theta - location) / IDEAL_WIDTH);
  }
  const s = Math.sign(location);
  return 3 * Math.tanh(DIRECTIONAL_SLOPE * s * (theta - DIRECTIONAL_THRESHOLD * location));
}

const RESPONSES = [-3, -2, -1, 0, 1, 2, 3];

// log P(response | θ) for every grid point: a discretized normal around μ(θ).
function statementLogLik(model: Statement["model"], location: number, response: number): number[] {
  return GRID.map((t) => {
    const mu = predictedAgreement(model, location, t);
    const dens = RESPONSES.map((r) => Math.exp(-((r - mu) ** 2) / (2 * RESPONSE_SD ** 2)));
    const z = dens.reduce((a, b) => a + b, 0);
    return Math.log(dens[response + 3] / z);
  });
}

// log P(picked locations[chosen] | θ): softmax over negative squared distance.
function softmaxLogLik(locations: number[], chosen: number): number[] {
  return GRID.map((t) => {
    const scores = locations.map((l) => -CHOICE_SHARPNESS * (t - l) ** 2);
    const max = Math.max(...scores);
    const z = scores.reduce((a, s) => a + Math.exp(s - max), 0);
    return scores[chosen] - max - Math.log(z);
  });
}

// log P(chose option | θ) on one axis, among the question's options that load
// on that axis.
function choiceLogLik(question: ChoiceQuestion, chosenId: string, axis: AxisId): number[] | null {
  const opts = question.options.filter((o) => o.axes[axis]);
  const chosen = opts.findIndex((o) => o.id === chosenId);
  if (chosen === -1 || opts.length < 2) return null;
  return softmaxLogLik(opts.map((o) => o.axes[axis]!.location), chosen);
}

// Whether a checklist item was on screen when this answer was given. Items
// added to the bank later were never seen, so leaving them unchecked says
// nothing; answers saved without a snapshot predate any additions.
export function itemWasShown(a: QuizAnswer, option: ChoiceOption): boolean {
  return !a.shown?.options || a.shown.options.includes(option.text);
}

// A checklist's items, each as checked or not, with the loadings that side
// carries and the side it was picked over. Unchecked items count as "no" only
// if they were shown.
function checklistItems(question: ChoiceQuestion, chosenIds: string[], a: QuizAnswer): { picked: Loadings; other: Loadings }[] {
  return question.options.flatMap((o) => {
    if (!o.unchecked) return [];
    if (chosenIds.includes(o.id)) return [{ picked: o.axes, other: o.unchecked.axes }];
    return itemWasShown(a, o) ? [{ picked: o.unchecked.axes, other: o.axes }] : [];
  });
}

// Each answer's contribution to each axis's log posterior, weighted.
export function answerEvidence(a: QuizAnswer): Partial<Record<AxisId, number[]>> {
  const out: Partial<Record<AxisId, number[]>> = {};
  if (a.value === null) return out;
  if (a.kind === "statement") {
    const s = statementById.get(a.id);
    if (!s) return out;
    for (const [axis, l] of Object.entries(s.axes) as [AxisId, { location: number; weight: number }][]) {
      // Side loadings are always directional: an off-axis read of a compromise
      // statement isn't meaningful.
      const model = axis === primaryAxis(s) ? s.model : "directional";
      if (model === "directional" && l.location === 0) continue;
      out[axis] = statementLogLik(model, l.location, a.value).map((x) => x * l.weight);
    }
    return out;
  }
  const q = questionIndex.get(a.id);
  if (!q) return out;
  const chosenIds = Array.isArray(a.value) ? a.value : [a.value];
  if (q.question.selection === "checklist") {
    const parts = new Map<AxisId, number[][]>();
    for (const { picked, other } of checklistItems(q.question, chosenIds, a)) {
      for (const [axis, l] of Object.entries(picked) as [AxisId, { location: number; weight: number }][]) {
        const alt = other[axis];
        if (!alt) continue;
        const ll = softmaxLogLik([l.location, alt.location], 0);
        const list = parts.get(axis) ?? [];
        list.push(ll.map((value) => value * l.weight));
        parts.set(axis, list);
      }
    }
    for (const [axis, list] of parts) {
      const effective = Math.min(CHECKLIST_AXIS_EVIDENCE_CAP, list.length);
      out[axis] = GRID.map((_, g) =>
        (list.reduce((sum, ll) => sum + ll[g], 0) / list.length) * effective * CHOICE_WEIGHT,
      );
    }
    return out;
  }
  const chosen = chosenIds.flatMap((id) => {
    const option = q.question.options.find((o) => o.id === id);
    return option ? [option] : [];
  });
  const touched = new Set(chosen.flatMap((o) => Object.keys(o.axes) as AxisId[]));
  for (const axis of touched) {
    const parts = chosen.flatMap((option) => {
      const loading = option.axes[axis];
      const ll = loading && choiceLogLik(q.question, option.id, axis);
      return loading && ll ? [{ ll, weight: loading.weight }] : [];
    });
    if (parts.length) {
      // A compact multi-select is one observation, not one observation per
      // checked box. Averaging prevents long batteries from dominating.
      out[axis] = GRID.map((_, g) => parts.reduce((sum, p) => sum + p.ll[g] * p.weight, 0) / parts.length);
    }
  }
  // Importance is normative salience, not measurement reliability. Results
  // use it for emphasis; it must not make an answer statistically "truer".
  const scale = CHOICE_WEIGHT;
  for (const axis of Object.keys(out) as AxisId[]) out[axis] = out[axis]!.map((value) => value * scale);
  return out;
}

// Effective observations per axis. Checklist items are retained individually
// in the policy profile but same-screen correlation is capped here as well.
export function evidenceCounts(a: QuizAnswer): Partial<Record<AxisId, number>> {
  const out: Partial<Record<AxisId, number>> = {};
  if (a.kind !== "choice" || a.value === null) return out;
  const q = questionIndex.get(a.id)?.question;
  if (q?.selection !== "checklist") {
    for (const axis of Object.keys(answerEvidence(a)) as AxisId[]) out[axis] = 1;
    return out;
  }
  for (const { picked, other } of checklistItems(q, Array.isArray(a.value) ? a.value : [a.value], a)) {
    for (const axis of Object.keys(picked) as AxisId[]) if (other[axis]) out[axis] = (out[axis] ?? 0) + 1;
  }
  for (const axis of Object.keys(out) as AxisId[]) out[axis] = Math.min(CHECKLIST_AXIS_EVIDENCE_CAP, out[axis]!);
  return out;
}

export function posteriors(answers: QuizAnswer[], exclude = -1): Record<AxisId, number[]> {
  const logs = Object.fromEntries(axisIds.map((a) => [a, priorLog()])) as Record<AxisId, number[]>;
  answers.forEach((a, i) => {
    if (i === exclude) return;
    for (const [axis, ll] of Object.entries(answerEvidence(a)) as [AxisId, number[]][]) {
      const acc = logs[axis];
      for (let g = 0; g < GRID_SIZE; g++) acc[g] += ll[g];
    }
  });
  return Object.fromEntries(axisIds.map((a) => [a, normalize(logs[a])])) as Record<AxisId, number[]>;
}

// Categorical lens values from the chosen options; the latest answer wins.
export function lensAnswers(answers: QuizAnswer[]): Lens {
  const out: Lens = {};
  for (const a of answers) {
    if (a.kind !== "choice" || a.value === null) continue;
    const q = questionIndex.get(a.id)?.question;
    const first = Array.isArray(a.value) ? a.value[0] : a.value;
    const lens = q?.options.find((o) => o.id === first)?.lens;
    if (lens) Object.assign(out, lens);
  }
  return out;
}

// ── Branching ──

export function evalCondition(c: Condition, choices: Map<string, string>): boolean {
  if ("all" in c) return c.all.every((x) => evalCondition(x, choices));
  if ("any" in c) return c.any.some((x) => evalCondition(x, choices));
  const v = choices.get(c.q);
  return v !== undefined && c.in.includes(v);
}

export interface IssueState {
  module: IssueModule;
  screenerAnswered: boolean;
  skipped: boolean;
  // Not yet asked, and a foundation answer rules out its premise (`unless`),
  // so it won't be. Counts as done.
  excluded: boolean;
  // Final, explicitly supplied value per question.
  values: Map<string, { optionIds: string[]; implied: false }>;
  pending: ChoiceQuestion[];
}

export function issueStates(answers: QuizAnswer[]): IssueState[] {
  const answered = new Map<string, string | string[] | null>();
  for (const a of answers) if (a.kind === "choice") answered.set(a.id, a.value);
  // Single-choice answers across every module, for `unless`.
  const everywhere = new Map<string, string>();
  for (const [id, v] of answered) if (typeof v === "string") everywhere.set(id, v);

  return issues.map((m) => {
    const values = new Map<string, { optionIds: string[]; implied: false }>();
    const all = [m.screener, ...m.followUps];
    for (const q of all) {
      const v = answered.get(q.id);
      if (v) values.set(q.id, { optionIds: Array.isArray(v) ? v : [v], implied: false });
    }
    const screenerAnswered = answered.has(m.screener.id);
    const skipped = screenerAnswered && answered.get(m.screener.id) === null;
    const excluded = !screenerAnswered && !!m.unless && evalCondition(m.unless, everywhere);
    const choices = new Map([...values].map(([k, v]) => [k, v.optionIds[0]]));
    const pending =
      screenerAnswered && !skipped
        ? m.followUps.filter((f) => !answered.has(f.id) && (!f.when || evalCondition(f.when, choices)))
        : [];
    return { module: m, screenerAnswered, skipped, excluded, values, pending };
  });
}

// Nothing left to ask in this issue.
export function issueDone(i: IssueState): boolean {
  return i.excluded || (i.screenerAnswered && i.pending.length === 0);
}

// ── State ──

export interface AxisState {
  axis: AxisId;
  mean: number;
  // Posterior SD, widened when the respondent's own answers on this axis
  // disagree with each other more than the response model expects.
  sd: number;
  asked: number; // statements shown, including skips
  answered: number; // informative statement or policy answers on this axis
  settled: boolean;
  // Statement answers and policy answers each place this axis clearly, in
  // different places. The SD is widened to span both readings.
  conflict: boolean;
}

export interface QuizState {
  axes: Record<AxisId, AxisState>;
  posteriors: Record<AxisId, number[]>;
  issues: IssueState[];
  complete: boolean;
  progress: number; // 0…1
  // Statements still owed to refine targets the respondent asked for.
  refineLeft: number;
  // Unasked statements per axis, the ceiling for any refine target.
  remaining: Record<AxisId, number>;
}

export function modeComplete(state: QuizState, answerCount: number, mode: QuizModeId): boolean {
  if (mode === "deep") return state.complete;
  const config = QUIZ_MODES[mode];
  const covered = modeAxes(mode).every((axis) => state.axes[axis].answered >= config.minimumAxisEvidence);
  return (covered && answerCount >= config.targetScreens) || answerCount >= config.maximumScreens;
}

export function highestCompletedMode(state: QuizState, answerCount: number): QuizModeId | null {
  if (modeComplete(state, answerCount, "deep")) return "deep";
  if (modeComplete(state, answerCount, "standard")) return "standard";
  if (modeComplete(state, answerCount, "quick")) return "quick";
  return null;
}

export function computeState(answers: QuizAnswer[], refine: RefineTargets = {}): QuizState {
  const post = posteriors(answers);
  const asked = Object.fromEntries(axisIds.map((a) => [a, 0])) as Record<AxisId, number>;
  const answered = { ...asked };
  const seen = new Set<string>();
  for (const a of answers) {
    if (a.kind === "statement") {
      const s = statementById.get(a.id);
      if (!s) continue;
      seen.add(s.id);
      asked[primaryAxis(s)]++;
      if (a.value !== null) answered[primaryAxis(s)]++;
      continue;
    }
    // Policy answers already update the posterior, so let them satisfy basic
    // axis coverage too. This prevents asking an abstract duplicate solely
    // because it lives in the statement bank.
    for (const [axis, n] of Object.entries(evidenceCounts(a)) as [AxisId, number][]) answered[axis] += n;
  }
  const dispersion = overdispersion(answers, post);
  const split = conflicts(answers);
  const remaining = Object.fromEntries(axisIds.map((a) => [a, 0])) as Record<AxisId, number>;
  for (const s of statements) if (!seen.has(s.id)) remaining[primaryAxis(s)]++;

  const axes = {} as Record<AxisId, AxisState>;
  let refineLeft = 0;
  for (const a of axisIds) {
    const { mean, sd: rawSd } = moments(post[a]);
    const gap = split[a];
    const sd = Math.sqrt((rawSd * dispersion[a]) ** 2 + (gap / 2) ** 2);
    // Mixed views across a broad axis are meaningful, not a request for an
    // endless tie-breaker. Use model precision for stopping while retaining
    // the widened SD in results as an honest confidence signal.
    // Policy answers count toward precision, but an axis also needs its own
    // statements: choices alone can't catch a reading that only one abstract
    // answer contradicts.
    const precise = answered[a] >= MIN_PER_AXIS && asked[a] >= COVERAGE_PER_AXIS && rawSd < SD_TARGET;
    const capped = asked[a] >= MAX_PER_AXIS || remaining[a] === 0;
    const refineOpen = (refine[a] ?? 0) > asked[a] && remaining[a] > 0;
    if (refineOpen) refineLeft += Math.min((refine[a] ?? 0) - asked[a], remaining[a]);
    axes[a] = {
      axis: a,
      mean,
      sd,
      asked: asked[a],
      answered: answered[a],
      settled: (precise || capped) && !refineOpen,
      conflict: gap > 0,
    };
  }

  const iss = issueStates(answers);
  const complete = axisIds.every((a) => axes[a].settled) && iss.every(issueDone);

  const axisProgress = axisIds.reduce((sum, a) => sum + (axes[a].settled ? 1 : Math.min(0.9, axes[a].asked / 8)), 0);
  const issueProgress = iss.reduce((sum, i) => sum + (issueDone(i) ? 1 : i.screenerAnswered ? 0.5 : 0), 0);
  const progress = complete ? 1 : (axisProgress + issueProgress) / (axisIds.length + iss.length);

  return { axes, posteriors: post, issues: iss, complete, progress, refineLeft, remaining };
}

// Questions left in a "sharpen" round: refine targets once every issue is
// done. Before that they just ride along with the rest of the quiz. An answer
// in the round can reopen an axis, which then takes a question or two more
// after the round's own.
export function roundLeft(state: QuizState): number {
  const issuesDone = state.issues.every(issueDone);
  return issuesDone ? state.refineLeft : 0;
}

// Ratio of observed to expected residual spread on each axis's own
// statements (≥ 1). Inconsistent answers mean we know less than the model
// alone would claim, so the axis keeps getting questions.
function overdispersion(answers: QuizAnswer[], post: Record<AxisId, number[]>): Record<AxisId, number> {
  const sq = Object.fromEntries(axisIds.map((a) => [a, 0])) as Record<AxisId, number>;
  const n = { ...sq };
  const means = Object.fromEntries(axisIds.map((a) => [a, moments(post[a]).mean])) as Record<AxisId, number>;
  for (const a of answers) {
    if (a.kind !== "statement" || a.value === null) continue;
    const s = statementById.get(a.id);
    if (!s) continue;
    const axis = primaryAxis(s);
    const mu = predictedAgreement(s.model, s.axes[axis]!.location, means[axis]);
    sq[axis] += (a.value - mu) ** 2;
    n[axis]++;
  }
  return Object.fromEntries(
    axisIds.map((a) => [a, n[a] >= 3 ? Math.sqrt(Math.max(1, sq[a] / n[a] / RESPONSE_SD ** 2)) : 1]),
  ) as Record<AxisId, number>;
}

// Per axis, the distance between what the statement answers alone and the
// policy answers alone say, when both are clear and they disagree beyond
// their own uncertainty; 0 otherwise. Simulated respondents answer both from
// one position, so this only fires on real disagreement between the abstract
// and the concrete.
const CONFLICT_MAX_SD = 0.3;
function conflicts(answers: QuizAnswer[]): Record<AxisId, number> {
  const fromStatements = posteriors(answers.filter((a) => a.kind === "statement"));
  const fromChoices = posteriors(answers.filter((a) => a.kind === "choice"));
  return Object.fromEntries(
    axisIds.map((a) => {
      const s = moments(fromStatements[a]);
      const c = moments(fromChoices[a]);
      if (s.sd > CONFLICT_MAX_SD || c.sd > CONFLICT_MAX_SD) return [a, 0];
      const gap = Math.abs(s.mean - c.mean);
      return [a, gap > s.sd + c.sd + CONFLICT_MARGIN ? gap : 0];
    }),
  ) as Record<AxisId, number>;
}

// ── Selection ──

// Deterministic PRNG so a reload shows the same next question.
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(xs: T[], rand: () => number): T {
  return xs[Math.floor(rand() * xs.length)];
}

// Expected posterior variance on the statement's own axis after answering it.
function expectedVariance(s: Statement, post: number[]): number {
  const axis = primaryAxis(s);
  const l = s.axes[axis]!;
  let expected = 0;
  for (const r of RESPONSES) {
    const ll = statementLogLik(s.model, l.location, r);
    const joint = post.map((p, g) => p * Math.exp(ll[g]));
    const pr = joint.reduce((a, b) => a + b, 0);
    if (pr <= 0) continue;
    const { sd } = moments(joint.map((j) => j / pr));
    expected += pr * sd * sd;
  }
  return expected;
}

const setsLens = (m: IssueModule) => [m.screener, ...m.followUps].some((q) => q.options.some((o) => o.lens));

// The quiz runs as a funnel, broad to narrow:
//   1. Foundations: political system, economic system, religion and law.
//      They frame everything else and decide which issues still apply.
//   2. Principles: COVERAGE_PER_AXIS statements on every axis, one axis at a
//      time, the axis that best splits the traditions still in play first
//      (funnel.ts): family-level divides while many are, then the divides
//      within the respondent's group.
//   3. Issues, the one that best splits the remaining traditions first,
//      skipping any a foundation answer has ruled out. Each issue is asked as
//      one block: its screener, then its follow-ups.
//   4. Statements on whichever axis is least certain, until all settle.
export function nextItem(
  answers: QuizAnswer[],
  state: QuizState,
  seed: string,
  refine: RefineTargets = {},
  context: QuizSelectionContext = {},
): NextItem | null {
  const mode = context.mode ?? "deep";
  const deferred = new Set((context.deferred ?? []).map((item) => `${item.kind}:${item.id}`));
  const rand = seededRandom(`${seed}:${answers.length}`);
  const askedIds = new Set(answers.map((a) => `${a.kind}:${a.id}`));
  for (const answer of answers) {
    if (answer.kind !== "choice" || answer.value === null) continue;
    for (const statementId of coveredStatementsByQuestion[answer.id] ?? []) askedIds.add(`statement:${statementId}`);
  }

  // Finish the issue in progress first: follow-ups come straight after their
  // screener, so a topic is never left half-asked.
  const lastScreenerAt = new Map<string, number>();
  answers.forEach((a, i) => {
    if (a.kind === "choice" && questionIndex.get(a.id)?.isScreener) lastScreenerAt.set(a.id, i);
  });
  // Specialist follow-ups (`later`) wait until the broad pass has placed
  // the respondent: coverage met in the shorter checkpoints, the principle
  // statements done in Deep.
  const statementsLeft = (axis: AxisId) => statements.some((s) => primaryAxis(s) === axis && !askedIds.has(`statement:${s.id}`) && !deferred.has(`statement:${s.id}`));
  const placed = modeAxes(mode).every((axis) =>
    mode === "deep"
      ? state.axes[axis].settled || state.axes[axis].asked >= COVERAGE_PER_AXIS || !statementsLeft(axis)
      : state.axes[axis].answered >= QUIZ_MODES[mode].minimumAxisEvidence || !statementsLeft(axis),
  );
  const askable = (q: ChoiceQuestion) => !deferred.has(`choice:${q.id}`) && (placed || !(q as FollowUp).later);
  const open = state.issues
    .filter((i) => i.pending.some(askable))
    .sort((x, y) => (lastScreenerAt.get(y.module.screener.id) ?? -1) - (lastScreenerAt.get(x.module.screener.id) ?? -1));
  if (open.length > 0) {
    const i = open[0];
    return { kind: "choice", question: i.pending.find(askable)!, module: i.module, isScreener: false };
  }

  const unasked = (axis: AxisId) =>
    statements.filter((s) => primaryAxis(s) === axis && !askedIds.has(`statement:${s.id}`) && !deferred.has(`statement:${s.id}`));
  const statementOn = (axis: AxisId): NextItem | null => {
    const pool = unasked(axis);
    if (pool.length === 0) return null;
    const ranked = pool
      .map((s) => ({ s, v: expectedVariance(s, state.posteriors[axis]) }))
      .sort((a, b) => a.v - b.v)
      .slice(0, EXPOSURE_TOP_K);
    return { kind: "statement", statement: pick(ranked, rand).s };
  };

  const axesInMode = modeAxes(mode);

  // Funnel scores, computed once per step and only when needed.
  let split: Partial<Record<AxisId, number>> | null = null;
  const splits = () => {
    if (!split) {
      const weights = candidateWeights(state.axes, lensAnswers(answers));
      split = Object.fromEntries(axesInMode.map((a) => [a, splitScore(a, weights, state.axes)]));
    }
    return split;
  };
  // Most informative first; COVERAGE_ORDER breaks ties.
  const bySplit = (axes: AxisId[]) => [...axes].sort((a, b) => (splits()[b] ?? 0) - (splits()[a] ?? 0) || COVERAGE_ORDER.indexOf(a) - COVERAGE_ORDER.indexOf(b));
  // Modules that set a lens (who comes first, which tradition) are
  // narrowing questions: they go before ordinary issues once in the mode.
  const bestModule = (modules: IssueModule[]) => {
    const lensFirst = modules.filter(setsLens);
    const pool = lensFirst.length > 0 ? lensFirst : modules;
    return pool.reduce((best, m) => (questionScore(m.screener.options, splits()) > questionScore(best.screener.options, splits()) ? m : best), pool[0]);
  };

  // Axes the respondent asked to refine.
  for (const axis of axesInMode) {
    if ((refine[axis] ?? 0) > state.axes[axis].asked) {
      const item = statementOn(axis);
      if (item) return item;
    }
  }

  const screener = (m: IssueModule): NextItem => ({ kind: "choice", question: m.screener, module: m, isScreener: true });
  const unscreened = state.issues
    .filter((i) => !i.screenerAnswered && !i.excluded && inMode(i.module.minMode, mode) && !deferred.has(`choice:${i.module.screener.id}`))
    .map((i) => i.module);

  // Advertising/topic entries start with the promised subject, then join the
  // same shared quiz and scoring model.
  if (answers.length === 0 && context.entryTopic) {
    const topic = unscreened.find((m) => m.id === context.entryTopic);
    if (topic) return screener(topic);
  }

  // 1. Foundations.
  const foundation = unscreened.find((m) => m.foundation);
  if (foundation) return screener(foundation);

  // Quick and Standard are coverage contracts, not prefixes of Deep. Spend
  // the early budget on the least-measured axis, using concrete answers that
  // already supplied coverage before adding an abstract statement.
  if (mode !== "deep") {
    const minimum = QUIZ_MODES[mode].minimumAxisEvidence;
    const needsCoverage = COVERAGE_ORDER.filter((axis) => axesInMode.includes(axis) && state.axes[axis].answered < minimum && unasked(axis).length > 0);
    if (needsCoverage.length > 0) {
      const fewest = Math.min(...needsCoverage.map((axis) => state.axes[axis].answered));
      const axis = bySplit(needsCoverage.filter((candidate) => state.axes[candidate].answered === fewest))[0];
      const item = statementOn(axis);
      if (item) return item;
    }

    // Once coverage is sound, spend the rest of the budget on whatever best
    // splits the traditions still in play: a direct statement on an axis
    // that's still uncertain (often one only a side loading has touched), or
    // an issue module. The caller stops at the checkpoint.
    const open = axesInMode.filter((axis) => state.axes[axis].sd > WEAK_SD && unasked(axis).length > 0);
    const axis = open.length > 0 ? bySplit(open)[0] : null;
    const best = unscreened.length > 0 ? bestModule(unscreened) : null;
    const moduleValue = best ? questionScore(best.screener.options, splits()) : -1;
    if (axis && (splits()[axis] ?? 0) > moduleValue) {
      const item = statementOn(axis);
      if (item) return item;
    }
    if (best) return screener(best);
  }

  // 2. Principles.
  const unsettled = axesInMode.filter((a) => !state.axes[a].settled && unasked(a).length > 0);
  for (const axis of bySplit(unsettled)) {
    if (state.axes[axis].asked >= COVERAGE_PER_AXIS) continue;
    const item = statementOn(axis);
    if (item) return item;
  }

  // 3. Issues.
  if (unscreened.length > 0) return screener(bestModule(unscreened));

  // 4. Settle what's left.
  if (unsettled.length > 0) {
    const axis = unsettled.reduce((best, a) => (state.axes[a].sd > state.axes[best].sd ? a : best), unsettled[0]);
    return statementOn(axis);
  }
  return null;
}
