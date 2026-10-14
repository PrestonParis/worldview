// Can the quiz tell its ideologies apart? Reports, for the current bank and
// catalog:
//   - each ideology's nearest neighbour on the axes, flagging close pairs that
//     no lens separates;
//   - self-rank: a simulated respondent placed on each ideology (answering
//     lens questions as it would) should rank it first;
//   - match calibration and simulated accuracy, the baseline for tuning.
//
//   npm run quiz:audit

import { computeState } from "../src/lib/quiz/engine";
import { computeResult } from "../src/lib/quiz/results";
import { randomRespondent, simulate, type Respondent } from "../src/lib/quiz/sim";
import { ideologies } from "../src/lib/quiz/ideologies";
import { acceptedLens } from "../src/lib/quiz/lenses";
import { axisIds, lensIds, type Ideology } from "../src/lib/quiz/types";

const CLOSE = 0.15;
const RANDOM_RESPONDENTS = 30;

const rms = (a: Ideology, b: Ideology) =>
  Math.sqrt(axisIds.reduce((s, x) => s + (a.position[x] - b.position[x]) ** 2, 0) / axisIds.length);

const lensDiffers = (a: Ideology, b: Ideology) =>
  lensIds.some((l) => {
    const x = acceptedLens(a, l);
    const y = acceptedLens(b, l);
    return x && y && !x.some((v) => y.includes(v));
  });

console.log(`${ideologies.length} ideologies · ${axisIds.length} axes\n`);

console.log(`Close pairs (RMS < ${CLOSE})`);
let unseparated = 0;
for (const [i, a] of ideologies.entries()) {
  for (const b of ideologies.slice(i + 1)) {
    const d = rms(a, b);
    if (d >= CLOSE) continue;
    const sep = lensDiffers(a, b);
    if (!sep) unseparated++;
    console.log(`  ${d.toFixed(3)}  ${a.name} ≈ ${b.name}${sep ? "  (lens separates)" : ""}`);
  }
}

console.log("\nSelf-rank misses");
let top1 = 0;
let top3 = 0;
const dist = { self: 0, top: 0, tenth: 0, median: 0 };
for (const [k, ideology] of ideologies.entries()) {
  const lens = Object.fromEntries(lensIds.flatMap((l) => {
    const v = acceptedLens(ideology, l);
    return v ? [[l, v]] : [];
  }));
  const r: Respondent = { truth: { ...ideology.position }, noise: 1, skipRate: 0.03, lens };
  const { answers } = simulate(r, `audit:${k}`);
  const res = computeResult(answers);
  const rank = res.ideologies.findIndex((m) => m.ideology.id === ideology.id) + 1;
  if (rank === 1) top1++;
  if (rank <= 3) top3++;
  if (rank > 1) console.log(`  #${rank} ${ideology.name} (beaten by ${res.ideologies.slice(0, rank - 1).map((m) => m.ideology.name).join(", ")})`);
  const d = res.ideologies.map((m) => m.distance);
  dist.self += res.ideologies[rank - 1].distance;
  dist.top += d[0];
  dist.tenth += d[9];
  dist.median += d[Math.floor(d.length / 2)];
}

let err = 0;
let steps = 0;
for (let i = 0; i < RANDOM_RESPONDENTS; i++) {
  const r = randomRespondent(`audit-random:${i}`);
  const run = simulate(r, `audit-random:${i}`);
  const st = computeState(run.answers);
  steps += run.steps;
  err += axisIds.reduce((s, a) => s + Math.abs(st.axes[a].mean - r.truth[a]), 0) / axisIds.length;
}

const n = ideologies.length;
console.log(`\nSelf-rank: top-1 ${top1}/${n} (${Math.round((100 * top1) / n)}%), top-3 ${top3}/${n}`);
console.log(`Close pairs no lens separates: ${unseparated}`);
console.log(
  `Distances (calibrate MATCH_FLOOR/CEILING): on self ${(dist.self / n).toFixed(3)}, top ${(dist.top / n).toFixed(3)}, 10th ${(dist.tenth / n).toFixed(3)}, median ${(dist.median / n).toFixed(3)}`,
);
console.log(`Random respondents: mean axis error ${(err / RANDOM_RESPONDENTS).toFixed(3)}, ${Math.round(steps / RANDOM_RESPONDENTS)} answers on average`);
