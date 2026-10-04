// Results derived from the answer log: axis positions with confidence, the
// answers that moved each axis, per-issue policy profiles, and distance to
// every ideology in the catalog. Pure; recomputed on every view.

import { axisIds, type AxisId, type Ideology } from "./types";
import { axisById } from "./axes";
import { ideologies } from "./ideologies";
import {
  answerEvidence,
  computeState,
  moments,
  NO_FIT_OPTION_ID,
  questionById,
  statementById,
  type QuizAnswer,
  type QuizState,
  type RefineTargets,
} from "./engine";

export type Confidence = "high" | "medium" | "low";

export interface Influence {
  answerIndex: number;
  kind: QuizAnswer["kind"];
  itemId: string;
  text: string; // statement text or question prompt
  answerLabel: string; // "Strongly agreed", or the chosen option's text
  toward: "negative" | "positive";
  shift: number; // how far the axis mean moved because of this answer
}

export interface AxisResult {
  axis: AxisId;
  mean: number;
  sd: number;
  answered: number;
  confidence: Confidence;
  lowReason: "few" | "mixed" | null;
  influences: Influence[];
}

export interface ProfileAttribute {
  questionId: string;
  attribute: string;
  stance: string;
}

export interface IssueProfile {
  issueId: string;
  name: string;
  skipped: boolean;
  importance: 1 | 2 | 3 | null;
  attributes: ProfileAttribute[];
}

export interface AxisComparison {
  axis: AxisId;
  you: number;
  them: number;
  gap: number;
  agreement: number; // 0–100: 100 = same position, 0 = opposite poles
}

export interface IdeologyMatch {
  ideology: Ideology;
  distance: number;
  match: number; // 0–100, see matchPercent
  comparisons: AxisComparison[]; // closest first
}

export interface QuizResult {
  axes: AxisResult[];
  profiles: IssueProfile[];
  ideologies: IdeologyMatch[];
  answeredCount: number;
  complete: boolean;
  progress: number;
}

const STATEMENT_LABELS: Record<number, string> = {
  [-3]: "Strongly disagreed",
  [-2]: "Disagreed",
  [-1]: "Somewhat disagreed",
  0: "Neutral",
  1: "Somewhat agreed",
  2: "Agreed",
  3: "Strongly agreed",
};

export const CONFIDENCE_HIGH_SD = 0.15;
export const CONFIDENCE_MEDIUM_SD = 0.25;
// Keeps a respondent with few measured axes from matching too easily; these
// pseudo-axes pull every distance toward a typical value in proportion to how
// little weight the measured axes carry.
const PSEUDO_AXES = 2;
const PSEUDO_DISTANCE = 0.45;
// Axes outside an ideology's core hold a typical adherent's position, which
// varies more within the tradition, so a gap there says less.
const SECONDARY_WEIGHT = 0.5;
const TOP_INFLUENCES = 3;

// Match percentage from distance, linear between two calibrated ends
// (engine.sim respondents placed on an ideology): someone sitting exactly on an
// ideology's reference point lands at ~0.2 (the pseudo-axes keep it above 0),
// their top match averages ~0.25, their 10th ~0.48 and their median ideology
// ~0.68. The ceiling sits just past the median so the spread reads: top match
// ~90%, 10th ~50%, the typical ideology ~20%, the far half 0–20%.
export const MATCH_FLOOR = 0.2;
export const MATCH_CEILING = 0.8;

export function matchPercent(distance: number): number {
  const t = (distance - MATCH_FLOOR) / (MATCH_CEILING - MATCH_FLOOR);
  return Math.round(100 * Math.max(0, Math.min(1, 1 - t)));
}

// How decisively the top match wins, from its lead over the runner-up.
export type Verdict = "clear" | "lean" | "torn";
export const VERDICT_CLEAR_LEAD = 8;
export const VERDICT_TORN_LEAD = 3;

export function verdict(matches: IdeologyMatch[]): Verdict {
  if (matches.length < 2) return "clear";
  const lead = matches[0].match - matches[1].match;
  if (lead >= VERDICT_CLEAR_LEAD) return "clear";
  if (lead > VERDICT_TORN_LEAD) return "lean";
  return "torn";
}

function confidenceFor(sd: number): Confidence {
  if (sd < CONFIDENCE_HIGH_SD) return "high";
  if (sd < CONFIDENCE_MEDIUM_SD) return "medium";
  return "low";
}

function describe(a: QuizAnswer): { text: string; answerLabel: string } {
  if (a.kind === "statement") {
    return { text: statementById.get(a.id)?.text ?? a.id, answerLabel: STATEMENT_LABELS[a.value ?? 0] };
  }
  const q = questionById.get(a.id)?.question;
  const ids = Array.isArray(a.value) ? a.value : [a.value];
  const labels = ids.flatMap((id) => {
    if (id === NO_FIT_OPTION_ID) return ["Mixed / none of these fits"];
    const option = q?.options.find((o) => o.id === id);
    return option ? [option.text] : [];
  });
  return { text: q?.prompt ?? a.id, answerLabel: labels.join(", ") };
}

