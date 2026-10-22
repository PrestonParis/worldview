// Quiz analytics over stored answer logs (docs/quiz.md, Analytics): the
// owner's /quiz/stats page and `npm run quiz:stats`. Pure: the callers load
// live sessions, archived responses (quiz_responses) and landing-page opener
// events, and this replays them against the current bank and engine.
//
// The statistical core is the leave-one-out posterior. For each answer, the
// respondent's position on the item's axis is estimated from every other
// answer they gave. Item parameters are then judged by the marginal
// likelihood of the answer over that posterior, P(r) = Σ_g p₋ᵢ(θ_g) P(r | θ_g),
// which keeps posterior uncertainty in play instead of plugging in a
// shrunken point estimate.

import { axisIds, type AxisId, type ChoiceQuestion, type Statement } from "./types";
import { axisById } from "./axes";
import { statements } from "./bank";
import {
  answerEvidence,
  computeState,
  highestCompletedMode,
  moments,
  primaryAxis,
  questionById,
  statementById,
  DIRECTIONAL_SLOPE,
  DIRECTIONAL_THRESHOLD,
  GRID,
  GRID_SIZE,
  IDEAL_WIDTH,
  lensAnswers,
  NO_FIT_OPTION_ID,
  PRIOR_SD,
  RESPONSE_SD,
  SD_TARGET,
  type QuizAnswer,
  type RefineTargets,
} from "./engine";
import { ideologyMatches, verdict, type AxisResult, type Verdict } from "./results";
import { allTraditions, ideologies } from "./ideologies";
import { modeRank, quizModeIds, type DeferredQuestion, type QuizCheckpointRecord, type QuizModeId } from "./modes";
import { OPENERS, type OpenerAnswer } from "./openers";
import { csvCell } from "../csv";
import { pearson, spearman } from "../stats/correlation";

// ── Inputs ──

