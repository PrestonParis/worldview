// What the quiz-taking UI needs: the next item and recent answers, as plain
// serializable data for the client component.

import {
  computeState,
  nextItem,
  NO_FIT_OPTION_ID,
  questionById,
  statementById,
  type NextItem,
  type QuizAnswer,
  type RefineTargets,
} from "./engine";
import { explainQuestion, explainStatement } from "./explanations";

export type RunnerItem =
  | { kind: "statement"; id: string; text: string; explanation: string }
  | {
      kind: "choice";
      id: string;
      prompt: string;
      explanation: string;
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
  progress: number;
  complete: boolean;
}

const RECENT = 15;

function serializeNext(item: NextItem): RunnerItem {
  if (item.kind === "statement") {
    return {
      kind: "statement",
      id: item.statement.id,
      text: item.statement.text,
      explanation: explainStatement(item.statement),
    };
  }
  return {
    kind: "choice",
    id: item.question.id,
    prompt: item.question.prompt,
    explanation: explainQuestion(item.question, item.module),
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
    progress: state.progress,
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
