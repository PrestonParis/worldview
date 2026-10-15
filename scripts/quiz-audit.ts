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
import { issues } from "../src/lib/quiz/bank";
import { quizModeIds } from "../src/lib/quiz/modes";

const CLOSE = 0.15;
const RANDOM_RESPONDENTS = 30;
const MODE_RESPONDENTS = 10;

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

const questions = issues.flatMap((issue) => [issue.screener, ...issue.followUps]);
console.log(`Question formats: ${questions.filter((q) => q.selection === "checklist").length} checklists · ${questions.filter((q) => q.selection === "multiple").length} ordinary multi-select`);

console.log("\nMode checkpoints");
for (const mode of quizModeIds) {
  let total = 0;
  let axisError = 0;
  let top1 = 0;
  let top3 = 0;
  for (let i = 0; i < MODE_RESPONDENTS; i++) {
    const respondent = randomRespondent(`mode-audit:${i}`);
    const full = simulate(respondent, `mode-audit:${i}`, 400, "deep");
    const partial = mode === "deep" ? full : simulate(respondent, `mode-audit:${i}`, 400, mode);
    const fullResult = computeResult(full.answers);
    const result = computeResult(partial.answers);
    const fullTop = fullResult.ideologies[0].ideology.id;
    total += partial.steps;
    axisError += axisIds.reduce((sum, axis) => sum + Math.abs(result.axes.find((a) => a.axis === axis)!.mean - respondent.truth[axis]), 0) / axisIds.length;
    if (result.ideologies[0].ideology.id === fullTop) top1++;
    if (result.ideologies.slice(0, 3).some((match) => match.ideology.id === fullTop)) top3++;
  }
  console.log(
    `  ${mode.padEnd(8)} ${Math.round(total / MODE_RESPONDENTS)} screens · axis error ${(axisError / MODE_RESPONDENTS).toFixed(3)} · full top retained top-1 ${Math.round((100 * top1) / MODE_RESPONDENTS)}%, top-3 ${Math.round((100 * top3) / MODE_RESPONDENTS)}%`,
  );
}