export interface AnalyticsSession {
  key: string; // quiz_sessions.id or quiz_responses.id
  source: "live" | "archive";
  slug: string | null; // live sessions only
  claimed: boolean;
  isTest: boolean;
  bankVersion: string;
  engineVersion: string;
  targetMode: QuizModeId;
  highestCompletedMode: QuizModeId | null;
  entryVariant: string;
  entryTopic: string | null;
  answers: QuizAnswer[];
  refine: RefineTargets;
  deferred: DeferredQuestion[];
  checkpointHistory: QuizCheckpointRecord[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface OpenerEventRow {
  createdAt: Date;
  answers: OpenerAnswer[];
  started: boolean;
  mode: QuizModeId | null;
}

export interface AnalyticsOptions {
  now?: Date;
  from?: Date | null; // only sessions and visits created at or after this
  mode?: QuizModeId | null; // only sessions with this target mode
  bank?: string | null; // only sessions on this bank version
  includeFlagged?: boolean; // keep test, speeder and straight-line sessions in the statistics
  newSince?: Date; // "new" cut-off; default 24 hours before now
  timeZone?: string; // for daily buckets
  withResponses?: boolean; // include the long per-answer table (exports)
}

// ── Thresholds ──

export const SPEEDER_MEDIAN_SECONDS = 2;
export const STRAIGHT_LINE_MIN = 10;
export const MIN_ITEM_N = 5; // below this an item gets counts only
export const MIN_SUGGEST_N = 30; // below this nothing is suggested
// Item suggestions also need this log-likelihood gain (≈ p < 0.015 per item):
// with hundreds of items, the 95% interval alone flags a dozen by chance.
export const SUGGEST_GAIN = 3;
export const IDLE_HOURS = 1; // a session idle this long without reaching its target counts as abandoned
export const FAR_MATCH = 50; // top match % below this: no ideology fits well
export const CORRELATION_FLAG = 0.8;
export const OUTFIT_HIGH = 1.5;
export const OUTFIT_LOW = 0.5;
const CHI2_95 = 3.84; // profile-likelihood 95% interval: ΔLL ≤ 1.92
const MAX_GAP_SECONDS = 600; // longer pauses are breaks, not answer time
const SURVIVAL_POINTS = [1, 3, 5, 10, 15, 20, 24, 30, 40, 54, 64, 80, 110, 140, 170, 200];
const DAILY_MAX = 90;

// ── Outputs ──

export type SessionFlag = "test" | "speeder" | "straight-line";

export interface SessionSummary {
  key: string;
  source: "live" | "archive";
  slug: string | null;
  createdAt: string;
  lastAt: string;
  minutes: number;
  answers: number;
  skips: number;
  deferred: number;
  targetMode: QuizModeId;
  highestCompletedMode: QuizModeId | null;
  entry: string;
  bankVersion: string;
  claimed: boolean;
  isTest: boolean;
  flags: SessionFlag[];
  medianSeconds: number | null;
  topMatch: string | null;
  topMatchPct: number | null;
  verdict: Verdict | null;
  isNew: boolean;
}

export interface DailyRow {
  date: string;
  visits: number;
  openerAnswered: number;
  started: number;
  quick: number;
  standard: number;
  deep: number;
}

export interface Interval {
  estimate: number;
  lo: number;
  hi: number;
}

export interface StatementStats {
  id: string;
  axis: AxisId;
  text: string;
  model: Statement["model"];
  location: number;
  shown: number;
  answered: number;
  skipRate: number;
  histogram: number[]; // counts for -3…+3
  mean: number | null;
  sd: number | null;
  medianSeconds: number | null;
  itemRest: number | null; // r(response, leave-one-out θ)
  expectedSign: -1 | 1 | null; // directional items: the sign itemRest should have
  residual: number | null; // mean(observed − expected)
  outfit: number | null; // mean squared standardized residual; 1 = as the model expects
  infit: number | null; // information-weighted
  fittedLocation: Interval | null; // ML location under the item's own model
  locationGain: number | null; // LL(fitted) − LL(current)
  modelGain: number | null; // LL(best other model) − LL(best own model); > 0 favours switching
}

export interface OptionStats {
  id: string;
  text: string;
  picks: number;
  share: number;
  axes: { axis: AxisId; location: number; meanTheta: number | null; n: number }[];
}

export interface ChoiceStats {
  id: string;
  issue: string;
  prompt: string;
  selection: NonNullable<ChoiceQuestion["selection"]>;
  isScreener: boolean;
  shown: number;
  skips: number;
  noneFit: number;
  reach: number | null; // follow-ups: shown ÷ screener answers in the module
  importance: [number, number, number];
  medianSeconds: number | null;
  options: OptionStats[];
  orderAgreement: { axis: AxisId; rho: number; n: number }[]; // option location vs choosers' mean θ
}

export interface AxisStats {
  axis: AxisId;
  name: string;
  n: number; // sessions with evidence on the axis
  mean: number | null;
  spread: number | null; // SD of respondents' positions
  histogram: number[]; // 10 bins over −1…+1
  meanPosteriorSd: number | null;
  settledShare: number | null;
  reliability: number | null;
  conflictShare: number | null;
  dispersion: number | null; // pooled infit of the axis's statements
}

export interface Correlation {
  a: AxisId;
  b: AxisId;
  r: number;
  n: number;
}

export interface ParameterFit {
  name: string;
  current: number;
  fitted: Interval | null;
  edge: boolean; // the estimate sits at the end of the search range, so the optimum may lie beyond it
  n: number;
  gain: number | null;
}

export interface IdeologyOutcome {
  n: number;
  top: { id: string; name: string; family: string; count: number }[];
  topThree: { id: string; name: string; count: number }[];
  never: { id: string; name: string }[];
  verdicts: Record<Verdict, number>;
  topMatchHistogram: number[]; // 10 bins of 10 points
  far: { n: number; centroid: Partial<Record<AxisId, number>> };
  lenses: { lens: string; value: string; count: number }[];
}

export interface Suggestion {
  kind: "statement-location" | "statement-model" | "statement-misfit" | "statement-reversed" | "option-order" | "parameter" | "axis-overlap";
  target: string;
  detail: string;
  n: number;
  gain: number | null;
}

export interface ResponseRow {
  respondent: string;
  seq: number;
  kind: QuizAnswer["kind"];
  item: string;
  axis: AxisId | "";
  value: string;
  location: number | "";
  looTheta: number | "";
  looSd: number | "";
  seconds: number | "";
  bank: string;
  mode: QuizModeId;
  date: string;
}

export interface QuizAnalytics {
  generatedAt: string;
  filters: { from: string | null; mode: QuizModeId | null; bank: string | null; includeFlagged: boolean; timeZone: string };
  overview: {
    sessions: number;
    analyzed: number;
    archived: number;
    claimed: number;
    flagged: Record<SessionFlag, number>;
    newCount: number;
    newSince: string;
    last24h: number;
    last7d: number;
    visits: number;
    checkpoints: Record<QuizModeId, number>;
    totalAnswers: number;
    medianAnswers: number | null;
    medianSecondsPerAnswer: number | null;
    medianMinutes: number | null;
    skipRate: number | null;
    retiredAnswers: number;
    banks: { version: string; count: number }[];
    firstAt: string | null;
    lastAt: string | null;
  };
  openers: {
    visits: number;
    answered: [number, number, number];
    started: number;
    startedWithoutOpeners: number;
    medianSecondsToFirst: number | null;
    items: { id: string; text: string; histogram: number[]; n: number }[];
  };
  daily: DailyRow[];
  survival: { answers: number; byMode: Record<QuizModeId | "all", number | null> }[];
  startedByMode: Record<QuizModeId, number>;
  abandonment: { id: string; text: string; count: number }[];
  sessions: SessionSummary[];
  statements: StatementStats[];
  choices: ChoiceStats[];
  axes: AxisStats[];
  correlations: Correlation[];
  parameters: ParameterFit[];
  ideologies: IdeologyOutcome;
  suggestions: Suggestion[];
  responses?: ResponseRow[];
}

// ── Small statistics ──

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

function variance(xs: number[]): number | null {
  const s = stdev(xs);
  return s === null ? null : s * s;
}

function histogram(xs: number[], bins: number, lo: number, hi: number): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const x of xs) out[Math.min(bins - 1, Math.max(0, Math.floor(((x - lo) / (hi - lo)) * bins)))]++;
  return out;
}

const round = (x: number, places = 3) => Number(x.toFixed(places));

// ── Response model with explicit parameters ──
// Same shapes as engine.predictedAgreement / statementLogLik, with the
// parameters being estimated passed in.

const RESPONSES = [-3, -2, -1, 0, 1, 2, 3];

function agreement(model: Statement["model"], location: number, theta: number, slope: number): number {
  if (model === "ideal") return 3 - 6 * Math.min(1, Math.abs(theta - location) / IDEAL_WIDTH);
  return 3 * Math.tanh(slope * Math.sign(location) * (theta - DIRECTIONAL_THRESHOLD * location));
}

// P(response | θ_g) for every grid point: [g][response + 3].
const tableCache = new Map<string, Float64Array[]>();
function responseTable(model: Statement["model"], location: number, sd: number, slope: number): Float64Array[] {
  const key = `${model}|${location.toFixed(3)}|${sd.toFixed(3)}|${slope.toFixed(3)}`;
  const hit = tableCache.get(key);
  if (hit) return hit;
  const table = GRID.map((t) => {
    const mu = agreement(model, location, t, slope);
    const dens = RESPONSES.map((r) => Math.exp(-((r - mu) ** 2) / (2 * sd * sd)));
    const z = sum(dens);
    return Float64Array.from(dens.map((d) => d / z));
  });
  if (tableCache.size > 20_000) tableCache.clear();
  tableCache.set(key, table);
  return table;
}

