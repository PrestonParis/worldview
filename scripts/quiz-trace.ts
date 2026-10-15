// Print the item order a simulated respondent placed on an ideology sees.
//   npm run quiz:trace -- <ideology-id>
import { simulate } from "../src/lib/quiz/sim";
import { ideologies } from "../src/lib/quiz/ideologies";
import { acceptedLens } from "../src/lib/quiz/lenses";
import { questionById, statementById } from "../src/lib/quiz/engine";
import { lensIds } from "../src/lib/quiz/types";

const id = process.argv[2] ?? "marxism-leninism";
const ideology = ideologies.find((i) => i.id === id)!;
const lens = Object.fromEntries(lensIds.flatMap((l) => { const v = acceptedLens(ideology, l); return v ? [[l, v]] : []; }));
const { answers } = simulate({ truth: { ...ideology.position }, noise: 1, skipRate: 0, lens }, `trace:${id}`);
let s = 0, c = 0;
answers.forEach((a, i) => {
  if (a.kind === "statement") s++; else c++;
  const text = a.kind === "statement" ? statementById.get(a.id)!.text : questionById.get(a.id)!.question.prompt;
  const tag = a.kind === "statement" ? "S" : questionById.get(a.id)!.isScreener ? "SCR" : "F";
  console.log(`${String(i + 1).padStart(3)} ${tag.padEnd(3)} ${a.id.padEnd(32)} ${JSON.stringify(a.value).padEnd(14)} ${text.slice(0, 80)}`);
});
console.log(`\n${ideology.name}: ${answers.length} answers (${s} statements, ${c} choices)`);
