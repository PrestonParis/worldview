// How well the shorter checkpoints anticipate the full Deep result, and how
// quickly each one narrows a respondent down.
//   npm run quiz:funnel
//
// Two populations: random respondents, and respondents placed near a real
// tradition (its position plus noise, answering its lens questions), which
// is closer to how real people cluster.

import { computeResult, ideologyMatches, type AxisResult } from "../src/lib/quiz/results";
import { randomRespondent, simulate, type Respondent } from "../src/lib/quiz/sim";
import { ideologies } from "../src/lib/quiz/ideologies";
import { acceptedLens } from "../src/lib/quiz/lenses";
import { axisIds, lensIds } from "../src/lib/quiz/types";

const N = Number(process.env.FUNNEL_N ?? 150);

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function nearTradition(i: number, spread = 0.3): Respondent {
  const rand = seeded(`near:${i}`);
  const t = ideologies[Math.floor(rand() * ideologies.length)];
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const truth = Object.fromEntries(axisIds.map((a) => [a, Math.max(-1, Math.min(1, t.position[a] + spread * gauss()))])) as Respondent["truth"];
  const lens = Object.fromEntries(lensIds.flatMap((l) => { const v = acceptedLens(t, l); return v ? [[l, v]] : []; }));
  return { truth, noise: 1, skipRate: 0.03, lens };
}

// Halfway between two traditions of different families, answering lens
// questions as the first would.
function between(i: number): Respondent {
  const rand = seeded(`between:${i}`);
  const a = ideologies[Math.floor(rand() * ideologies.length)];
  const others = ideologies.filter((x) => x.family !== a.family);
  const b = others[Math.floor(rand() * others.length)];
  const truth = Object.fromEntries(axisIds.map((x) => [x, (a.position[x] + b.position[x]) / 2])) as Respondent["truth"];
  const lens = Object.fromEntries(lensIds.flatMap((l) => { const v = acceptedLens(a, l); return v ? [[l, v]] : []; }));
  return { truth, noise: 1, skipRate: 0.03, lens };
}

const STEPS = [8, 12, 16, 20, 24];
const populations: [string, (i: number) => Respondent][] = [
  ["random", (i) => randomRespondent(`funnel:${i}`)],
  ["near a tradition", (i) => nearTradition(i)],
  ["between two families", between],
];
for (const [label, make] of populations) {
  const stats = { quick: { family: 0, top3: 0 }, standard: { family: 0, top3: 0 } };
  const along = STEPS.map(() => ({ family: 0, top3: 0 }));
  for (let i = 0; i < N; i++) {
    const r = make(i);
    // The tradition closest to the respondent's true positions and lens
    // answers: fixed, whatever order the quiz asks in.
    const exact = axisIds.map((axis) => ({ axis, mean: r.truth[axis], sd: 0.05, answered: 5, confidence: "high", lowReason: null, influences: [] }) as AxisResult);
    const lens = Object.fromEntries(Object.entries(r.lens ?? {}).map(([l, v]) => [l, v![0]]));
    const deep = ideologyMatches(exact, lens)[0].ideology;
    for (const mode of ["quick", "standard"] as const) {
      const answers = simulate(r, `funnel:${label}:${i}`, 400, mode).answers;
      const top = computeResult(answers).ideologies;
      if (top[0].ideology.family === deep.family) stats[mode].family++;
      if (top.slice(0, 3).some((m) => m.ideology.id === deep.id)) stats[mode].top3++;
      if (mode === "quick") {
        STEPS.forEach((k, j) => {
          const t = computeResult(answers.slice(0, k)).ideologies;
          if (t[0].ideology.family === deep.family) along[j].family++;
          if (t.slice(0, 3).some((m) => m.ideology.id === deep.id)) along[j].top3++;
        });
      }
    }
  }
  const pct = (x: number) => `${Math.round((100 * x) / N)}%`;
  console.log(`${label} (${N})`);
  for (const mode of ["quick", "standard"] as const) {
    console.log(`  ${mode.padEnd(8)} family matches truth ${pct(stats[mode].family)} · true #1 in top 3 ${pct(stats[mode].top3)}`);
  }
  console.log(`  quick, after k answers: ${STEPS.map((k, j) => `${k}: ${pct(along[j].family)} family / ${pct(along[j].top3)} top 3`).join(" · ")}`);
}
