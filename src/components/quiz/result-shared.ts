// Helpers shared by the results summary and its drill-down views.

import { axes as axisDefs } from "@/lib/quiz/axes";
import { FAMILIES } from "@/lib/quiz/families";
import { verdict, type IdeologyMatch, type QuizResult } from "@/lib/quiz/results";
import type { QuizModeId } from "@/lib/quiz/modes";

// Whose result the page speaks of. Editing rights decide the voice only in
// that the holder reads "you"; anyone else reads neutral wording, never
// "they", since a shared result is still one person's own.
export const marker = (self: boolean) => (self ? "You" : "Profile");

export const BREAK_GAP = 0.35;

export function verdictLine(matches: IdeologyMatch[], self: boolean): string {
  const [top, second] = matches;
  if (!second) return "";
  const lead = top.match - second.match;
  switch (verdict(matches)) {
    case "clear":
      return `A clear fit, ${lead} points ahead of ${second.ideology.name}.`;
    case "lean":
      return `${self ? "You lean" : "Leans"} ${top.ideology.name}, with ${second.ideology.name} close behind.`;
    case "torn":
      return `${self ? "You're torn" : "Torn"} between ${top.ideology.name} and ${second.ideology.name}.`;
  }
}

export const VERDICT_LABEL = { clear: "Clear lead", lean: "Narrow lead", torn: "Close call" } as const;

export function shareTitle(result: QuizResult, canEdit: boolean, mode: QuizModeId): string {
  const top = result.ideologies[0];
  return mode === "quick"
    ? `${canEdit ? "My political snapshot is" : "A political snapshot"} in the ${FAMILIES[top.ideology.family].label} neighborhood`
    : `${canEdit ? "I'm " : ""}${top.match}% ${top.ideology.name}`;
}

// Measured axes only: a checkpoint never asks some (race, before Profile).
export const measuredAxes = (result: QuizResult) => {
  const answered = new Set(result.axes.filter((a) => a.answered > 0).map((a) => a.axis));
  return axisDefs.filter((a) => answered.has(a.id));
};

// The drill-down views behind the summary, each at its own `?view=`.
export type ResultView = "traditions" | "map" | "axes" | "issues";

export function resultViews(result: QuizResult, mode: QuizModeId): { id: ResultView; label: string }[] {
  return [
    ...(mode !== "quick" ? [{ id: "traditions" as const, label: "Closest traditions" }] : []),
    ...(mode === "deep" ? [{ id: "map" as const, label: "Political map" }] : []),
    { id: "axes" as const, label: `${measuredAxes(result).length} axes` },
    ...(mode !== "quick" ? [{ id: "issues" as const, label: "Issue by issue" }] : []),
  ];
}

export const viewHref = (slug: string, view: ResultView, hash?: string) => `/quiz/${slug}?view=${view}${hash ? `#${hash}` : ""}`;

// Overall certainty across measured axes, for the hero's coverage line.
export function overallCertainty(result: QuizResult): "high" | "medium" | "low" {
  const measured = result.axes.filter((a) => a.answered > 0);
  if (measured.length === 0) return "low";
  const high = measured.filter((a) => a.confidence === "high").length / measured.length;
  const low = measured.filter((a) => a.confidence === "low").length / measured.length;
  if (low >= 0.4) return "low";
  return high >= 0.6 ? "high" : "medium";
}
