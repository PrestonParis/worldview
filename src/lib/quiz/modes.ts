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
    description: "A broad read across the major political dimensions.",
    minutes: "about 5 minutes",
    targetScreens: 24,
    maximumScreens: 28,
    minimumAxisEvidence: 1,
    resultDepth: "snapshot",
  },
  standard: {
    id: "standard",
    name: "Political Profile",
    shortName: "Profile",
    description: "Every dimension, major issues, and ranked political traditions.",
    minutes: "about 14–16 minutes",
    targetScreens: 76,
    maximumScreens: 86,
    minimumAxisEvidence: 3,
    resultDepth: "profile",
  },
  deep: {
    id: "deep",
    name: "Deep Political Map",
    shortName: "Deep map",
    description: "The full issue map, detailed influences, and settled dimensions.",
    minutes: "about 30–40 minutes",
    targetScreens: 145,
    maximumScreens: 200,
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

// Axes measured only from this checkpoint on. Snapshot leaves them out
// entirely, the way it leaves out issue modules with a `minMode`.
const AXIS_MIN_MODE: Partial<Record<AxisId, QuizModeId>> = { race: "standard", violence: "standard" };

export const inMode = (minMode: QuizModeId | undefined, mode: QuizModeId) => !minMode || modeRank(mode) >= modeRank(minMode);

export const modeAxes = (mode: QuizModeId): AxisId[] => axisIds.filter((axis) => inMode(AXIS_MIN_MODE[axis], mode));

export function missingCoverage(
  answered: Record<AxisId, number>,
  mode: QuizModeId,
): AxisId[] {
  const minimum = QUIZ_MODES[mode].minimumAxisEvidence;
  return modeAxes(mode).filter((axis) => answered[axis] < minimum);
}
