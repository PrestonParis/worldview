import Link from "next/link";
import { AXIS_GROUPS, axes as axisDefs, axisById } from "@/lib/quiz/axes";
import {
  poleLabel,
  verdict,
  VERDICT_CLEAR_LEAD,
  type AxisComparison,
  type AxisResult,
  type IdeologyMatch,
  type QuizResult,
} from "@/lib/quiz/results";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { LENS_NAMES, LENS_VALUE_LABELS } from "@/lib/quiz/lenses";
import { ideologyMap, placeRespondent } from "@/lib/quiz/map";
import { ideologies } from "@/lib/quiz/ideologies";
import { continueQuizAction, refineAxisAction, reviewDeferredAction, sharpenAction, startQuizAction } from "@/lib/actions/quiz";
import { ROUND_SIZES, type SharpenOutcome } from "@/lib/quiz/refine";
import type { AxisId, IdeologyFamily } from "@/lib/quiz/types";
import { nextQuizMode, QUIZ_MODES, type QuizModeId } from "@/lib/quiz/modes";
import { QuizShareButton } from "./quiz-share";

const GROUPS = AXIS_GROUPS;

const FEATURED = 3;
const LISTED = 10;
const CONVICTIONS = 3;
const BREAKS = 3;
const BREAK_GAP = 0.35;
const BEYOND_MIN = 0.4;

export const RESULT_SECTIONS = [
  { id: "defines", label: "What defines you" },
  { id: "map", label: "The map" },
  { id: "matches", label: "Closest matches" },
  { id: "positions", label: "Your positions" },
  { id: "issues", label: "Issue by issue" },
] as const;

const pos = (x: number) => `${((Math.max(-1, Math.min(1, x)) + 1) / 2) * 100}%`;

const cardClass =
  "scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-800 dark:bg-slate-950";
const eyebrowClass = "text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase";
const h2Class = "text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl dark:text-white";