// One observed statement answer with its leave-one-out posterior.
interface Obs {
  statement: Statement;
  value: number;
  loo: number[];
}

function marginal(o: Obs, table: Float64Array[]): number {
  let p = 0;
  for (let g = 0; g < GRID_SIZE; g++) p += o.loo[g] * table[g][o.value + 3];
  return p;
}

function logLik(obs: Obs[], params: (s: Statement) => Float64Array[]): number {
  let ll = 0;
  for (const o of obs) ll += Math.log(Math.max(marginal(o, params(o.statement)), 1e-300));
  return ll;
}

// Expected response and its variance under the predictive distribution.
function predictive(o: Obs, table: Float64Array[]): { e: number; v: number } {
  let e = 0;
  let e2 = 0;
  for (let g = 0; g < GRID_SIZE; g++) {
    for (let r = 0; r < 7; r++) {
      const p = o.loo[g] * table[g][r];
      e += p * RESPONSES[r];
      e2 += p * RESPONSES[r] ** 2;
    }
  }
  return { e, v: Math.max(e2 - e * e, 1e-6) };
}

// Grid search with a profile-likelihood interval.
function fitGrid(candidates: number[], ll: (x: number) => number): { best: number; bestLL: number; lo: number; hi: number } {
  const lls = candidates.map(ll);
  let bi = 0;
  for (let i = 1; i < lls.length; i++) if (lls[i] > lls[bi]) bi = i;
  const inside = candidates.filter((_, i) => lls[i] >= lls[bi] - CHI2_95 / 2);
  return { best: candidates[bi], bestLL: lls[bi], lo: Math.min(...inside), hi: Math.max(...inside) };
}

const LOCATIONS_DIRECTIONAL = Array.from({ length: 41 }, (_, i) => round(-1 + i * 0.05, 2)).filter((x) => x !== 0);
const LOCATIONS_IDEAL = Array.from({ length: 41 }, (_, i) => round(-1 + i * 0.05, 2));
const SD_CANDIDATES = Array.from({ length: 71 }, (_, i) => round(0.5 + i * 0.05, 2)); // 0.5…4
const SLOPE_CANDIDATES = Array.from({ length: 39 }, (_, i) => round(0.5 + i * 0.25, 2)); // 0.5…10

// ── Per-session replay ──

function normalizeLog(logp: number[]): number[] {
  const max = Math.max(...logp);
  const p = logp.map((l) => Math.exp(l - max));
  const z = sum(p);
  return p.map((x) => x / z);
}

interface Replay {
  session: AnalyticsSession;
  flags: SessionFlag[];
  gaps: (number | null)[]; // seconds since the previous answer, by answer index
  times: (number | null)[]; // ms timestamps by answer index
  evidence: Partial<Record<AxisId, number[]>>[];
  logs: Record<AxisId, number[]>;
  state: ReturnType<typeof computeState>;
  answeredAxes: Record<AxisId, number>;
  // Highest checkpoint: as stored, or replayed for sessions saved before
  // checkpoints were recorded.
  reached: QuizModeId | null;
}

function answerTime(a: QuizAnswer): number | null {
  const t = a.shown?.at ? Date.parse(a.shown.at) : NaN;
  return Number.isFinite(t) ? t : null;
}

function replay(session: AnalyticsSession): Replay {
  const answers = session.answers;
  const times = answers.map(answerTime);
  // Gaps in time order: edits rewrite an answer's time in place.
  const order = answers.map((_, i) => i).filter((i) => times[i] !== null).sort((a, b) => times[a]! - times[b]!);
  const gaps: (number | null)[] = answers.map(() => null);
  for (let k = 1; k < order.length; k++) {
    const d = (times[order[k]]! - times[order[k - 1]]!) / 1000;
    // 0: saved in one batch (landing-page openers, backfilled snapshots).
    if (d > 0 && d <= MAX_GAP_SECONDS) gaps[order[k]] = d;
  }

  const evidence = answers.map(answerEvidence);
  const prior = GRID.map((t) => -(t * t) / (2 * PRIOR_SD * PRIOR_SD));
  const logs = Object.fromEntries(axisIds.map((a) => [a, [...prior]])) as Record<AxisId, number[]>;
  for (const ev of evidence) {
    for (const [axis, ll] of Object.entries(ev) as [AxisId, number[]][]) {
      const acc = logs[axis];
      for (let g = 0; g < GRID_SIZE; g++) acc[g] += ll[g];
    }
  }
  const state = computeState(answers, session.refine);
  const answeredAxes = Object.fromEntries(axisIds.map((a) => [a, state.axes[a].answered])) as Record<AxisId, number>;

  const flags: SessionFlag[] = [];
  if (session.isTest) flags.push("test");
  const realGaps = gaps.filter((g): g is number => g !== null);
  if (realGaps.length >= 10 && median(realGaps)! < SPEEDER_MEDIAN_SECONDS) flags.push("speeder");
  const values = answers.flatMap((a) => (a.kind === "statement" && a.value !== null ? [a.value] : []));
  if (values.length >= STRAIGHT_LINE_MIN && values.every((v) => v === values[0])) flags.push("straight-line");

  const reached = session.highestCompletedMode ?? highestCompletedMode(state, answers.length);
  return { session, flags, gaps, times, evidence, logs, state, answeredAxes, reached };
}

function loo(r: Replay, i: number, axis: AxisId): number[] {
  const ev = r.evidence[i][axis];
  return normalizeLog(ev ? r.logs[axis].map((l, g) => l - ev[g]) : r.logs[axis]);
}

// ── Main ──

const dayFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

function itemText(kind: QuizAnswer["kind"], id: string): string {
  if (kind === "statement") return statementById.get(id)?.text ?? id;
  return questionById.get(id)?.question.prompt ?? id;
}