// Leave-one-out: how far each answer moved each axis it touches. Removing an
// answer from the full posterior is dividing out its likelihood, so each
// answer's evidence is computed once.
function influences(answers: QuizAnswer[], full: Record<AxisId, number[]>): Record<AxisId, Influence[]> {
  const out = Object.fromEntries(axisIds.map((a) => [a, [] as Influence[]])) as Record<AxisId, Influence[]>;
  const fullMeans = Object.fromEntries(axisIds.map((a) => [a, moments(full[a]).mean])) as Record<AxisId, number>;
  answers.forEach((a, i) => {
    if (a.value === null) return;
    const evidence = answerEvidence(a);
    for (const axis of Object.keys(evidence) as AxisId[]) {
      const ll = evidence[axis]!;
      const max = Math.max(...ll);
      const w = full[axis].map((p, g) => p * Math.exp(max - ll[g]));
      const z = w.reduce((x, y) => x + y, 0);
      const shift = fullMeans[axis] - moments(w.map((x) => x / z)).mean;
      if (Math.abs(shift) < 1e-4) continue;
      out[axis].push({
        answerIndex: i,
        kind: a.kind,
        itemId: a.id,
        ...describe(a),
        toward: shift < 0 ? "negative" : "positive",
        shift: Math.abs(shift),
      });
    }
  });
  for (const axis of axisIds) {
    out[axis] = out[axis].sort((x, y) => y.shift - x.shift).slice(0, TOP_INFLUENCES);
  }
  return out;
}

// "Mixed" when the respondent's own answers pull the axis both ways about as
// hard; otherwise low confidence just means too few answers.
function lowReason(sd: number, answered: number, infl: Influence[]): AxisResult["lowReason"] {
  if (sd < CONFIDENCE_MEDIUM_SD) return null;
  if (answered < 4) return "few";
  const neg = infl.filter((i) => i.toward === "negative").length;
  const pos = infl.length - neg;
  return neg > 0 && pos > 0 ? "mixed" : "few";
}

export function ideologyMatches(axes: AxisResult[]): IdeologyMatch[] {
  const byAxis = new Map(axes.map((a) => [a.axis, a]));
  return ideologies
    .map((ideology) => {
      let num = PSEUDO_AXES * PSEUDO_DISTANCE ** 2;
      let den = PSEUDO_AXES;
      const comparisons: AxisComparison[] = [];
      const core = new Set(ideology.core ?? axisIds);
      for (const axis of axisIds) {
        const them = ideology.position[axis];
        const you = byAxis.get(axis);
        if (!you) continue;
        // Precision weighting: well-measured axes count more.
        const w = (core.has(axis) ? 1 : SECONDARY_WEIGHT) / (you.sd ** 2 + 0.1 ** 2) / 100;
        const gap = Math.abs(you.mean - them);
        num += w * gap ** 2;
        den += w;
        comparisons.push({ axis, you: you.mean, them, gap, agreement: Math.round(100 * (1 - gap / 2)) });
      }
      comparisons.sort((a, b) => a.gap - b.gap);
      const distance = Math.sqrt(num / den);
      return { ideology, distance, match: matchPercent(distance), comparisons };
    })
    .sort((a, b) => a.distance - b.distance);
}

export function computeResult(answers: QuizAnswer[], refine: RefineTargets = {}, state?: QuizState): QuizResult {
  const st = state ?? computeState(answers, refine);
  const infl = influences(answers, st.posteriors);

  const axes: AxisResult[] = axisIds.map((axis) => {
    const s = st.axes[axis];
    return {
      axis,
      mean: s.mean,
      sd: s.sd,
      answered: s.answered,
      confidence: confidenceFor(s.sd),
      lowReason: lowReason(s.sd, s.answered, infl[axis]),
      influences: infl[axis],
    };
  });

  const profiles: IssueProfile[] = st.issues
    .filter((i) => i.screenerAnswered)
    .map((i) => ({
      issueId: i.module.id,
      name: i.module.name,
      skipped: i.skipped,
      importance:
        (answers.find((answer) => answer.kind === "choice" && answer.id === i.module.screener.id) as
          | Extract<QuizAnswer, { kind: "choice" }>
          | undefined)?.importance ?? null,
      attributes: [i.module.screener, ...i.module.followUps].flatMap((q) => {
        const v = i.values.get(q.id);
        if (!v) return [];
        return v.optionIds.flatMap((id) => {
          if (id === NO_FIT_OPTION_ID) {
            return [{ questionId: q.id, attribute: q.attribute, stance: "mixed / none of the listed options" }];
          }
          const opt = q.options.find((o) => o.id === id);
          return opt ? [{ questionId: q.id, attribute: q.attribute, stance: opt.stance }] : [];
        });
      }),
    }));

  return {
    axes,
    profiles,
    ideologies: ideologyMatches(axes),
    answeredCount: answers.length,
    complete: st.complete,
    progress: st.progress,
  };
}

export function poleLabel(axis: AxisId, toward: "negative" | "positive"): string {
  return axisById[axis][toward].label;
}
