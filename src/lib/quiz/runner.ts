// What the quiz-taking UI needs: the next item and recent answers, as plain
// serializable data for the client component.

import {
  computeState,
  modeComplete,
  nextItem,
  NO_FIT_OPTION_ID,
  primaryAxis,
  questionById,
  statementById,
  type AnswerSnapshot,
  type NextItem,
  type QuizAnswer,
  type RefineTargets,
  roundLeft,
} from "./engine";
import { explainQuestion, explainStatement } from "./explanations";
import { axisById, groupLabel } from "./axes";
import { CONFIDENCE_MEDIUM_SD } from "./results";
import { axisIds, type IssueId } from "./types";
import { retiredStatements } from "./bank";
import { QUIZ_MODES, type DeferredQuestion, type QuizModeId } from "./modes";

// `area` and `topic` say what a question is about (never which way an answer
// scores): an axis group and axis for statements, an issue and its policy
// attribute for choices.
export type RunnerItem =
  | { kind: "statement"; id: string; text: string; explanation: string; area: string; topic: string }
  | {
      kind: "choice";
      id: string;
      prompt: string;
      explanation: string;
      area: string;
      topic: string;
      issue: string;
      isScreener: boolean;
      selection: "single" | "multiple" | "checklist";
      options: { id: string; text: string; exclusive: boolean }[];
    };

export interface AnsweredItem {
  item: RunnerItem;
  value: number | string | string[] | null;
  importance?: 1 | 2 | 3;
}

export interface RunnerState {
  next: RunnerItem | null;
  recent: AnsweredItem[]; // newest last, for "Back"
  answeredCount: number;
  // Axes with a stable reading (results would show at least medium
  // confidence), and issues whose questions are all answered.
  axesMeasured: number;
  axesTotal: number;
  issuesDone: number;
  issuesTotal: number;
  complete: boolean;
  // 0…1 toward this mode's result: share of the target screens for the
  // shorter modes, share of axes and issues settled for the deep map.
  progress: number;
  mode: QuizModeId;
  modeName: string;
  targetScreens: number;
  deferredCount: number;
  // Questions left in a "sharpen your result" round: refine targets on a
  // quiz that's otherwise finished. 0 outside one.
  refineLeft: number;
}

const RECENT = 15;
const MEASURED_MIN_ANSWERS = 3;

function serializeNext(item: NextItem): RunnerItem {
  if (item.kind === "statement") {
    const axis = axisById[primaryAxis(item.statement)];
    return {
      kind: "statement",
      id: item.statement.id,
      text: item.statement.text,
      explanation: explainStatement(item.statement),
      area: groupLabel(axis.group),
      topic: axis.name,
    };
  }
  return {
    kind: "choice",
    id: item.question.id,
    prompt: item.question.prompt,
    explanation: explainQuestion(item.question, item.module),
    area: item.module.name,
    topic: item.question.attribute,
    issue: item.module.name,
    isScreener: item.isScreener,
    selection: item.question.selection ?? "single",
    options: [
      ...item.question.options.map((o) => ({ id: o.id, text: o.text, exclusive: o.exclusive ?? false })),
      ...(item.question.selection === "multiple" || item.question.selection === "checklist"
        ? []
        : [{ id: NO_FIT_OPTION_ID, text: "Mixed / none of these fits", exclusive: false }]),
    ],
  };
}

export function serializeItem(kind: QuizAnswer["kind"], id: string): RunnerItem | null {
  if (kind === "statement") {
    const s = statementById.get(id);
    return s ? serializeNext({ kind: "statement", statement: s }) : null;
  }
  const q = questionById.get(id);
  return q ? serializeNext({ kind: "choice", ...q }) : null;
}

export function runnerState(
  answers: QuizAnswer[],
  refine: RefineTargets,
  seed: string,
  mode: QuizModeId = "deep",
  deferred: DeferredQuestion[] = [],
  entryTopic: IssueId | null = null,
): RunnerState {
  const state = computeState(answers, refine);
  const complete = modeComplete(state, answers.length, mode);
  const next = complete ? null : nextItem(answers, state, seed, refine, { mode, deferred, entryTopic });
  const recent = answers.slice(-RECENT).flatMap((a) => {
    const item = serializeItem(a.kind, a.id);
    return item ? [{ item, value: a.value, importance: a.kind === "choice" ? a.importance : undefined }] : [];
  });
  return {
    next: next ? serializeNext(next) : null,
    recent,
    answeredCount: answers.length,
    axesMeasured: axisIds.filter((a) => {
      const s = state.axes[a];
      return s.settled || (s.answered >= MEASURED_MIN_ANSWERS && s.sd < CONFIDENCE_MEDIUM_SD);
    }).length,
    axesTotal: axisIds.length,
    issuesDone: state.issues.filter((i) => i.screenerAnswered && i.pending.length === 0).length,
    issuesTotal: state.issues.filter((i) => !i.excluded).length,
    complete,
    progress: complete ? 1 : mode === "deep" ? state.progress : Math.min(0.97, answers.length / QUIZ_MODES[mode].targetScreens),
    mode,
    modeName: QUIZ_MODES[mode].shortName,
    targetScreens: mode === "deep" ? 0 : QUIZ_MODES[mode].targetScreens,
    deferredCount: deferred.length,
    refineLeft: roundLeft(state),
  };
}

const RESPONSE_LABELS: Record<number, string> = {
  [-3]: "Strongly disagree",
  [-2]: "Disagree",
  [-1]: "Somewhat disagree",
  0: "Neutral",
  1: "Somewhat agree",
  2: "Agree",
  3: "Strongly agree",
};
const IMPORTANCE_LABELS = { 1: "Low", 2: "Medium", 3: "High" } as const;

// What the respondent saw and picked, rendered from the bank as it stands
// when the answer is saved. Null for an item no longer in the bank (retired
// statements keep their wording).
export function answerSnapshot(answer: QuizAnswer, at: Date = new Date()): AnswerSnapshot | null {
  const item = serializeItem(answer.kind, answer.id);
  const retired = answer.kind === "statement" ? retiredStatements[answer.id] : undefined;
  if (!item && !retired) return null;
  if (!item || item.kind === "statement") {
    const v = answer.value as number | null;
    return { text: item?.text ?? retired!, answer: v === null ? "Skipped" : RESPONSE_LABELS[v], at: at.toISOString() };
  }
  const ids = answer.value === null ? [] : Array.isArray(answer.value) ? answer.value : [answer.value];
  const chosen = ids.map((id) => item.options.find((o) => o.id === id)?.text ?? id);
  const importance = answer.kind === "choice" && answer.importance ? IMPORTANCE_LABELS[answer.importance] : undefined;
  return {
    text: item.prompt,
    options: item.options.map((o) => o.text),
    answer: chosen.length ? chosen.join("; ") : "Skipped",
    ...(importance ? { importance } : {}),
    at: at.toISOString(),
  };
}

// Replace an existing answer in place (editing keeps its position in the
// log), or append a new one.
export function applyAnswer(answers: QuizAnswer[], answer: QuizAnswer): QuizAnswer[] {
  const i = answers.findIndex((a) => a.kind === answer.kind && a.id === answer.id);
  if (i === -1) return [...answers, answer];
  const copy = answers.slice();
  copy[i] = answer;
  return copy;
}