// Lowercase a pole label mid-sentence, leaving proper nouns ("America First").
const lc = (label: string) => (/\s[A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

// Where a value sits on an axis, in words.
function stanceWord(axis: AxisId, x: number): string {
  const def = axisById[axis];
  if (Math.abs(x) < 0.15) return `Between ${lc(def.negative.label)} and ${lc(def.positive.label)}`;
  const pole = x < 0 ? def.negative.label : def.positive.label;
  const a = Math.abs(x);
  if (a >= 0.75) return `Strongly ${lc(pole)}`;
  if (a >= 0.4) return pole;
  return `Leaning ${lc(pole)}`;
}

function verdictLine(matches: IdeologyMatch[], you: "you" | "they"): string {
  const [top, second] = matches;
  if (!second) return "";
  const lead = top.match - second.match;
  switch (verdict(matches)) {
    case "clear":
      return `A clear fit, ${lead} points ahead of ${second.ideology.name}.`;
    case "lean":
      return `${you === "you" ? "You lean" : "They lean"} ${top.ideology.name}, with ${second.ideology.name} close behind.`;
    case "torn":
      return `${you === "you" ? "You're" : "They're"} torn between ${top.ideology.name} and ${second.ideology.name}.`;
  }
}

function FamilyChip({ family }: { family: IdeologyFamily }) {
  const color = familyColor(family);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {FAMILIES[family].label}
    </span>
  );
}

function MatchRing({ value, color, animate }: { value: number; color: string; animate: boolean }) {
  return (
    <div className="relative size-36 shrink-0 sm:size-44">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - value}
          className={animate ? "quiz-reveal-ring" : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-5xl dark:text-white">
          {value}%
        </span>
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">similarity</span>
      </div>
    </div>
  );
}

export function QuizHero({
  slug,
  result,
  canEdit,
  reveal,
  sharpened,
  mode,
  checkpointComplete,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  reveal: boolean;
  sharpened?: SharpenOutcome;
  mode: QuizModeId;
  checkpointComplete: boolean;
}) {
  const top = result.ideologies[0];
  const color = familyColor(top.ideology.family);
  const anim = (cls: string) => (reveal ? cls : "");
  const changed = !!sharpened && sharpened.was.id !== top.ideology.id;
  const snapshot = mode === "quick";
  const intro = canEdit
    ? checkpointComplete
      ? changed
        ? "Your ideology is now"
        : mode === "quick"
          ? "Your current political neighborhood"
          : "Your closest political tradition"
      : "So far, your ideology is"
    : "Their ideology is";

  return (
    <section
      id="top"
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-10 sm:px-12 sm:py-14 dark:border-slate-800 dark:bg-slate-950"
      style={{
        backgroundImage: `radial-gradient(ellipse 80% 90% at 0% 0%, ${color}38, transparent 60%), radial-gradient(ellipse 60% 70% at 100% 100%, ${color}1f, transparent 65%)`,
      }}
    >
      {canEdit && sharpened && result.complete && <SharpenedRibbon outcome={sharpened} top={top} />}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold tracking-[0.2em] uppercase ${anim("quiz-reveal-intro")}`} style={{ color }}>
            {intro}
          </p>
          <h1
            className={`mt-3 text-5xl leading-[1.02] font-bold tracking-tight text-balance text-slate-950 sm:text-7xl dark:text-white ${anim("quiz-reveal-name")}`}
          >
            {snapshot ? `${FAMILIES[top.ideology.family].label} neighborhood` : top.ideology.name}
          </h1>
          <div className={anim("quiz-reveal-rest")}>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <FamilyChip family={top.ideology.family} />
              <span className="text-sm text-slate-600 dark:text-slate-300">{verdictLine(result.ideologies, canEdit ? "you" : "they")}</span>
            </div>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700 dark:text-slate-200">
              {snapshot
                ? `Your closest signals currently point toward ${result.ideologies.slice(0, 3).map((match) => match.ideology.name).join(", ")}. A longer profile can distinguish among them.`
                : top.ideology.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <QuizShareButton
                title={snapshot ? `My political snapshot is in the ${FAMILIES[top.ideology.family].label} neighborhood` : `${canEdit ? "I'm" : "They're"} ${top.match}% ${top.ideology.name}`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: color, boxShadow: `0 10px 30px -10px ${color}` }}
              />
              {canEdit && !result.complete && (
                <Link
                  href={`/quiz/${slug}`}
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {result.roundLeft > 0 ? `Finish sharpening · ${result.roundLeft} left` : "Continue the quiz"}
                </Link>
              )}
              {canEdit && result.complete && (
                <form action={sharpenAction.bind(null, slug, ROUND_SIZES[0])}>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {sharpened ? "Go another round" : "Sharpen your result"}
                    <span className="ml-2 font-normal opacity-70">+{ROUND_SIZES[0]} questions</span>
                  </button>
                </form>
              )}
              {canEdit && (
                <form action={startQuizAction}>
                  <input type="hidden" name="mode" value={mode} />
                  <button
                    type="submit"
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    Retake
                  </button>
                </form>
              )}
              <span className="text-xs text-slate-400">Based on {result.answeredCount} answers</span>
            </div>
          </div>
        </div>
        {!snapshot && (
          <div className={`self-center ${anim("quiz-reveal-intro")}`}>
            <MatchRing value={top.match} color={color} animate={reveal} />
          </div>
        )}
      </div>
    </section>
  );
}

export function QuizCheckpoint({
  slug,
  mode,
  complete,
  deferredCount,
}: {
  slug: string;
  mode: QuizModeId;
  complete: boolean;
  deferredCount: number;
}) {
  const next = nextQuizMode(mode);
  if (!complete && deferredCount === 0) return null;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className={eyebrowClass}>{complete ? `${QUIZ_MODES[mode].shortName} complete` : "Current result"}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
            {next ? `Keep this result or continue to the ${QUIZ_MODES[next].shortName.toLowerCase()}.` : "Your full political map is complete."}
          </h2>
          {deferredCount > 0 && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {deferredCount} skipped {deferredCount === 1 ? "question is" : "questions are"} available to review.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {deferredCount > 0 && (
            <form action={reviewDeferredAction.bind(null, slug)}>
              <button type="submit" className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Review skipped
              </button>
            </form>
          )}
          {complete && next && (
            <form action={continueQuizAction.bind(null, slug, next)}>
              <button type="submit" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Continue · {QUIZ_MODES[next].minutes} →
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// What a sharpen round changed, shown on the reveal that follows it.
function SharpenedRibbon({ outcome, top }: { outcome: SharpenOutcome; top: IdeologyMatch }) {
  const changed = outcome.was.id !== top.ideology.id;
  const delta = top.match - outcome.was.match;
  return (
    <div className="quiz-reveal-intro mb-8 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <span className="font-semibold text-slate-950 dark:text-white">
        {changed ? "Your result changed" : delta === 0 ? "Your result held" : `Your result ${delta > 0 ? "firmed up" : "loosened"}`}
      </span>
      <span className="text-slate-600 tabular-nums dark:text-slate-300">
        {changed ? (
          <>
            <span className="line-through decoration-slate-400">{outcome.was.name} {outcome.was.match}%</span>
            {" → "}
            {top.ideology.name} {top.match}%
          </>
        ) : (
          <>
            {top.ideology.name} {outcome.was.match}% → {top.match}%
          </>
        )}
      </span>
      <span className="text-xs text-slate-400">after {outcome.round} more answers</span>
    </div>
  );
}

// The invitation to keep going once the quiz is done: a round of extra
// questions aimed at whatever would most change the result.
function SharpenCard({ slug, result }: { slug: string; result: QuizResult }) {
  const [a, b] = result.ideologies;
  const lead = a.match - b.match;
  const unsure = result.axes.filter((x) => x.confidence !== "high").length;
  const heading = {
    torn: `${a.ideology.name} or ${b.ideology.name}? Settle it.`,
    lean: `Close the gap between ${a.ideology.name} and ${b.ideology.name}`,
    clear: `Sharpen your ${a.ideology.name} result`,
  }[verdict(result.ideologies)];
  return (
    <section id="sharpen" className={cardClass}>
      <p className={eyebrowClass}>Keep going</p>
      <h2 className={`${h2Class} mt-1 text-balance`}>{heading}</h2>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
        {lead < VERDICT_CLEAR_LEAD
          ? `Your top two are ${lead === 0 ? "tied" : `${lead} ${lead === 1 ? "point" : "points"} apart`}. `
          : ""}
        Extra questions go to the positions where your closest matches disagree most
        {unsure > 0 ? `, and to the ${unsure} ${unsure === 1 ? "axis" : "axes"} where your answers are least certain` : ""}.
        Your results update the moment you finish, and you&apos;ll see what changed.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ROUND_SIZES.map((size, i) => (
          <form key={size} action={sharpenAction.bind(null, slug, size)}>
            <button
              type="submit"
              className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
                i === 0
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700 dark:border-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  : "border-slate-200 text-slate-900 hover:border-slate-400 dark:border-slate-800 dark:text-slate-100 dark:hover:border-slate-600"
              }`}
            >
              <span>
                <span className="block font-semibold">{i === 0 ? "Quick round" : "Deep round"}</span>
                <span className="block text-sm opacity-70">
                  {size} questions · about {Math.round(size / 4)} min
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Or open any axis under <a href="#positions" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">Your positions</a> to refine just that one.
      </p>
    </section>
  );
}

