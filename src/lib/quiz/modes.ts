import { axisIds, type AxisId, type IssueId } from "./types";

export const quizModeIds = ["quick", "standard", "deep"] as const;
export type QuizModeId = (typeof quizModeIds)[number];

export interface QuizModeConfig {
  id: QuizModeId;
  name: string;
  shortName: string;
  description: string;
  minutes: string;
  targetScreens: number;
  maximumScreens: number;
  minimumAxisEvidence: number;
  resultDepth: "snapshot" | "profile" | "full";
}

export const QUIZ_MODES: Record<QuizModeId, QuizModeConfig> = {
  quick: {
    id: "quick",
    name: "5-Minute Political Snapshot",
    shortName: "Snapshot",
    description: "A broad read across every political dimension.",
    minutes: "about 5 minutes",
    targetScreens: 24,
    maximumScreens: 28,
    minimumAxisEvidence: 1,
    resultDepth: "snapshot",
  },
  standard: {
    id: "standard",
    name: "Complete Political Profile",
    shortName: "Profile",
    description: "Every dimension, major issues, and ranked political traditions.",
    minutes: "about 10–12 minutes",
    targetScreens: 54,
    maximumScreens: 64,
    minimumAxisEvidence: 2,
    resultDepth: "profile",
  },
  deep: {
    id: "deep",
    name: "Deep Political Map",
    shortName: "Deep map",
    description: "The full issue map, detailed influences, and settled dimensions.",
    minutes: "about 20–30 minutes",
    targetScreens: 110,
    maximumScreens: 170,
    minimumAxisEvidence: 5,
    resultDepth: "full",
  },
};

export const nextQuizMode = (mode: QuizModeId): QuizModeId | null =>
  mode === "quick" ? "standard" : mode === "standard" ? "deep" : null;

export const modeRank = (mode: QuizModeId): number => quizModeIds.indexOf(mode);

export function validQuizMode(value: unknown, fallback: QuizModeId = "standard"): QuizModeId {
  return typeof value === "string" && quizModeIds.includes(value as QuizModeId) ? (value as QuizModeId) : fallback;
}

export interface DeferredQuestion {
  kind: "statement" | "choice";
  id: string;
  deferredAtMode: QuizModeId;
  deferCount: number;
}

export interface QuizCheckpointRecord {
  mode: QuizModeId;
  completedAt: string;
  answerCount: number;
}

export interface QuizSelectionContext {
  mode?: QuizModeId;
  deferred?: DeferredQuestion[];
  entryTopic?: IssueId | null;
}

export function missingCoverage(
  answered: Record<AxisId, number>,
  mode: QuizModeId,
): AxisId[] {
  const minimum = QUIZ_MODES[mode].minimumAxisEvidence;
  return axisIds.filter((axis) => answered[axis] < minimum);
}
