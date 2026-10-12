// What the quiz-taking UI needs: the next item and recent answers, as plain
// serializable data for the client component.

import {
  computeState,
  nextItem,
  NO_FIT_OPTION_ID,
  primaryAxis,
  questionById,
  statementById,
  type NextItem,
  type QuizAnswer,
  type RefineTargets,
} from "./engine";
import { explainQuestion, explainStatement } from "./explanations";
import { axisById, groupLabel } from "./axes";
import { CONFIDENCE_MEDIUM_SD } from "./results";
import { axisIds } from "./types";

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
      selection: "single" | "multiple";
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
      ...(item.question.selection === "multiple"
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

export function runnerState(answers: QuizAnswer[], refine: RefineTargets, seed: string): RunnerState {
  const state = computeState(answers, refine);
  const next = state.complete ? null : nextItem(answers, state, seed, refine);
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
    issuesTotal: state.issues.length,
    complete: state.complete,
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