export function QuizResults({ slug, result, canEdit, mode }: { slug: string; result: QuizResult; canEdit: boolean; mode: QuizModeId }) {
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));
  const top = result.ideologies[0];
  const accent = familyColor(top.ideology.family);
  return (
    <div className="space-y-8">
      <DefinesYou result={result} canEdit={canEdit} accent={accent} />
      {mode === "deep" && <IdeologyMapSection result={result} canEdit={canEdit} />}

      {mode !== "quick" && <section id="matches" className={cardClass}>
        <p className={eyebrowClass}>Closest matches</p>
        <h2 className={`${h2Class} mt-1`}>{canEdit ? "The traditions closest to you" : "The closest traditions"}</h2>
        <ol className="mt-6 space-y-3">
          {result.ideologies.slice(0, FEATURED).map((m, i) => (
            <IdeologyRow key={m.ideology.id} rank={i + 1} match={m} featured />
          ))}
        </ol>
        <ol className="mt-3 space-y-2">
          {result.ideologies.slice(FEATURED, LISTED).map((m, i) => (
            <IdeologyRow key={m.ideology.id} rank={FEATURED + i + 1} match={m} />
          ))}
        </ol>
        <details className="group/all mt-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
            <span className="group-open/all:hidden">Show all {result.ideologies.length} →</span>
            <span className="hidden group-open/all:inline">Hide</span>
          </summary>
          <ol className="mt-3 space-y-2">
            {result.ideologies.slice(LISTED).map((m, i) => (
              <IdeologyRow key={m.ideology.id} rank={LISTED + i + 1} match={m} />
            ))}
          </ol>
        </details>
      </section>}

      {canEdit && result.complete && <SharpenCard slug={slug} result={result} />}

      <section id="positions" className={cardClass}>
        <p className={eyebrowClass}>{canEdit ? "Your positions" : "Positions"}</p>
        <h2 className={`${h2Class} mt-1`}>18 axes</h2>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 bg-white dark:bg-slate-950" style={{ borderColor: accent }} />
            {canEdit ? "You" : "Them"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rotate-45 border border-slate-400 dark:border-slate-500" />
            {top.ideology.name}
          </span>
          <span>Tap an axis to see which answers put {canEdit ? "you" : "them"} there.</span>
        </p>
        <div className="mt-6 space-y-10">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <p className={eyebrowClass}>{g.label}</p>
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-900">
                {axisDefs
                  .filter((a) => a.group === g.id)
                  .map((a) => (
                    <AxisRow
                      key={a.id}
                      slug={slug}
                      result={byAxis.get(a.id)!}
                      canEdit={canEdit}
                      accent={accent}
                      reference={top.ideology.position[a.id]}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {mode !== "quick" && <IssuesSection slug={slug} result={result} canEdit={canEdit} />}
    </div>
  );
}

function MiniTrack({ you, them, color }: { you: number; them?: number; color: string }) {
  return (
    <div className="relative h-3">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ left: you < 0 ? pos(you) : "50%", right: you < 0 ? "50%" : `calc(100% - ${pos(you)})`, backgroundColor: color }}
      />
      {them !== undefined && (
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.5px] border-slate-500 bg-white dark:border-slate-400 dark:bg-slate-950"
          style={{ left: pos(them) }}
        />
      )}
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white dark:bg-slate-950"
        style={{ left: pos(you), borderColor: color }}
      />
    </div>
  );
}

