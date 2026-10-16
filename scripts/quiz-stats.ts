// Quiz analytics report (src/lib/quiz/analytics.ts), the command-line twin of
// /quiz/stats: what's new, the funnel, item and axis statistics, ideology
// outcomes, and re-estimated engine parameters for retraining.
//
//   npm run quiz:stats                         text report
//   npm run quiz:stats -- --since 7d           "new" = last 7 days (24h, 7d, or an ISO date; default 24h)
//   npm run quiz:stats -- --from 2026-10-15    only sessions started on or after this date
//   npm run quiz:stats -- --mode quick --bank 4.0.0
//   npm run quiz:stats -- --include-flagged    keep test, speeder and straight-line sessions
//   npm run quiz:stats -- --json               the full analysis as JSON
//   npm run quiz:stats -- --export <dir>       responses.csv, sessions.csv, items.json
//
// Reads .env.local; ENV_FILE=.env.cloud targets the cloud database.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is not set (${envFile})`);

const { loadQuizAnalyticsData } = await import("../src/lib/db/quizAnalytics");
const { analyzeQuiz, itemsExport, toCsv, RESPONSE_COLUMNS, SESSION_COLUMNS, MIN_ITEM_N } = await import("../src/lib/quiz/analytics");
const { validQuizMode } = await import("../src/lib/quiz/modes");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

function parseSince(v: string | undefined, now: Date): Date {
  if (!v) return new Date(now.getTime() - 86_400_000);
  const rel = /^(\d+)([hd])$/.exec(v);
  if (rel) return new Date(now.getTime() - Number(rel[1]) * (rel[2] === "h" ? 3_600_000 : 86_400_000));
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`--since: can't read "${v}"`);
  return d;
}

const now = new Date();
const exportDir = value("export");
const { sessions, openers } = await loadQuizAnalyticsData();
const a = analyzeQuiz(sessions, openers, {
  now,
  newSince: parseSince(value("since"), now),
  from: value("from") ? new Date(value("from")!) : null,
  mode: value("mode") ? validQuizMode(value("mode")) : null,
  bank: value("bank") ?? null,
  includeFlagged: flag("include-flagged"),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  withResponses: Boolean(exportDir),
});
// The pg pool would otherwise keep the process alive.
const { db } = await import("../src/lib/db/client");
await db.$client.end();

if (exportDir) {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(path.join(exportDir, "responses.csv"), toCsv(a.responses ?? [], RESPONSE_COLUMNS));
  writeFileSync(path.join(exportDir, "sessions.csv"), toCsv(a.sessions, SESSION_COLUMNS));
  writeFileSync(path.join(exportDir, "items.json"), JSON.stringify(itemsExport(a), null, 2));
  console.log(`Wrote responses.csv (${a.responses?.length ?? 0} answers), sessions.csv (${a.sessions.length}), items.json to ${exportDir}`);
}
if (flag("json")) {
  console.log(JSON.stringify(a, null, 2));
  process.exit(0);
}
if (exportDir) process.exit(0);

// ── Text report ──

