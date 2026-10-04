// Adaptive quiz engine — pure functions over the answer log. No I/O; the
// stored answers are the source of truth and everything here is a replay.
// See docs/quiz-plan.md (Engine).

import { axisIds, type AxisId, type ChoiceQuestion, type Condition, type IssueModule, type Statement } from "./types";
import { statements, issues } from "./bank";

// ── Answers ──

// value: statements -3 (strongly disagree) … +3 (strongly agree); choices an
// option id. null = skipped, which carries no information.
export type QuizAnswer =
  | { kind: "statement"; id: string; value: number | null }
  | { kind: "choice"; id: string; value: string | string[] | null; importance?: 1 | 2 | 3 };

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
export const MIN_PER_AXIS = 5;
export const MAX_PER_AXIS = 15;
export const SD_TARGET = 0.12;
export const COVERAGE_PER_AXIS = 2;
export const STATEMENTS_BETWEEN_SCREENERS = 3;
export const EXPOSURE_TOP_K = 3;
export const REFINE_STEP = 4;
export const ENGINE_VERSION = "2.0.0";
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
  "healthcare.system": ["ownership.05", "ownership.07"],
  "labor.minimum-wage": ["federalism.19", "regulation.15"],
  "labor.unions": ["regulation.04", "regulation.14"],
  "entitlements.solvency": ["ownership.16", "redistribution.16"],
  "climate.approach": ["environment.02", "environment.17"],
  "ai.governance": ["technology.02", "technology.03", "technology.13"],
  "voting-rules.access": ["voting.04", "voting.05", "voting.09", "voting.10", "voting.12"],
  "lgbtq.marriage": ["social.03"],
  "affirmative-action.admissions": ["identity.03", "identity.13"],
  "policing.direction": ["justice.02", "justice.03", "justice.09", "justice.13"],
  "immigration.undocumented": ["immigration.03", "immigration.15"],
  "immigration.levels": ["immigration.04", "immigration.20"],
  "religious-liberty.vendors": ["religion.20"],
  "education.choice": ["ownership.15"],
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
  if (q.question.selection === "multiple") {
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

// log P(chose option | θ) on one axis: softmax over negative squared distance
// among the question's options that load on that axis.
function choiceLogLik(question: ChoiceQuestion, chosenId: string, axis: AxisId): number[] | null {
  const opts = question.options.filter((o) => o.axes[axis]);
  const chosen = opts.find((o) => o.id === chosenId);
  if (!chosen || opts.length < 2) return null;
  return GRID.map((t) => {
    const scores = opts.map((o) => -CHOICE_SHARPNESS * (t - o.axes[axis]!.location) ** 2);
    const max = Math.max(...scores);
    const z = scores.reduce((a, s) => a + Math.exp(s - max), 0);
    return -CHOICE_SHARPNESS * (t - chosen.axes[axis]!.location) ** 2 - max - Math.log(z);
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
  if (a.kind === "choice" && a.importance) {
    const importanceWeight = a.importance === 1 ? 0.7 : a.importance === 3 ? 1.3 : 1;
    for (const axis of Object.keys(out) as AxisId[]) out[axis] = out[axis]!.map((value) => value * importanceWeight);
  }
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
  // Final, explicitly supplied value per question.
  values: Map<string, { optionIds: string[]; implied: false }>;
  pending: ChoiceQuestion[];
}

export function issueStates(answers: QuizAnswer[]): IssueState[] {
  const answered = new Map<string, string | string[] | null>();
  for (const a of answers) if (a.kind === "choice") answered.set(a.id, a.value);

  return issues.map((m) => {
    const values = new Map<string, { optionIds: string[]; implied: false }>();
    const all = [m.screener, ...m.followUps];
    for (const q of all) {
      const v = answered.get(q.id);
      if (v) values.set(q.id, { optionIds: Array.isArray(v) ? v : [v], implied: false });
    }
    const screenerAnswered = answered.has(m.screener.id);
    const skipped = screenerAnswered && answered.get(m.screener.id) === null;
    const choices = new Map([...values].map(([k, v]) => [k, v.optionIds[0]]));
    const pending =
      screenerAnswered && !skipped
        ? m.followUps.filter((f) => !answered.has(f.id) && (!f.when || evalCondition(f.when, choices)))
        : [];
    return { module: m, screenerAnswered, skipped, values, pending };
  });
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
}

export interface QuizState {
  axes: Record<AxisId, AxisState>;
  posteriors: Record<AxisId, number[]>;
  issues: IssueState[];
  complete: boolean;
  progress: number; // 0…1
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
    if (a.value !== null) {
      for (const axis of Object.keys(answerEvidence(a)) as AxisId[]) answered[axis]++;
    }
  }
  const dispersion = overdispersion(answers, post);
  const remaining = Object.fromEntries(axisIds.map((a) => [a, 0])) as Record<AxisId, number>;
  for (const s of statements) if (!seen.has(s.id)) remaining[primaryAxis(s)]++;

  const axes = {} as Record<AxisId, AxisState>;
  for (const a of axisIds) {
    const { mean, sd: rawSd } = moments(post[a]);
    const sd = rawSd * dispersion[a];
    // Mixed views across a broad axis are meaningful, not a request for an
    // endless tie-breaker. Use model precision for stopping while retaining
    // the widened SD in results as an honest confidence signal.
    const precise = answered[a] >= MIN_PER_AXIS && rawSd < SD_TARGET;
    const capped = asked[a] >= MAX_PER_AXIS || remaining[a] === 0;
    const refineOpen = (refine[a] ?? 0) > asked[a] && remaining[a] > 0;
    axes[a] = { axis: a, mean, sd, asked: asked[a], answered: answered[a], settled: (precise || capped) && !refineOpen };
  }

  const iss = issueStates(answers);
  const complete = axisIds.every((a) => axes[a].settled) && iss.every((i) => i.screenerAnswered && i.pending.length === 0);

  const axisProgress = axisIds.reduce((sum, a) => sum + (axes[a].settled ? 1 : Math.min(0.9, axes[a].asked / 8)), 0);
  const issueProgress = iss.reduce((sum, i) => sum + (i.screenerAnswered && i.pending.length === 0 ? 1 : i.screenerAnswered ? 0.5 : 0), 0);
  const progress = complete ? 1 : (axisProgress + issueProgress) / (axisIds.length + iss.length);

  return { axes, posteriors: post, issues: iss, complete, progress };
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

export function nextItem(answers: QuizAnswer[], state: QuizState, seed: string, refine: RefineTargets = {}): NextItem | null {
  const rand = seededRandom(`${seed}:${answers.length}`);
  const askedIds = new Set(answers.map((a) => `${a.kind}:${a.id}`));
  for (const answer of answers) {
    if (answer.kind !== "choice" || answer.value === null) continue;
    for (const statementId of coveredStatementsByQuestion[answer.id] ?? []) askedIds.add(`statement:${statementId}`);
  }

  // 1. Find an open issue. Follow-ups are interleaved with statements rather
  // than delivered as a long, repetitive block.
  const lastScreenerAt = new Map<string, number>();
  answers.forEach((a, i) => {
    if (a.kind === "choice" && questionIndex.get(a.id)?.isScreener) lastScreenerAt.set(a.id, i);
  });
  const open = state.issues
    .filter((i) => i.pending.length > 0)
    .sort((x, y) => (lastScreenerAt.get(y.module.screener.id) ?? -1) - (lastScreenerAt.get(x.module.screener.id) ?? -1));
  if (open.length > 0 && answers.at(-1)?.kind !== "choice") {
    const i = open[0];
    return { kind: "choice", question: i.pending[0], module: i.module, isScreener: false };
  }

  const unasked = (axis: AxisId) => statements.filter((s) => primaryAxis(s) === axis && !askedIds.has(`statement:${s.id}`));
  const statementOn = (axis: AxisId): NextItem | null => {
    const pool = unasked(axis);
    if (pool.length === 0) return null;
    const ranked = pool
      .map((s) => ({ s, v: expectedVariance(s, state.posteriors[axis]) }))
      .sort((a, b) => a.v - b.v)
      .slice(0, EXPOSURE_TOP_K);
    return { kind: "statement", statement: pick(ranked, rand).s };
  };

  // 2. Axes the respondent asked to refine.
  for (const axis of axisIds) {
    if ((refine[axis] ?? 0) > state.axes[axis].asked) {
      const item = statementOn(axis);
      if (item) return item;
    }
  }

  // 3. Interleave issue screeners with statements.
  const screenersLeft = state.issues.filter((i) => !i.screenerAnswered).map((i) => i.module);
  const sinceScreener = (() => {
    let n = 0;
    for (let i = answers.length - 1; i >= 0; i--) {
      const a = answers[i];
      if (a.kind === "choice" && questionIndex.get(a.id)?.isScreener) break;
      n++;
    }
    return n;
  })();
  const unsettled = axisIds.filter((a) => !state.axes[a].settled && unasked(a).length > 0);
  const screener = (): NextItem => {
    const m = pick(screenersLeft, rand);
    return { kind: "choice", question: m.screener, module: m, isScreener: true };
  };

  if (screenersLeft.length > 0 && (unsettled.length === 0 || sinceScreener >= STATEMENTS_BETWEEN_SCREENERS)) {
    return screener();
  }

  // 4. Statements: first give every axis basic coverage, then spend
  // questions where uncertainty is largest.
  if (unsettled.length > 0) {
    const uncovered = unsettled.filter((a) => state.axes[a].asked < COVERAGE_PER_AXIS);
    const axis =
      uncovered.length > 0
        ? pick(uncovered, rand)
        : unsettled.reduce((best, a) => (state.axes[a].sd > state.axes[best].sd ? a : best), unsettled[0]);
    const item = statementOn(axis);
    if (item) return item;
  }

  if (open.length > 0) {
    const i = open[0];
    return { kind: "choice", question: i.pending[0], module: i.module, isScreener: false };
  }
  return screenersLeft.length > 0 ? screener() : null;
}