function DefinesYou({ result, canEdit, accent }: { result: QuizResult; canEdit: boolean; accent: string }) {
  const top = result.ideologies[0];
  const convictions = [...result.axes]
    .filter((a) => a.confidence !== "low")
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, CONVICTIONS);
  const breaks = [...top.comparisons]
    .filter((c) => c.gap >= BREAK_GAP)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, BREAKS);
  // When nothing breaks, show what the ideology doesn't speak to: strong
  // positions on axes outside its core.
  const shown = new Set(convictions.map((a) => a.axis));
  const core = new Set(top.ideology.core ?? axisDefs.map((a) => a.id));
  const beyond = [...result.axes]
    .filter((a) => !core.has(a.axis) && !shown.has(a.axis))
    .filter((a) => a.confidence !== "low" && Math.abs(a.mean) >= BEYOND_MIN)
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, BREAKS + 1);

  return (
    <section id="defines" className={cardClass}>
      <p className={eyebrowClass}>What defines {canEdit ? "you" : "them"}</p>
      <h2 className={`${h2Class} mt-1`}>{canEdit ? "Your strongest convictions" : "Strongest convictions"}</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {convictions.map((a) => {
          const def = axisById[a.axis];
          const pole = a.mean < 0 ? def.negative : def.positive;
          return (
            <div
              key={a.axis}
              className="rounded-2xl border p-5"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0d` }}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{def.name}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: accent }}>
                {pole.label}
              </p>
              <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">{pole.description}</p>
              <div className="mt-4">
                <MiniTrack you={a.mean} color={accent} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mt-10 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
        Where {canEdit ? "you break" : "they break"} from {top.ideology.name}
      </h3>
      {breaks.length === 0 ? (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Nowhere: {canEdit ? "you line" : "they line"} up with {top.ideology.name} on every axis it defines.
            {beyond.length > 0 && ` Where ${canEdit ? "you go" : "they go"} beyond it:`}
          </p>
          {beyond.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {beyond.map((a) => (
                <span
                  key={a.axis}
                  className="rounded-full border px-3.5 py-1.5 text-sm"
                  style={{ borderColor: `${accent}55`, backgroundColor: `${accent}12` }}
                >
                  <span className="text-slate-500 dark:text-slate-400">{axisById[a.axis].name}: </span>
                  <span className="font-semibold" style={{ color: accent }}>
                    {stanceWord(a.axis, a.mean)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <ul className="mt-4 space-y-4">
          {breaks.map((c) => (
            <BreakRow key={c.axis} comparison={c} ideologyName={top.ideology.name} accent={accent} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BreakRow({
  comparison: c,
  ideologyName,
  accent,
  canEdit,
}: {
  comparison: AxisComparison;
  ideologyName: string;
  accent: string;
  canEdit: boolean;
}) {
  const def = axisById[c.axis];
  return (
    <li className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
      <div>
        <p className="font-medium text-slate-900 dark:text-slate-100">{def.name}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold" style={{ color: accent }}>
            {canEdit ? "You" : "They"}: {stanceWord(c.axis, c.you)}
          </span>
          <span className="text-slate-400"> · </span>
          {ideologyName}: {stanceWord(c.axis, c.them)}
        </p>
      </div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="truncate text-right">{def.negative.label}</span>
        <MiniTrack you={c.you} them={c.them} color={accent} />
        <span className="truncate">{def.positive.label}</span>
      </div>
    </li>
  );
}

// ── Ideology map ──

const MAP_W = 640;
const MAP_H = 440;
const MAP_PAD = 28;
const mx = (x: number) => MAP_PAD + ((x + 1) / 2) * (MAP_W - 2 * MAP_PAD);
const my = (y: number) => MAP_PAD + ((1 - y) / 2) * (MAP_H - 2 * MAP_PAD);
const MAP_LABELED = 5;

function IdeologyMapSection({ result, canEdit }: { result: QuizResult; canEdit: boolean }) {
  const ranked = result.ideologies.slice(0, MAP_LABELED);
  const rankOf = new Map(ranked.map((m, i) => [m.ideology.id, i + 1]));
  const you = placeRespondent(result.ideologies);
  const accent = familyColor(result.ideologies[0].ideology.family);
  const families = Object.keys(FAMILIES) as IdeologyFamily[];

  return (
    <section id="map" className={cardClass}>
      <p className={eyebrowClass}>The map</p>
      <h2 className={`${h2Class} mt-1`}>Where {canEdit ? "you sit" : "they sit"} among {ideologies.length} traditions</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900/60"
          role="img"
          aria-label="Map of ideologies"
        >
          <line x1={mx(0)} x2={mx(0)} y1={MAP_PAD / 2} y2={MAP_H - MAP_PAD / 2} className="stroke-slate-200 dark:stroke-slate-800" />
          <line x1={MAP_PAD / 2} x2={MAP_W - MAP_PAD / 2} y1={my(0)} y2={my(0)} className="stroke-slate-200 dark:stroke-slate-800" />
          <g className="fill-slate-400 text-[11px] font-semibold tracking-wider uppercase dark:fill-slate-500">
            <text x={MAP_PAD / 2 + 2} y={my(0) - 6}>Progressive</text>
            <text x={MAP_W - MAP_PAD / 2 - 2} y={my(0) - 6} textAnchor="end">Traditional</text>
            <text x={mx(0) + 6} y={MAP_PAD / 2 + 8}>Free market</text>
            <text x={mx(0) + 6} y={MAP_H - MAP_PAD / 2 - 2}>State-directed</text>
          </g>
          {ideologies
            .filter((i) => !rankOf.has(i.id))
            .map((i) => {
              const p = ideologyMap[i.id];
              return (
                <circle key={i.id} cx={mx(p.x)} cy={my(p.y)} r={5} fill={familyColor(i.family)} fillOpacity={0.7}>
                  <title>{i.name}</title>
                </circle>
              );
            })}
          {[...ranked].reverse().map((m) => {
            const p = ideologyMap[m.ideology.id];
            const rank = rankOf.get(m.ideology.id)!;
            return (
              <g key={m.ideology.id}>
                <title>{`${rank}. ${m.ideology.name} · ${m.match}%`}</title>
                <circle
                  cx={mx(p.x)}
                  cy={my(p.y)}
                  r={10}
                  fill={familyColor(m.ideology.family)}
                  className="stroke-white dark:stroke-slate-900"
                  strokeWidth={2}
                />
                <text x={mx(p.x)} y={my(p.y) + 3.5} textAnchor="middle" className="fill-white text-[10px] font-bold">
                  {rank}
                </text>
              </g>
            );
          })}
          <g>
            <circle cx={mx(you.x)} cy={my(you.y)} r={14} fill="none" stroke={accent} strokeWidth={2}>
              <animate attributeName="r" values="12;22;12" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={mx(you.x)} cy={my(you.y)} r={7} stroke={accent} strokeWidth={3} className="fill-white dark:fill-slate-950" />
            <rect
              x={mx(you.x) - 22}
              y={my(you.y) - 42}
              width={44}
              height={20}
              rx={10}
              fill={accent}
            />
            <text x={mx(you.x)} y={my(you.y) - 28} textAnchor="middle" className="fill-white text-[12px] font-bold">
              {canEdit ? "You" : "Them"}
            </text>
          </g>
        </svg>
        <div className="space-y-5">
          <ol className="space-y-2">
            {ranked.map((m, i) => (
              <li key={m.ideology.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: familyColor(m.ideology.family) }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{m.ideology.name}</span>
                <span className="text-slate-500 tabular-nums dark:text-slate-400">{m.match}%</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {families.map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: familyColor(f) }} />
                {FAMILIES[f].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Axes ──

function AxisRow({
  slug,
  result,
  canEdit,
  accent,
  reference,
}: {
  slug: string;
  result: AxisResult;
  canEdit: boolean;
  accent: string;
  reference?: number;
}) {
  const def = axisById[result.axis];
  const lo = result.mean - result.sd;
  const hi = result.mean + result.sd;
  const refine = refineAxisAction.bind(null, slug, result.axis);
  return (
    <details className="group py-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium text-slate-900 dark:text-slate-100">{def.name}</span>
          <span className="flex items-baseline gap-2 text-sm">
            {result.confidence !== "high" && <ConfidenceBadge result={result} />}
            <span className="font-medium" style={{ color: accent }}>
              {stanceWord(result.axis, result.mean)}
            </span>
            <svg
              viewBox="0 0 16 16"
              className="size-3.5 self-center text-slate-400 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)_6rem] items-center gap-3 text-xs sm:grid-cols-[9rem_minmax(0,1fr)_9rem]">
          <span className="text-right text-slate-500 dark:text-slate-400">{def.negative.label}</span>
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-800/80" />
            <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-slate-300 dark:bg-slate-700" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{
                left: result.mean < 0 ? pos(result.mean) : "50%",
                right: result.mean < 0 ? "50%" : `calc(100% - ${pos(result.mean)})`,
                backgroundColor: accent,
              }}
            />
            <div
              className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full"
              style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, backgroundColor: `${accent}26` }}
            />
            {reference !== undefined && (
              <div
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.5px] border-slate-500 bg-white dark:border-slate-400 dark:bg-slate-950"
                style={{ left: pos(reference) }}
              />
            )}
            <div
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white shadow-sm dark:bg-slate-950"
              style={{ left: pos(result.mean), borderColor: accent }}
            />
          </div>
          <span className="text-slate-500 dark:text-slate-400">{def.positive.label}</span>
        </div>
      </summary>

      <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
        {result.confidence === "low" && (
          <p className="text-slate-600 dark:text-slate-300">
            {result.lowReason === "mixed"
              ? "Your answers on this axis pointed in both directions."
              : "This axis has too few answers to place you precisely."}
          </p>
        )}
        <p className={eyebrowClass}>Why {canEdit ? "you" : "they"} landed here</p>
        {result.influences.length === 0 ? (
          <p className="text-slate-500">No answers have moved this axis yet.</p>
        ) : (
          <ul className="space-y-2">
            {result.influences.map((inf) => (
              <li key={inf.answerIndex} className="leading-snug">
                <span className="font-medium text-slate-800 dark:text-slate-100">{inf.answerLabel}</span>
                {inf.kind === "statement" ? ": " : " — "}
                <span className="text-slate-600 dark:text-slate-300">“{inf.text}”</span>
                <span className="ml-1 whitespace-nowrap text-slate-400">→ toward {poleLabel(result.axis, inf.toward)}</span>
                {canEdit && (
                  <Link
                    href={`/quiz/${slug}?edit=${inf.kind}:${inf.itemId}`}
                    className="ml-2 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    change
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && result.confidence !== "high" && (
          <form action={refine}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950"
            >
              Answer 4 more questions to refine this
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

function ConfidenceBadge({ result }: { result: AxisResult }) {
  const styles = {
    high: "",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    low: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  } as const;
  const label = { high: "", medium: "Medium confidence", low: "Low confidence" } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[result.confidence]}`}>{label[result.confidence]}</span>;
}

// ── Ideology ranking ──

function IdeologyRow({ rank, match, featured = false }: { rank: number; match: IdeologyMatch; featured?: boolean }) {
  const color = familyColor(match.ideology.family);
  return (
    <li>
      <details
        className={`group/ideology overflow-hidden border border-slate-200 dark:border-slate-800 ${
          featured ? "rounded-2xl" : "rounded-xl"
        }`}
        style={featured ? { borderLeft: `4px solid ${color}` } : undefined}
      >
        <summary className={`flex cursor-pointer list-none gap-4 ${featured ? "items-start px-5 py-5" : "items-center px-4 py-3"}`}>
          <span
            className={`shrink-0 text-right font-semibold tabular-nums ${featured ? "w-7 text-2xl" : "w-6 text-xs text-slate-400"}`}
            style={featured ? { color } : undefined}
          >
            {rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className={`font-semibold text-slate-900 dark:text-slate-100 ${featured ? "text-xl" : ""}`}>
                {match.ideology.name}
              </span>
              {featured && <FamilyChip family={match.ideology.family} />}
            </span>
            {featured ? (
              <span className="mt-1.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{match.ideology.description}</span>
            ) : (
              <span className="block truncate text-xs text-slate-500 group-open/ideology:hidden dark:text-slate-400">
                {match.ideology.description}
              </span>
            )}
          </span>
          <span className={`flex shrink-0 items-center gap-2.5 ${featured ? "w-36 self-center" : "w-28"}`}>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full" style={{ width: `${match.match}%`, backgroundColor: color }} />
            </span>
            <span
              className={`text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100 ${featured ? "w-12 text-lg" : "w-9 text-sm"}`}
            >
              {match.match}%
            </span>
          </span>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          {!featured && <p className="text-sm text-slate-600 dark:text-slate-300">{match.ideology.description}</p>}
          <p className={`${eyebrowClass} ${featured ? "" : "mt-3"}`}>Axis by axis</p>
          <ul className="mt-3 space-y-2.5">
            {match.comparisons.map((c) => {
              const def = axisById[c.axis];
              return (
                <li key={c.axis} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-300">{def.name}</span>
                  <div title={`${def.negative.label} ↔ ${def.positive.label}`}>
                    <MiniTrack you={c.you} them={c.them} color={color} />
                  </div>
                  <span className="text-right text-slate-400 tabular-nums" title="Agreement on this axis">
                    {c.agreement}%
                  </span>
                </li>
              );
            })}
          </ul>
          {match.lenses.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              {match.lenses.map((l) => {
                const labels = LENS_VALUE_LABELS[l.lens];
                return (
                  <li key={l.lens} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{LENS_NAMES[l.lens]}</span>
                    <span className="truncate text-slate-500 dark:text-slate-400">
                      {l.match ? labels[l.you] : `${labels[l.you]} vs. ${l.accepted.map((v) => labels[v]).join(" or ")}`}
                    </span>
                    <span className={`text-right font-medium ${l.match ? "text-slate-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {l.match ? "Same" : "Differs"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

// ── Issues ──

function IssuesSection({ slug, result, canEdit }: { slug: string; result: QuizResult; canEdit: boolean }) {
  return (
    <section id="issues" className={cardClass}>
      <p className={eyebrowClass}>Issue by issue</p>
      <h2 className={`${h2Class} mt-1`}>Where {canEdit ? "you stand" : "they stand"} on the issues</h2>
      {result.profiles.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No issues answered yet.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {result.profiles.map((p) => (
            <details key={p.issueId} className="group/issue rounded-2xl border border-slate-200 dark:border-slate-800">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {p.skipped ? "Skipped" : capitalize(p.attributes[0]?.stance ?? "")}
                  </span>
                  {p.importance && !p.skipped && (
                    <span className="mt-1 block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {p.importance === 1 ? "Low" : p.importance === 2 ? "Medium" : "High"} importance
                    </span>
                  )}
                </span>
                {!p.skipped && (
                  <svg
                    viewBox="0 0 16 16"
                    className="size-4 shrink-0 text-slate-400 transition-transform group-open/issue:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </summary>
              {!p.skipped && (
                <dl className="space-y-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                  {groupByQuestion(p.attributes).map((g) => {
                    const chip = "inline-block rounded-lg px-2.5 py-1 text-sm leading-snug";
                    return (
                      <div key={g.questionId}>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">{g.attribute}</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                          {g.stances.map((stance, i) =>
                            canEdit ? (
                              <Link
                                key={i}
                                href={`/quiz/${slug}?edit=choice:${g.questionId}`}
                                className={`${chip} bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`}
                                title="Change this answer"
                              >
                                {capitalize(stance)}
                              </Link>
                            ) : (
                              <span key={i} className={`${chip} bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100`}>
                                {capitalize(stance)}
                              </span>
                            ),
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Checklists and multiple selections give one stance per item; show them
// under a single label.
function groupByQuestion(attributes: QuizResult["profiles"][number]["attributes"]) {
  const groups: { questionId: string; attribute: string; stances: string[] }[] = [];
  for (const a of attributes) {
    const last = groups.at(-1);
    if (last?.questionId === a.questionId) last.stances.push(a.stance);
    else groups.push({ questionId: a.questionId, attribute: a.attribute, stances: [a.stance] });
  }
  return groups;
}

// Sticky identity card and jump nav beside the results.
export function QuizSidebar({ slug, result, canEdit, mode }: { slug: string; result: QuizResult; canEdit: boolean; mode: QuizModeId }) {
  const top = result.ideologies[0];
  const color = familyColor(top.ideology.family);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <a href="#top" className="block">
        <p className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color }}>
          {canEdit ? "Your ideology" : "Ideology"}
        </p>
        <p className="mt-1 text-lg leading-tight font-bold tracking-tight text-slate-950 dark:text-white">{top.ideology.name}</p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <span className="block h-full rounded-full" style={{ width: `${top.match}%`, backgroundColor: color }} />
          </span>
          <span className="text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">{top.match}%</span>
        </div>
      </a>
      <QuizShareButton
        title={`${canEdit ? "I'm" : "They're"} ${top.match}% ${top.ideology.name}`}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: color }}
      />
      {canEdit && result.complete && (
        <form action={sharpenAction.bind(null, slug, ROUND_SIZES[0])}>
          <button
            type="submit"
            className="mt-2 w-full rounded-full border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            Sharpen · +{ROUND_SIZES[0]} questions
          </button>
        </form>
      )}
      <nav className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <ul className="space-y-0.5 text-sm">
          {RESULT_SECTIONS.filter((s) => mode === "deep" || (mode === "standard" ? s.id !== "map" : ["defines", "positions"].includes(s.id))).map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
