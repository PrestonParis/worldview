// Print a quiz session's full answer log in the form the respondent saw it,
// with how each answer scores against the current bank and the resulting
// axes and top ideology matches.
//
//   npm run quiz:answers -- <slug>            readable transcript
//   npm run quiz:answers -- <slug> --json     raw log plus computed result
//   npm run quiz:answers -- --backfill        save the shown wording on every
//                                             answer that lacks it (run before
//                                             rewording or retiring items)
//
// Reads .env.local; ENV_FILE=.env.cloud targets the cloud database.

import { existsSync } from "node:fs";
import pg from "pg";
import { questionById, statementById, type QuizAnswer } from "../src/lib/quiz/engine";
import { computeResult } from "../src/lib/quiz/results";
import { answerSnapshot } from "../src/lib/quiz/runner";
import { axisById } from "../src/lib/quiz/axes";
import type { Loadings } from "../src/lib/quiz/types";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is not set (${envFile})`);

const args = process.argv.slice(2);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  if (args.includes("--backfill")) await backfill();
  else if (args[0]) await show(args[0], args.includes("--json"));
  else console.error("Usage: npm run quiz:answers -- <slug> [--json] | --backfill");
} finally {
  await client.end();
}

async function backfill() {
  const { rows } = await client.query("select id, slug, answers, updated_at from quiz_sessions");
  let sessions = 0;
  let filled = 0;
  let missing = 0;
  for (const row of rows) {
    let changed = false;
    const answers = (row.answers as QuizAnswer[]).map((a) => {
      if (a.shown) return a;
      // The real answer time is unknown; the session's last save bounds it.
      const shown = answerSnapshot(a, row.updated_at);
      if (!shown) {
        missing++;
        return a;
      }
      changed = true;
      filled++;
      return { ...a, shown };
    });
    if (changed) {
      sessions++;
      await client.query("update quiz_sessions set answers = $1 where id = $2", [JSON.stringify(answers), row.id]);
    }
  }
  console.log(`Backfilled ${filled} answers across ${sessions} sessions (${rows.length} checked).`);
  if (missing) console.log(`${missing} answers reference items no longer in the bank and were left as is.`);
}

function loadings(l: Loadings): string {
  return Object.entries(l)
    .map(([axis, v]) => `${axis} ${v!.location >= 0 ? "+" : ""}${v!.location} ×${v!.weight}`)
    .join(", ");
}

// How the current bank scores an answer, or why it doesn't.
function scoring(a: QuizAnswer): string {
  if (a.value === null) return "skipped, no effect";
  if (a.kind === "statement") {
    const s = statementById.get(a.id);
    return s ? `${s.model}: ${loadings(s.axes)}` : "retired, no effect";
  }
  const q = questionById.get(a.id)?.question;
  if (!q) return "retired, no effect";
  const ids = Array.isArray(a.value) ? a.value : [a.value];
  return ids
    .map((id) => {
      const o = q.options.find((x) => x.id === id);
      return o ? loadings(o.axes) || "no axis loading" : "none fit, no effect";
    })
    .join(" | ");
}

async function show(slug: string, json: boolean) {
  const { rows } = await client.query(
    "select slug, status, bank_version, engine_version, refine, answers, created_at, completed_at from quiz_sessions where slug = $1",
    [slug],
  );
  if (!rows[0]) throw new Error(`No quiz session ${slug}`);
  const session = rows[0];
  const answers = session.answers as QuizAnswer[];
  const result = computeResult(answers, session.refine);

  if (json) {
    console.log(JSON.stringify({ session, result }, null, 2));
    return;
  }

  console.log(
    `Quiz ${session.slug} · ${session.status} · bank ${session.bank_version} · engine ${session.engine_version} · ${answers.length} answers`,
  );
  answers.forEach((a, i) => {
    const shown = a.shown ?? answerSnapshot(a);
    const note = a.shown ? "" : " (wording not saved; current bank shown)";
    console.log(`\n${String(i + 1).padStart(3)}. [${a.kind}] ${a.id}${note}`);
    console.log(`     ${shown?.text ?? "(item no longer in the bank)"}`);
    if (shown?.options) console.log(`     Options: ${shown.options.join(" / ")}`);
    console.log(`     Answer: ${shown?.answer ?? JSON.stringify(a.value)}${shown?.importance ? ` · importance ${shown.importance}` : ""}`);
    console.log(`     Scores: ${scoring(a)}`);
  });

  console.log("\nAxes");
  for (const x of result.axes) {
    const ax = axisById[x.axis];
    const side = Math.abs(x.mean) < 0.05 ? "Center" : x.mean < 0 ? ax.negative.label : ax.positive.label;
    console.log(
      `  ${ax.name.padEnd(28)} ${x.mean >= 0 ? "+" : ""}${x.mean.toFixed(2)} ${side.padEnd(20)} sd ${x.sd.toFixed(2)} ${x.confidence}${x.lowReason ? ` (${x.lowReason})` : ""} · ${x.answered} answers`,
    );
  }
  console.log("\nTop matches");
  for (const m of result.ideologies.slice(0, 8)) console.log(`  ${String(m.match).padStart(3)}%  ${m.ideology.name}`);
}