export function analyzeQuiz(allSessions: AnalyticsSession[], allOpeners: OpenerEventRow[], opts: AnalyticsOptions = {}): QuizAnalytics {
  const now = opts.now ?? new Date();
  const timeZone = opts.timeZone ?? "UTC";
  const newSince = opts.newSince ?? new Date(now.getTime() - 86_400_000);
  const includeFlagged = opts.includeFlagged ?? false;
  const day = dayFormat(timeZone);

  const sessions = allSessions
    .filter((s) => !opts.from || s.createdAt >= opts.from)
    .filter((s) => !opts.mode || s.targetMode === opts.mode)
    .filter((s) => !opts.bank || s.bankVersion === opts.bank)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const openers = allOpeners.filter((e) => !opts.from || e.createdAt >= opts.from);

  const replays = sessions.map(replay);
  const kept = replays.filter((r) => includeFlagged || r.flags.length === 0);

  // Results per session, for the summaries and ideology outcomes.
  const results = new Map<Replay, { top: string; pct: number; verdict: Verdict; matches: ReturnType<typeof ideologyMatches> }>();
  for (const r of replays) {
    if (!r.session.answers.length) continue;
    const axes = axisIds.map((axis) => ({ axis, mean: r.state.axes[axis].mean, sd: r.state.axes[axis].sd })) as AxisResult[];
    const matches = ideologyMatches(axes, lensAnswers(r.session.answers));
    results.set(r, { top: matches[0].ideology.id, pct: matches[0].match, verdict: verdict(matches), matches });
  }

  // ── Overview ──
  const flagged: Record<SessionFlag, number> = { test: 0, speeder: 0, "straight-line": 0 };
  for (const r of replays) for (const f of r.flags) flagged[f]++;
  const checkpoints: Record<QuizModeId, number> = { quick: 0, standard: 0, deep: 0 };
  for (const r of kept) {
    const hi = r.reached;
    if (hi) for (const m of quizModeIds) if (modeRank(m) <= modeRank(hi)) checkpoints[m]++;
  }
  const keptAnswers = kept.flatMap((r) => r.session.answers);
  const allGaps = kept.flatMap((r) => r.gaps.filter((g): g is number => g !== null));
  const durations = kept.flatMap((r) => {
    const ts = r.times.filter((t): t is number => t !== null);
    return ts.length >= 2 ? [(Math.max(...ts) - Math.min(...ts)) / 60_000] : [];
  });
  const banks = new Map<string, number>();
  for (const s of sessions) banks.set(s.bankVersion, (banks.get(s.bankVersion) ?? 0) + 1);
  const retiredAnswers = keptAnswers.filter((a) => (a.kind === "statement" ? !statementById.has(a.id) : !questionById.has(a.id))).length;

  const overview: QuizAnalytics["overview"] = {
    sessions: sessions.length,
    analyzed: kept.length,
    archived: sessions.filter((s) => s.source === "archive").length,
    claimed: sessions.filter((s) => s.claimed).length,
    flagged,
    newCount: sessions.filter((s) => s.createdAt >= newSince).length,
    newSince: newSince.toISOString(),
    last24h: sessions.filter((s) => s.createdAt.getTime() >= now.getTime() - 86_400_000).length,
    last7d: sessions.filter((s) => s.createdAt.getTime() >= now.getTime() - 7 * 86_400_000).length,
    visits: openers.length,
    checkpoints,
    totalAnswers: keptAnswers.length,
    medianAnswers: median(kept.map((r) => r.session.answers.length)),
    medianSecondsPerAnswer: median(allGaps),
    medianMinutes: median(durations),
    skipRate: keptAnswers.length ? keptAnswers.filter((a) => a.value === null).length / keptAnswers.length : null,
    retiredAnswers,
    banks: [...banks].map(([version, count]) => ({ version, count })).sort((a, b) => b.count - a.count),
    firstAt: sessions[0]?.createdAt.toISOString() ?? null,
    lastAt: sessions.at(-1)?.createdAt.toISOString() ?? null,
  };

  // ── Openers ──
  const openerItems = OPENERS.map((id) => {
    const values = openers.flatMap((e) => e.answers.filter((a) => a.id === id).map((a) => a.value));
    return { id, text: itemText("statement", id), histogram: RESPONSES.map((r) => values.filter((v) => v === r).length), n: values.length };
  });
  const openerSummary: QuizAnalytics["openers"] = {
    visits: openers.length,
    answered: [1, 2, 3].map((k) => openers.filter((e) => e.answers.length >= k).length) as [number, number, number],
    started: openers.filter((e) => e.started).length,
    startedWithoutOpeners: openers.filter((e) => e.started && e.answers.length === 0).length,
    medianSecondsToFirst: median(openers.flatMap((e) => (e.answers[0] ? [e.answers[0].ms / 1000] : []))),
    items: openerItems,
  };

  // ── Daily ──
  const dailyMap = new Map<string, DailyRow>();
  const row = (d: Date) => {
    const key = day.format(d);
    let r = dailyMap.get(key);
    if (!r) {
      r = { date: key, visits: 0, openerAnswered: 0, started: 0, quick: 0, standard: 0, deep: 0 };
      dailyMap.set(key, r);
    }
    return r;
  };
  for (const e of openers) {
    const r = row(e.createdAt);
    r.visits++;
    if (e.answers.length) r.openerAnswered++;
  }
  for (const { session, reached } of replays) {
    const r = row(session.createdAt);
    r.started++;
    const hi = reached;
    if (hi) for (const m of quizModeIds) if (modeRank(m) <= modeRank(hi)) r[m]++;
  }
  // Fill empty days so the series reads as time.
  const keys = [...dailyMap.keys()].sort();
  if (keys.length) {
    const end = day.format(now);
    for (let t = Date.parse(`${keys[0]}T12:00:00Z`); ; t += 86_400_000) {
      const key = new Date(t).toISOString().slice(0, 10);
      if (key > end) break;
      if (!dailyMap.has(key)) dailyMap.set(key, { date: key, visits: 0, openerAnswered: 0, started: 0, quick: 0, standard: 0, deep: 0 });
    }
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-DAILY_MAX);

  // ── Funnel ──
  const startedByMode: Record<QuizModeId, number> = { quick: 0, standard: 0, deep: 0 };
  for (const r of kept) startedByMode[r.session.targetMode]++;
  const survival = SURVIVAL_POINTS.map((k) => {
    const byMode = { all: null, quick: null, standard: null, deep: null } as Record<QuizModeId | "all", number | null>;
    for (const m of ["all", ...quizModeIds] as const) {
      const group = kept.filter((r) => m === "all" || r.session.targetMode === m);
      byMode[m] = group.length ? group.filter((r) => r.session.answers.length >= k).length / group.length : null;
    }
    return { answers: k, byMode };
  });
  const abandonCounts = new Map<string, { kind: QuizAnswer["kind"]; count: number }>();
  for (const r of kept) {
    const s = r.session;
    const reached = r.reached && modeRank(r.reached) >= modeRank(s.targetMode);
    if (reached || s.updatedAt.getTime() > now.getTime() - IDLE_HOURS * 3_600_000 || !s.answers.length) continue;
    let last = s.answers.length - 1;
    for (let i = 0; i < s.answers.length; i++) if ((r.times[i] ?? -Infinity) >= (r.times[last] ?? -Infinity)) last = i;
    const a = s.answers[last];
    const key = `${a.kind}:${a.id}`;
    abandonCounts.set(key, { kind: a.kind, count: (abandonCounts.get(key)?.count ?? 0) + 1 });
  }
  const abandonment = [...abandonCounts]
    .map(([key, v]) => {
      const id = key.slice(key.indexOf(":") + 1);
      return { id, text: itemText(v.kind, id), count: v.count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // ── Sessions table ──
  const summaries: SessionSummary[] = replays
    .map((r) => {
      const s = r.session;
      const ts = r.times.filter((t): t is number => t !== null);
      const last = Math.max(s.updatedAt.getTime(), ...ts);
      const res = results.get(r);
      const g = r.gaps.filter((x): x is number => x !== null);
      return {
        key: s.key,
        source: s.source,
        slug: s.slug,
        createdAt: s.createdAt.toISOString(),
        lastAt: new Date(last).toISOString(),
        minutes: round((last - s.createdAt.getTime()) / 60_000, 1),
        answers: s.answers.length,
        skips: s.answers.filter((a) => a.value === null).length,
        deferred: s.deferred.length,
        targetMode: s.targetMode,
        highestCompletedMode: r.reached,
        entry: s.entryTopic ? `topic:${s.entryTopic}` : s.entryVariant,
        bankVersion: s.bankVersion,
        claimed: s.claimed,
        isTest: s.isTest,
        flags: r.flags,
        medianSeconds: g.length ? round(median(g)!, 1) : null,
        topMatch: res ? (ideologies.find((i) => i.id === res.top)?.name ?? res.top) : null,
        topMatchPct: res?.pct ?? null,
        verdict: res?.verdict ?? null,
        isNew: s.createdAt >= newSince,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // ── Statement items ──
  const obsByStatement = new Map<string, Obs[]>();
  const statsInput = new Map<string, { shown: number; skips: number; values: number[]; seconds: number[]; loMeans: number[] }>();
  const responses: ResponseRow[] = [];
  kept.forEach((r, ri) => {
    const s = r.session;
    const respondent = `r${ri + 1}`;
    s.answers.forEach((a, i) => {
      let axis: AxisId | "" = "";
      let location: number | "" = "";
      let looTheta: number | "" = "";
      let looSd: number | "" = "";
      if (a.kind === "statement") {
        const st = statementById.get(a.id);
        if (st) {
          axis = primaryAxis(st);
          location = st.axes[axis]!.location;
          const entry = statsInput.get(st.id) ?? { shown: 0, skips: 0, values: [], seconds: [], loMeans: [] };
          entry.shown++;
          if (r.gaps[i] !== null) entry.seconds.push(r.gaps[i]!);
          if (a.value === null) entry.skips++;
          else {
            const p = loo(r, i, axis);
            const m = moments(p);
            entry.values.push(a.value);
            entry.loMeans.push(m.mean);
            const list = obsByStatement.get(st.id) ?? [];
            list.push({ statement: st, value: a.value, loo: p });
            obsByStatement.set(st.id, list);
            looTheta = round(m.mean);
            looSd = round(m.sd);
          }
          statsInput.set(st.id, entry);
        }
      }
      if (opts.withResponses) {
        responses.push({
          respondent,
          seq: i + 1,
          kind: a.kind,
          item: a.id,
          axis,
          value: a.value === null ? "" : Array.isArray(a.value) ? a.value.join("|") : String(a.value),
          location,
          looTheta,
          looSd,
          seconds: r.gaps[i] === null ? "" : round(r.gaps[i]!, 1),
          bank: s.bankVersion,
          mode: s.targetMode,
          date: day.format(s.createdAt),
        });
      }
    });
  });

  const current = (st: Statement) => responseTable(st.model, st.axes[primaryAxis(st)]!.location, RESPONSE_SD, DIRECTIONAL_SLOPE);
  const statementStats: StatementStats[] = [];
  for (const st of statements) {
    const input = statsInput.get(st.id);
    if (!input) continue;
    const axis = primaryAxis(st);
    const location = st.axes[axis]!.location;
    const obs = obsByStatement.get(st.id) ?? [];
    const n = obs.length;
    let residual: number | null = null;
    let outfit: number | null = null;
    let infit: number | null = null;
    let fittedLocation: Interval | null = null;
    let locationGain: number | null = null;
    let modelGain: number | null = null;
    if (n >= MIN_ITEM_N) {
      const table = current(st);
      const pred = obs.map((o) => ({ o, ...predictive(o, table) }));
      residual = round(mean(pred.map((p) => p.o.value - p.e))!);
      outfit = round(mean(pred.map((p) => (p.o.value - p.e) ** 2 / p.v))!);
      infit = round(sum(pred.map((p) => (p.o.value - p.e) ** 2)) / sum(pred.map((p) => p.v)));
      const llAt = (model: Statement["model"]) => (loc: number) => logLik(obs, () => responseTable(model, loc, RESPONSE_SD, DIRECTIONAL_SLOPE));
      const own = fitGrid(st.model === "ideal" ? LOCATIONS_IDEAL : LOCATIONS_DIRECTIONAL, llAt(st.model));
      const otherModel = st.model === "ideal" ? "directional" : "ideal";
      const other = fitGrid(otherModel === "ideal" ? LOCATIONS_IDEAL : LOCATIONS_DIRECTIONAL, llAt(otherModel));
      const currentLL = llAt(st.model)(location);
      fittedLocation = { estimate: own.best, lo: own.lo, hi: own.hi };
      locationGain = round(own.bestLL - currentLL);
      modelGain = round(other.bestLL - own.bestLL);
    }
    statementStats.push({
      id: st.id,
      axis,
      text: st.text,
      model: st.model,
      location,
      shown: input.shown,
      answered: input.values.length,
      skipRate: round(input.skips / input.shown),
      histogram: RESPONSES.map((v) => input.values.filter((x) => x === v).length),
      mean: input.values.length ? round(mean(input.values)!) : null,
      sd: stdev(input.values) === null ? null : round(stdev(input.values)!),
      medianSeconds: input.seconds.length ? round(median(input.seconds)!, 1) : null,
      itemRest: n >= MIN_ITEM_N && pearson(input.values, input.loMeans) !== null ? round(pearson(input.values, input.loMeans)!) : null,
      expectedSign: st.model === "directional" ? (Math.sign(location) as -1 | 1) : null,
      residual,
      outfit,
      infit,
      fittedLocation,
      locationGain,
      modelGain,
    });
  }

  // ── Choice questions ──
  const choiceInput = new Map<
    string,
    { shown: number; skips: number; noneFit: number; importance: [number, number, number]; seconds: number[]; picks: Map<string, number>; theta: Map<string, Map<AxisId, number[]>> }
  >();
  const screenerAnswers = new Map<string, number>();
  for (const r of kept) {
    r.session.answers.forEach((a, i) => {
      if (a.kind !== "choice") return;
      const q = questionById.get(a.id);
      if (!q) return;
      const entry = choiceInput.get(a.id) ?? {
        shown: 0,
        skips: 0,
        noneFit: 0,
        importance: [0, 0, 0] as [number, number, number],
        seconds: [] as number[],
        picks: new Map<string, number>(),
        theta: new Map<string, Map<AxisId, number[]>>(),
      };
      entry.shown++;
      if (r.gaps[i] !== null) entry.seconds.push(r.gaps[i]!);
      if (a.importance) entry.importance[a.importance - 1]++;
      if (q.isScreener && a.value !== null) screenerAnswers.set(q.module.id, (screenerAnswers.get(q.module.id) ?? 0) + 1);
      if (a.value === null) entry.skips++;
      else {
        const ids = Array.isArray(a.value) ? a.value : [a.value];
        for (const id of ids) {
          if (id === NO_FIT_OPTION_ID) entry.noneFit++;
          entry.picks.set(id, (entry.picks.get(id) ?? 0) + 1);
          const option = q.question.options.find((o) => o.id === id);
          if (!option) continue;
          const byAxis = entry.theta.get(id) ?? new Map<AxisId, number[]>();
          for (const axis of Object.keys(option.axes) as AxisId[]) {
            const list = byAxis.get(axis) ?? [];
            list.push(moments(loo(r, i, axis)).mean);
            byAxis.set(axis, list);
          }
          entry.theta.set(id, byAxis);
        }
      }
      choiceInput.set(a.id, entry);
    });
  }
  const choiceStats: ChoiceStats[] = [];
  for (const [id, entry] of choiceInput) {
    const q = questionById.get(id)!;
    const answered = entry.shown - entry.skips;
    const options: OptionStats[] = q.question.options.map((o) => ({
      id: o.id,
      text: o.text,
      picks: entry.picks.get(o.id) ?? 0,
      share: answered ? round((entry.picks.get(o.id) ?? 0) / answered) : 0,
      axes: (Object.entries(o.axes) as [AxisId, { location: number }][]).map(([axis, l]) => {
        const thetas = entry.theta.get(o.id)?.get(axis) ?? [];
        return { axis, location: l.location, meanTheta: thetas.length ? round(mean(thetas)!) : null, n: thetas.length };
      }),
    }));
    const axesTouched = new Set(options.flatMap((o) => o.axes.map((x) => x.axis)));
    const orderAgreement = [...axesTouched].flatMap((axis) => {
      const pts = options.flatMap((o) => o.axes.filter((x) => x.axis === axis && x.meanTheta !== null && x.n >= 3).map((x) => [x.location, x.meanTheta!] as const));
      const rho = pts.length >= 3 ? spearman(pts.map((p) => p[0]), pts.map((p) => p[1])) : null;
      return rho === null ? [] : [{ axis, rho: round(rho), n: pts.length }];
    });
    choiceStats.push({
      id,
      issue: q.module.id,
      prompt: q.question.prompt,
      selection: q.question.selection ?? "single",
      isScreener: q.isScreener,
      shown: entry.shown,
      skips: entry.skips,
      noneFit: entry.noneFit,
      reach: q.isScreener ? null : screenerAnswers.get(q.module.id) ? round(entry.shown / screenerAnswers.get(q.module.id)!) : null,
      importance: entry.importance,
      medianSeconds: entry.seconds.length ? round(median(entry.seconds)!, 1) : null,
      options,
      orderAgreement,
    });
  }
  choiceStats.sort((a, b) => b.shown - a.shown);

  // ── Axes ──
  const axisStats: AxisStats[] = axisIds.map((axis) => {
    const group = kept.filter((r) => r.answeredAxes[axis] > 0);
    const means = group.map((r) => r.state.axes[axis].mean);
    const rawVar = group.map((r) => moments(r.state.posteriors[axis]).sd ** 2);
    const spread = stdev(means);
    const v = variance(means);
    const errVar = mean(rawVar);
    const axisObs = statementStats.filter((s) => s.axis === axis);
    const obs = axisObs.flatMap((s) => obsByStatement.get(s.id) ?? []);
    let dispersion: number | null = null;
    if (obs.length >= MIN_ITEM_N) {
      const pred = obs.map((o) => ({ o, ...predictive(o, current(o.statement)) }));
      dispersion = round(sum(pred.map((p) => (p.o.value - p.e) ** 2)) / sum(pred.map((p) => p.v)));
    }
    return {
      axis,
      name: axisById[axis].name,
      n: group.length,
      mean: means.length ? round(mean(means)!) : null,
      spread: spread === null ? null : round(spread),
      histogram: histogram(means, 10, -1, 1),
      meanPosteriorSd: errVar === null ? null : round(Math.sqrt(errVar)),
      settledShare: group.length ? round(group.filter((r) => moments(r.state.posteriors[axis]).sd < SD_TARGET).length / group.length) : null,
      reliability: v !== null && errVar !== null && v + errVar > 0 && group.length >= MIN_ITEM_N ? round(v / (v + errVar)) : null,
      conflictShare: group.length ? round(group.filter((r) => r.state.axes[axis].conflict).length / group.length) : null,
      dispersion,
    };
  });

  const correlations: Correlation[] = [];
  for (let i = 0; i < axisIds.length; i++) {
    for (let j = i + 1; j < axisIds.length; j++) {
      const a = axisIds[i];
      const b = axisIds[j];
      const both = kept.filter((r) => r.answeredAxes[a] >= 2 && r.answeredAxes[b] >= 2);
      if (both.length < MIN_ITEM_N) continue;
      const r = pearson(both.map((x) => x.state.axes[a].mean), both.map((x) => x.state.axes[b].mean));
      if (r !== null) correlations.push({ a, b, r: round(r), n: both.length });
    }
  }

  // ── Global response-model parameters ──
  // Coordinate ascent: σ at the current slope, the slope at that σ, σ again.
  const allObs = [...obsByStatement.values()].flat();
  const directionalObs = allObs.filter((o) => o.statement.model === "directional");
  const parameters: ParameterFit[] = [];
  if (allObs.length >= MIN_ITEM_N) {
    const ll = (sd: number, slope: number) => (o: Obs[]) =>
      logLik(o, (st) => responseTable(st.model, st.axes[primaryAxis(st)]!.location, sd, slope));
    let sdFit = fitGrid(SD_CANDIDATES, (sd) => ll(sd, DIRECTIONAL_SLOPE)(allObs));
    const slopeFit = directionalObs.length >= MIN_ITEM_N ? fitGrid(SLOPE_CANDIDATES, (sl) => ll(sdFit.best, sl)(directionalObs)) : null;
    if (slopeFit) sdFit = fitGrid(SD_CANDIDATES, (sd) => ll(sd, slopeFit.best)(allObs));
    const currentAll = ll(RESPONSE_SD, DIRECTIONAL_SLOPE)(allObs);
    parameters.push({
      name: "RESPONSE_SD",
      current: RESPONSE_SD,
      fitted: { estimate: sdFit.best, lo: sdFit.lo, hi: sdFit.hi },
      edge: sdFit.best === SD_CANDIDATES[0] || sdFit.best === SD_CANDIDATES.at(-1),
      n: allObs.length,
      gain: round(ll(sdFit.best, slopeFit?.best ?? DIRECTIONAL_SLOPE)(allObs) - currentAll),
    });
    if (slopeFit) {
      parameters.push({
        name: "DIRECTIONAL_SLOPE",
        current: DIRECTIONAL_SLOPE,
        fitted: { estimate: slopeFit.best, lo: slopeFit.lo, hi: slopeFit.hi },
        edge: slopeFit.best === SLOPE_CANDIDATES[0] || slopeFit.best === SLOPE_CANDIDATES.at(-1),
        n: directionalObs.length,
        gain: round(slopeFit.bestLL - ll(sdFit.best, DIRECTIONAL_SLOPE)(directionalObs)),
      });
    }
  } else {
    parameters.push({ name: "RESPONSE_SD", current: RESPONSE_SD, fitted: null, edge: false, n: allObs.length, gain: null });
    parameters.push({ name: "DIRECTIONAL_SLOPE", current: DIRECTIONAL_SLOPE, fitted: null, edge: false, n: directionalObs.length, gain: null });
  }

  // ── Ideology outcomes ──
  // Sessions that reached at least one checkpoint, so a result was shown.
  const resulted = kept.filter((r) => r.reached && results.has(r));
  const topCounts = new Map<string, number>();
  const top3Counts = new Map<string, number>();
  const verdicts: Record<Verdict, number> = { clear: 0, lean: 0, torn: 0 };
  const topPcts: number[] = [];
  const far: Replay[] = [];
  const lensCounts = new Map<string, number>();
  for (const r of resulted) {
    const res = results.get(r)!;
    topCounts.set(res.top, (topCounts.get(res.top) ?? 0) + 1);
    for (const m of res.matches.slice(0, 3)) top3Counts.set(m.ideology.id, (top3Counts.get(m.ideology.id) ?? 0) + 1);
    verdicts[res.verdict]++;
    topPcts.push(res.pct);
    if (res.pct < FAR_MATCH) far.push(r);
    for (const [lens, value] of Object.entries(lensAnswers(r.session.answers))) {
      const key = `${lens}:${value}`;
      lensCounts.set(key, (lensCounts.get(key) ?? 0) + 1);
    }
  }
  const named = (id: string) => allTraditions.find((i) => i.id === id)!;
  const centroid: Partial<Record<AxisId, number>> = {};
  if (far.length) {
    for (const axis of axisIds) {
      const xs = far.filter((r) => r.answeredAxes[axis] > 0).map((r) => r.state.axes[axis].mean);
      if (xs.length) centroid[axis] = round(mean(xs)!);
    }
  }
  const ideologyOutcome: IdeologyOutcome = {
    n: resulted.length,
    top: [...topCounts].map(([id, count]) => ({ id, name: named(id).name, family: named(id).family, count })).sort((a, b) => b.count - a.count),
    topThree: [...top3Counts].map(([id, count]) => ({ id, name: named(id).name, count })).sort((a, b) => b.count - a.count),
    never: ideologies.filter((i) => !top3Counts.has(i.id)).map((i) => ({ id: i.id, name: i.name })),
    verdicts,
    topMatchHistogram: histogram(topPcts, 10, 0, 100),
    far: { n: far.length, centroid },
    lenses: [...lensCounts]
      .map(([key, count]) => {
        const [lens, value] = key.split(":");
        return { lens, value, count };
      })
      .sort((a, b) => b.count - a.count),
  };

  // ── Retraining suggestions ──
  const suggestions: Suggestion[] = [];
  for (const s of statementStats) {
    if (s.answered < MIN_SUGGEST_N) continue;
    if (s.fittedLocation && (s.locationGain ?? 0) >= SUGGEST_GAIN && (s.location < s.fittedLocation.lo || s.location > s.fittedLocation.hi)) {
      suggestions.push({
        kind: "statement-location",
        target: s.id,
        detail: `location ${s.location} → ${s.fittedLocation.estimate} (95% ${s.fittedLocation.lo}…${s.fittedLocation.hi})`,
        n: s.answered,
        gain: s.locationGain,
      });
    }
    if (s.modelGain !== null && s.modelGain >= SUGGEST_GAIN) {
      suggestions.push({ kind: "statement-model", target: s.id, detail: `${s.model} → ${s.model === "ideal" ? "directional" : "ideal"}`, n: s.answered, gain: s.modelGain });
    }
    if (s.expectedSign !== null && s.itemRest !== null && Math.sign(s.itemRest) === -s.expectedSign && Math.abs(s.itemRest) >= 0.2) {
      suggestions.push({ kind: "statement-reversed", target: s.id, detail: `item–rest r = ${s.itemRest}, keyed ${s.expectedSign > 0 ? "+" : "−"}`, n: s.answered, gain: null });
    }
    if (s.outfit !== null && (s.outfit > OUTFIT_HIGH || s.outfit < OUTFIT_LOW)) {
      suggestions.push({ kind: "statement-misfit", target: s.id, detail: `outfit ${s.outfit} (${s.outfit > 1 ? "noisier" : "more predictable"} than the model)`, n: s.answered, gain: null });
    }
  }
  for (const c of choiceStats) {
    if (c.shown - c.skips < MIN_SUGGEST_N) continue;
    for (const o of c.orderAgreement) {
      if (o.rho < 0) suggestions.push({ kind: "option-order", target: c.id, detail: `${o.axis}: option order vs choosers ρ = ${o.rho}`, n: c.shown - c.skips, gain: null });
    }
  }
  for (const p of parameters) {
    if (!p.fitted || p.n < MIN_SUGGEST_N || (p.gain ?? 0) < SUGGEST_GAIN) continue;
    if (p.current < p.fitted.lo || p.current > p.fitted.hi) {
      suggestions.push({ kind: "parameter", target: p.name, detail: `${p.current} → ${p.edge ? "at least " : ""}${p.fitted.estimate} (95% ${p.fitted.lo}…${p.fitted.hi})`, n: p.n, gain: p.gain });
    }
  }
  for (const c of correlations) {
    if (c.n >= MIN_SUGGEST_N && Math.abs(c.r) >= CORRELATION_FLAG) {
      suggestions.push({ kind: "axis-overlap", target: `${c.a} × ${c.b}`, detail: `r = ${c.r}`, n: c.n, gain: null });
    }
  }
  suggestions.sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0) || b.n - a.n);

  return {
    generatedAt: now.toISOString(),
    filters: { from: opts.from?.toISOString() ?? null, mode: opts.mode ?? null, bank: opts.bank ?? null, includeFlagged, timeZone },
    overview,
    openers: openerSummary,
    daily,
    survival,
    startedByMode,
    abandonment,
    sessions: summaries,
    statements: statementStats.sort((a, b) => b.answered - a.answered),
    choices: choiceStats,
    axes: axisStats,
    correlations: correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    parameters,
    ideologies: ideologyOutcome,
    suggestions,
    ...(opts.withResponses ? { responses } : {}),
  };
}

// ── Exports ──

export function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

export const RESPONSE_COLUMNS: (keyof ResponseRow)[] = ["respondent", "seq", "kind", "item", "axis", "value", "location", "looTheta", "looSd", "seconds", "bank", "mode", "date"];
export const SESSION_COLUMNS: (keyof SessionSummary)[] = [
  "createdAt",
  "lastAt",
  "minutes",
  "answers",
  "skips",
  "deferred",
  "targetMode",
  "highestCompletedMode",
  "entry",
  "bankVersion",
  "source",
  "claimed",
  "isTest",
  "flags",
  "medianSeconds",
  "topMatch",
  "topMatchPct",
  "verdict",
];

// The model-facing part of an analysis: current and fitted parameters.
export function itemsExport(a: QuizAnalytics) {
  return {
    generatedAt: a.generatedAt,
    filters: a.filters,
    parameters: a.parameters,
    statements: a.statements,
    choices: a.choices,
    axes: a.axes,
    correlations: a.correlations,
    suggestions: a.suggestions,
  };
}
