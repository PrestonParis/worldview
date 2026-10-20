import { describe, expect, it } from "vitest";
import { questionsLeft, secondsPerAnswer } from "./runner";
import type { QuizAnswer } from "./engine";
import { QUIZ_MODES } from "./modes";

const at = (seconds: number[]): QuizAnswer[] =>
  seconds.map((s, i) => ({ kind: "statement", id: `x.${i}`, value: 0, shown: { text: "", answer: "", at: new Date(s * 1000).toISOString() } }));

describe("finish forecast", () => {
  it("uses the mode's published pace until there are enough answers", () => {
    expect(secondsPerAnswer(at([0, 10]), "standard")).toBe(12);
  });

  it("uses the median gap between answers and ignores breaks", () => {
    expect(secondsPerAnswer(at([0, 8, 16, 26, 1000, 1008]), "standard")).toBe(8);
  });

  it("counts down to the checkpoint target, never below one", () => {
    expect(questionsLeft(20, 0.4, "standard", 0)).toBe(QUIZ_MODES.standard.targetScreens - 20);
    expect(questionsLeft(QUIZ_MODES.standard.targetScreens + 5, 0.97, "standard", 0)).toBe(1);
  });

  it("extrapolates the Deep map from progress, within its screen cap", () => {
    expect(questionsLeft(50, 0.5, "deep", 0)).toBe(50);
    expect(questionsLeft(5, 0.05, "deep", 0)).toBe(140);
  });

  it("follows a sharpen round's remaining count", () => {
    expect(questionsLeft(130, 1, "deep", 6)).toBe(6);
  });
});
