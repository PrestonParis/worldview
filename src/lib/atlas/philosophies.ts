import { axes, axisById } from "../quiz/axes";
import { allTraditions, ideologies } from "../quiz/ideologies";
import { acceptedLens, LENS_NAMES, LENS_VALUE_LABELS } from "../quiz/lenses";
import { lensIds, type AxisId, type Ideology } from "../quiz/types";
import { HISTORY, type TraditionHistory } from "./history";

export type PhilosophyKind = "philosophy" | "political tradition" | "movement" | "regime tradition" | "religious-political tradition";
export type PhilosophyScope = "comprehensive" | "economic" | "governance" | "social" | "international";

export interface PhilosophyProfile {
  ideology: Ideology;
  kind: PhilosophyKind;
  scopes: PhilosophyScope[];
  questions: { label: string; answer: string }[];
  // Categorical positions (the quiz lenses), in the values a tradition accepts.
  lenses: { label: string; answer: string }[];
  history: TraditionHistory;
}

const ECONOMIC = new Set([
  "anarcho-communism", "marxism-leninism", "libertarian-socialism", "democratic-socialism", "market-socialism", "eco-socialism",
  "social-democracy", "third-way", "neoliberalism", "abundance-liberalism", "georgism", "fiscal-conservatism", "distributism",
  "libertarianism", "classical-liberalism", "minarchism", "anarcho-capitalism", "left-libertarianism", "state-capitalism",
  "developmentalism", "anarcho-syndicalism", "mutualism", "objectivism",
]);
const GOVERNANCE = new Set(["technocracy", "monarchism", "neoreaction", "military-rule", "constitutional-monarchism", "world-federalism"]);
const RELIGIOUS = new Set([
  "christian-democracy", "christian-right", "christian-nationalism", "integralism", "islamism", "islamic-democracy", "khomeinism",
  "theonomy", "clerical-fascism", "hindutva", "religious-zionism", "buddhist-nationalism", "nation-of-islam", "christian-left",
  "christian-anarchism", "sikh-nationalism", "salafi-jihadism",
]);
const MOVEMENTS = new Set([
  "american-progressivism", "green-politics", "left-populism", "right-populism", "black-nationalism", "pan-africanism",
  "bolivarianism", "peronism", "kemalism", "national-conservatism", "christian-nationalism", "hindutva", "religious-zionism",
  "buddhist-nationalism", "effective-accelerationism", "tech-right", "white-nationalism", "chicano-nationalism",
  "indigenous-sovereignty", "ados", "antiracism", "patriot-movement", "radical-feminism", "zionism", "sikh-nationalism",
  "groyper",
]);

function kindOf(id: string): PhilosophyKind {
  if (RELIGIOUS.has(id)) return "religious-political tradition";
  if (GOVERNANCE.has(id)) return "regime tradition";
  if (MOVEMENTS.has(id)) return "movement";
  return ECONOMIC.has(id) ? "philosophy" : "political tradition";
}

function scopesOf(ideology: Ideology): PhilosophyScope[] {
  const core = new Set(ideology.core ?? []);
  const out: PhilosophyScope[] = [];
  if (ECONOMIC.has(ideology.id) || ["ownership", "regulation", "redistribution", "trade"].filter((x) => core.has(x as AxisId)).length >= 2) out.push("economic");
  if (["federalism", "executive", "liberty", "voting", "democracy", "violence"].some((x) => core.has(x as AxisId))) out.push("governance");
  if (["social", "religion", "immigration", "justice", "identity", "race"].some((x) => core.has(x as AxisId))) out.push("social");
  if (["engagement", "force"].some((x) => core.has(x as AxisId))) out.push("international");
  if (out.length >= 3 || out.length === 0) out.unshift("comprehensive");
  return [...new Set(out)];
}

function stance(ideology: Ideology, axis: AxisId): string {
  const def = axisById[axis];
  const value = ideology.position[axis];
  if (Math.abs(value) < 0.2) return `Balances ${def.negative.label.toLowerCase()} and ${def.positive.label.toLowerCase()} approaches.`;
  const pole = value < 0 ? def.negative : def.positive;
  const strength = Math.abs(value) >= 0.7 ? "Strongly favors" : "Leans toward";
  return `${strength} ${pole.label.toLowerCase()}: ${pole.description}`;
}

// The written profile: every axis, grouped into questions a reader would ask.
export const PROFILE_QUESTIONS: { label: string; axes: AxisId[] }[] = [
  { label: "Political authority", axes: ["democracy", "executive"] },
  { label: "Rights & elections", axes: ["liberty", "voting", "federalism"] },
  { label: "Political violence", axes: ["violence"] },
  { label: "Property & ownership", axes: ["ownership"] },
  { label: "Economic coordination", axes: ["regulation"] },
  { label: "Justice & distribution", axes: ["redistribution"] },
  { label: "Nation & the world", axes: ["trade", "engagement", "force"] },
  { label: "Social order & religion", axes: ["social", "religion"] },
  { label: "Immigration", axes: ["immigration"] },
  { label: "Crime & punishment", axes: ["justice"] },
  { label: "Race", axes: ["identity", "race"] },
  { label: "Technology & environment", axes: ["environment", "technology"] },
];

function questions(ideology: Ideology) {
  return PROFILE_QUESTIONS.map((q) => ({ label: q.label, answer: q.axes.map((a) => stance(ideology, a)).join(" ") }));
}

function lenses(ideology: Ideology) {
  return lensIds.map((lens) => {
    const values = acceptedLens(ideology, lens);
    const labels = LENS_VALUE_LABELS[lens];
    return { label: LENS_NAMES[lens], answer: values ? values.map((v) => labels[v] ?? v).join(", ") : "No set position" };
  });
}

export const philosophyProfiles: PhilosophyProfile[] = allTraditions.map((ideology) => ({
  ideology,
  kind: kindOf(ideology.id),
  scopes: scopesOf(ideology),
  questions: questions(ideology),
  lenses: lenses(ideology),
  history: HISTORY[ideology.id],
}));

export const philosophyById = new Map(philosophyProfiles.map((x) => [x.ideology.id, x]));

export function nearestPhilosophies(ideology: Ideology, n = 4): Ideology[] {
  const core = ideology.core?.length ? ideology.core : axes.map((x) => x.id);
  return ideologies
    .filter((x) => x.id !== ideology.id)
    .map((x) => ({ ideology: x, distance: Math.sqrt(core.reduce((sum, axis) => sum + (x.position[axis] - ideology.position[axis]) ** 2, 0) / core.length) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n)
    .map((x) => x.ideology);
}