const tz = a.filters.timeZone;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const num = (x: number | null, places = 2) => (x === null ? "—" : x.toFixed(places));
const h = (title: string) => console.log(`\n── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);
const o = a.overview;

h("What's new");
console.log(`${o.newCount} new session${o.newCount === 1 ? "" : "s"} since ${when(o.newSince)} · ${o.last24h} in 24h · ${o.last7d} in 7 days`);
for (const s of a.sessions.filter((x) => x.isNew)) {
  const flags = s.flags.length ? ` [${s.flags.join(", ")}]` : "";
  const reached = s.highestCompletedMode ? `reached ${s.highestCompletedMode}` : "no checkpoint";
  const match = s.topMatch ? ` · ${s.topMatch} ${s.topMatchPct}%` : "";
  console.log(`  ${when(s.createdAt)}  ${String(s.answers).padStart(3)} answers  ${s.targetMode.padEnd(8)} ${reached}${match} · ${s.minutes} min${flags}`);
}

h("Overview");
console.log(`${o.sessions} sessions (${o.archived} archived, ${o.claimed} claimed) · ${o.analyzed} analyzed`);
console.log(`Flagged and left out: ${o.flagged.test} test · ${o.flagged.speeder} speeder · ${o.flagged["straight-line"]} straight-line${a.filters.includeFlagged ? " (included: --include-flagged)" : ""}`);
console.log(`Checkpoints: quick ${o.checkpoints.quick} · standard ${o.checkpoints.standard} · deep ${o.checkpoints.deep}`);
console.log(`Answers: ${o.totalAnswers} · median ${num(o.medianAnswers, 0)} per session · ${num(o.medianSecondsPerAnswer, 1)} s each · ${num(o.medianMinutes, 1)} min per session · skip ${pct(o.skipRate)}`);
console.log(`Banks: ${o.banks.map((b) => `${b.version} (${b.count})`).join(", ") || "—"} · retired-item answers ${o.retiredAnswers} · first ${when(o.firstAt)} · last ${when(o.lastAt)}`);

h("Landing page");
const op = a.openers;
console.log(`${op.visits} visits logged · answered 1: ${op.answered[0]} · 2: ${op.answered[1]} · 3: ${op.answered[2]} · started: ${op.started} (${op.startedWithoutOpeners} without openers) · first answer after ${num(op.medianSecondsToFirst, 1)} s`);

h("Funnel");
console.log(`Started by mode: quick ${a.startedByMode.quick} · standard ${a.startedByMode.standard} · deep ${a.startedByMode.deep}`);
console.log("Still going at   " + a.survival.map((s) => String(s.answers).padStart(5)).join(""));
for (const m of ["all", "quick", "standard", "deep"] as const) {
  console.log(`  ${m.padEnd(14)} ` + a.survival.map((s) => pct(s.byMode[m]).padStart(5)).join(""));
}
if (a.abandonment.length) {
  console.log("Last answer before leaving:");
  for (const x of a.abandonment.slice(0, 8)) console.log(`  ${String(x.count).padStart(3)}  ${x.id}  ${x.text.slice(0, 70)}`);
}

h("Engine parameters (re-estimated)");
for (const p of a.parameters) {
  const fit = p.fitted ? `${p.fitted.estimate}${p.edge ? " (edge of search range)" : ""} (95% ${p.fitted.lo}…${p.fitted.hi}) · ΔLL ${num(p.gain)}` : "not enough data";
  console.log(`  ${p.name.padEnd(18)} current ${p.current} · fitted ${fit} · n ${p.n}`);
}

h("Axes");
console.log("  axis            n   mean  spread  post.sd  reliab  settled  conflict  dispersion");
for (const x of a.axes) {
  console.log(
    `  ${x.axis.padEnd(14)} ${String(x.n).padStart(3)}  ${num(x.mean).padStart(5)}  ${num(x.spread).padStart(6)}  ${num(x.meanPosteriorSd).padStart(7)}  ${num(x.reliability).padStart(6)}  ${pct(x.settledShare).padStart(7)}  ${pct(x.conflictShare).padStart(8)}  ${num(x.dispersion).padStart(10)}`,
  );
}
const strong = a.correlations.filter((c) => Math.abs(c.r) >= 0.5);
if (strong.length) console.log("Strong axis correlations: " + strong.slice(0, 8).map((c) => `${c.a}×${c.b} r=${c.r} (n ${c.n})`).join(" · "));

h(`Statements (${a.statements.length} answered; fit statistics from n ≥ ${MIN_ITEM_N})`);
const measured = a.statements.filter((s) => s.outfit !== null);
console.log("  id                  n  skip   mean  item-r  resid  outfit  location → fitted");
for (const s of measured.slice(0, 40)) {
  const fit = s.fittedLocation ? `${s.location} → ${s.fittedLocation.estimate} [${s.fittedLocation.lo}…${s.fittedLocation.hi}]` : `${s.location}`;
  console.log(
    `  ${s.id.padEnd(18)} ${String(s.answered).padStart(3)}  ${pct(s.skipRate).padStart(4)}  ${num(s.mean).padStart(5)}  ${num(s.itemRest).padStart(6)}  ${num(s.residual).padStart(5)}  ${num(s.outfit).padStart(6)}  ${fit}`,
  );
}
const thin = a.statements.length - measured.length;
if (thin) console.log(`  …and ${thin} statements with fewer than ${MIN_ITEM_N} answers (counts in --json / --export)`);

h(`Choice questions (${a.choices.length} answered)`);
for (const c of a.choices.slice(0, 15)) {
  const top = [...c.options].sort((x, y) => y.picks - x.picks).slice(0, 3).map((x) => `${x.text.slice(0, 28)} ${pct(x.share)}`).join(" · ");
  console.log(`  ${c.id.padEnd(34)} n ${String(c.shown).padStart(3)} · skip ${c.skips} · none-fit ${c.noneFit}${c.reach !== null ? ` · reach ${pct(c.reach)}` : ""}  ${top}`);
}

h(`Ideology outcomes (${a.ideologies.n} sessions with a result)`);
const io = a.ideologies;
console.log(`Verdicts: clear ${io.verdicts.clear} · lean ${io.verdicts.lean} · torn ${io.verdicts.torn} · no ideology above 50%: ${io.far.n}`);
console.log("Top matches: " + (io.top.slice(0, 10).map((t) => `${t.name} ${t.count}`).join(" · ") || "—"));
console.log(`Never in anyone's top 3: ${io.never.length} of ${io.never.length + io.topThree.length} ideologies`);
if (io.far.n) console.log("Centroid of poorly matched respondents: " + Object.entries(io.far.centroid).map(([k, v]) => `${k} ${v}`).join(", "));

h("Retraining suggestions");
if (!a.suggestions.length) console.log("  None yet: suggestions need n ≥ 30 per item and a clear likelihood gain.");
for (const s of a.suggestions.slice(0, 30)) console.log(`  ${s.kind.padEnd(19)} ${s.target.padEnd(22)} ${s.detail} · n ${s.n}${s.gain !== null ? ` · ΔLL ${s.gain}` : ""}`);
console.log("");
