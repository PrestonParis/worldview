import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
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
import { placeRespondent } from "@/lib/quiz/map";
import { ideologies, umbrellaOf } from "@/lib/quiz/ideologies";
import { continueQuizAction, refineAxisAction, reviewDeferredAction, sharpenAction, startQuizAction } from "@/lib/actions/quiz";
import { ROUND_SIZES, type SharpenOutcome } from "@/lib/quiz/refine";
import type { AxisId } from "@/lib/quiz/types";
import { nextQuizMode, QUIZ_MODES, type QuizModeId } from "@/lib/quiz/modes";
import { everyChurchQuizUrl } from "@/lib/atlas/everychurch";
import { QuizShareButton } from "./quiz-share";
import { ResultsMap } from "./results-map";
import { ResultsIssues } from "./results-issues";
import type { NavGroup } from "./results-nav";
import {
  body,
  btnPrimary,
  btnSecondary,
  btnTertiary,
  ConfidenceMeter,
  FamilyChip,
  h3,
  LabeledTrack,
  meta,
  Section,
  SectionHeader,
  small,
  textLink,
  ThemMarker,
  tile,
  Track,
  YouMarker,
} from "./results-ui";

const LISTED = 10;
const CONVICTIONS = 3;
const BREAKS = 3;
const BREAK_GAP = 0.35;
const BEYOND_MIN = 0.4;

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

export function shareTitle(result: QuizResult, canEdit: boolean, mode: QuizModeId): string {
  const top = result.ideologies[0];
  return mode === "quick"
    ? `My political snapshot is in the ${FAMILIES[top.ideology.family].label} neighborhood`
    : `${canEdit ? "I'm" : "They're"} ${top.match}% ${top.ideology.name}`;
}

// Measured axes only: a checkpoint never asks some (race, before Profile).
const measuredAxes = (result: QuizResult) => {
  const answered = new Set(result.axes.filter((a) => a.answered > 0).map((a) => a.axis));
  return axisDefs.filter((a) => answered.has(a.id));
};

// The table of contents, in reading order: overview, the map and matches,
// detailed positions, then where to go next.
export function resultNav(result: QuizResult, canEdit: boolean, mode: QuizModeId): NavGroup[] {
  const groups: NavGroup[] = [
    { label: "Overview", items: [{ id: "defines", label: canEdit ? "What defines you" : "What defines them" }] },
    {
      label: "Political map",
      items: [...(mode === "deep" ? [{ id: "map", label: "The map" }] : []), ...(mode !== "quick" ? [{ id: "matches", label: "Closest matches" }] : [])],
    },
    {
      label: "Detailed positions",
      items: [{ id: "positions", label: `${measuredAxes(result).length} axes` }, ...(mode !== "quick" ? [{ id: "issues", label: "Issue by issue" }] : [])],
    },
    { label: "Explore further", items: [{ id: "explore", label: "Where to go next" }] },
  ];
  return groups.filter((g) => g.items.length > 0);
}

// ── Hero ──

function MatchRing({ value, color, animate }: { value: number; color: string; animate: boolean }) {
  return (
    <div className="relative size-24 shrink-0 sm:size-32">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - value}
          className={animate ? "quiz-reveal-ring" : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-4xl dark:text-white">{value}%</span>
        <span className="text-[11px] font-medium text-slate-600 sm:text-xs dark:text-slate-400">similarity</span>
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
  footer,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  reveal: boolean;
  sharpened?: SharpenOutcome;
  mode: QuizModeId;
  checkpointComplete: boolean;
  footer?: ReactNode;
}) {
  const top = result.ideologies[0];
  const color = familyColor(top.ideology.family);
  const anim = (cls: string) => (reveal ? cls : "");
  const changed = !!sharpened && sharpened.was.id !== top.ideology.id;
  const snapshot = mode === "quick";
  const intro = canEdit
    ? checkpointComplete
      ? changed
        ? "Your closest tradition is now"
        : snapshot
          ? "Your current political neighborhood"
          : "Your closest political tradition"
      : "So far, your closest tradition is"
    : "Their closest political tradition";
  const others = snapshot ? result.ideologies.slice(0, 3) : result.ideologies.slice(1, 4);
  const umbrella = umbrellaOf(top.ideology.id);
  // The page only opens the runner for an unfinished checkpoint or a sharpen
  // round in progress; past a checkpoint, moving on is the footer's Continue.
  const incomplete = canEdit && (!checkpointComplete || result.roundLeft > 0);

  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(56rem 22rem at 0% 0%, ${color}21, transparent 70%)` }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
        <div className="min-w-0">
          {canEdit && sharpened && result.complete && <SharpenedStatus outcome={sharpened} top={top} />}
          <div className="flex items-center gap-4 sm:gap-6">
            {!snapshot && (
              <div className={anim("quiz-reveal-intro")}>
                <MatchRing value={top.match} color={color} animate={reveal} />
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-sm font-medium text-slate-600 dark:text-slate-300 ${anim("quiz-reveal-intro")}`}>{intro}</p>
              <h1
                className={`mt-1 text-3xl leading-[1.05] font-bold tracking-tight text-balance text-slate-950 sm:text-5xl xl:text-6xl dark:text-white ${anim("quiz-reveal-name")}`}
              >
                {snapshot ? `${FAMILIES[top.ideology.family].label} neighborhood` : top.ideology.name}
              </h1>
              <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${anim("quiz-reveal-rest")}`}>
                <FamilyChip family={top.ideology.family} />
                {!snapshot && <span className="text-sm text-slate-700 dark:text-slate-300">{verdictLine(result.ideologies, canEdit ? "you" : "they")}</span>}
              </div>
              {!snapshot && umbrella && (
                <p className={`mt-1.5 text-sm text-slate-600 dark:text-slate-400 ${anim("quiz-reveal-rest")}`}>
                  Part of the broader{" "}
                  <Link href={`/atlas/philosophies/${umbrella.id}`} className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:text-slate-200 dark:decoration-slate-600">
                    {umbrella.name}
                  </Link>{" "}
                  tradition.
                </p>
              )}
            </div>
          </div>
          <div className={anim("quiz-reveal-rest")}>
            <p className={`mt-5 max-w-3xl ${body}`}>
              {snapshot
                ? `Your closest signals point toward ${result.ideologies.slice(0, 3).map((m) => m.ideology.name).join(", ")}. A longer profile can tell them apart.`
                : top.ideology.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {incomplete && (
                <Link href={`/quiz/${slug}?take=1`} className={btnPrimary}>
                  {result.roundLeft > 0 ? `Finish sharpening · ${result.roundLeft} left` : "Continue the quiz"}
                  <ArrowRight size={15} aria-hidden />
                </Link>
              )}
              <QuizShareButton title={shareTitle(result, canEdit, mode)} className={incomplete ? btnSecondary : btnPrimary} />
              {canEdit && result.complete && (
                <form action={sharpenAction.bind(null, slug, ROUND_SIZES[0])}>
                  <button type="submit" className={btnSecondary}>
                    {sharpened ? "Go another round" : "Sharpen result"}
                    <span className="font-normal text-slate-500 dark:text-slate-400">+{ROUND_SIZES[0]}</span>
                  </button>
                </form>
              )}
              {canEdit && (
                <form action={startQuizAction}>
                  <input type="hidden" name="mode" value={mode} />
                  <button type="submit" className={btnTertiary}>
                    Retake
                  </button>
                </form>
              )}
              <span className={`${small} ml-1`}>Based on {result.answeredCount} answers</span>
            </div>
          </div>
        </div>

        <div className={`self-start rounded-xl border border-slate-200 bg-white/75 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 ${anim("quiz-reveal-rest")}`}>
          <p className={small}>{snapshot ? "Closest signals" : "Next closest"}</p>
          <ol className="mt-2 space-y-3">
            {others.map((m, i) => {
              const row = (
                <>
                  <span className="flex items-baseline gap-2 text-sm">
                    <span className="w-4 shrink-0 text-slate-500 tabular-nums dark:text-slate-400">{snapshot ? i + 1 : i + 2}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{m.ideology.name}</span>
                    {!snapshot && <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">{m.match}%</span>}
                  </span>
                  {!snapshot && (
                    <span className="mt-1 ml-6 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="block h-full rounded-full" style={{ width: `${m.match}%`, backgroundColor: familyColor(m.ideology.family) }} />
                    </span>
                  )}
                </>
              );
              return (
                <li key={m.ideology.id}>
                  {snapshot ? row : <a href={`#match-${m.ideology.id}`} className="block rounded-md hover:opacity-80">{row}</a>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {footer}
    </section>
  );
}

// What a sharpen round changed: a secondary status line above the result.
function SharpenedStatus({ outcome, top }: { outcome: SharpenOutcome; top: IdeologyMatch }) {
  const changed = outcome.was.id !== top.ideology.id;
  const delta = top.match - outcome.was.match;
  return (
    <p className="quiz-reveal-intro mb-4 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full bg-slate-950/5 px-3 py-1 text-xs dark:bg-white/10">
      <span className="font-semibold text-slate-900 dark:text-white">
        {changed ? "Result changed" : delta === 0 ? "Result held" : delta > 0 ? "Result firmed up" : "Result loosened"}
      </span>
      <span className="text-slate-700 tabular-nums dark:text-slate-300">
        {changed ? (
          <>
            <span className="line-through decoration-slate-400">
              {outcome.was.name} {outcome.was.match}%
            </span>
            {" → "}
            {top.ideology.name} {top.match}%
          </>
        ) : (
          <>
            {outcome.was.match}% → {top.match}%
          </>
        )}
      </span>
      <span className="text-slate-500 dark:text-slate-400">after {outcome.round} more answers</span>
    </p>
  );
}

// Checkpoint status, as a strip along the bottom of the hero.
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
    <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-200 bg-slate-50/80 px-5 py-2.5 text-sm sm:px-8 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700 dark:text-slate-300">
        {complete && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            <Check size={15} aria-hidden className="text-emerald-600 dark:text-emerald-400" />
            {QUIZ_MODES[mode].shortName} complete
          </span>
        )}
        <span>
          {complete && next ? `Keep this result, or continue to the ${QUIZ_MODES[next].shortName.toLowerCase()}.` : complete ? "Your full political map is done." : ""}
          {deferredCount > 0 && ` ${deferredCount} skipped ${deferredCount === 1 ? "question" : "questions"} to review.`}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {deferredCount > 0 && (
          <form action={reviewDeferredAction.bind(null, slug)}>
            <button type="submit" className={btnTertiary}>
              Review skipped
            </button>
          </form>
        )}
        {complete && next && (
          <form action={continueQuizAction.bind(null, slug, next)}>
            <button type="submit" className={btnSecondary}>
              Continue · {QUIZ_MODES[next].minutes}
              <ArrowRight size={15} aria-hidden />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Results body ──

export function QuizResults({
  slug,
  result,
  canEdit,
  mode,
  ownership,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  mode: QuizModeId;
  ownership?: ReactNode;
}) {
  const top = result.ideologies[0];
  const accent = familyColor(top.ideology.family);
  const you = canEdit ? "you" : "they";
  return (
    <div className="min-w-0 space-y-5">
      <DefinesYou result={result} canEdit={canEdit} accent={accent} />

      {mode === "deep" && (
        <Section id="map">
          <ResultsMap
            ranked={result.ideologies.map((m) => ({ id: m.ideology.id, match: m.match }))}
            you={placeRespondent(result.ideologies)}
            youLabel={canEdit ? "You" : "Them"}
            accent={accent}
            kicker="Political map"
            title={`Where ${you} sit among ${ideologies.length} traditions`}
            description="Each dot is a tradition, placed on the two directions that separate them most. Hover or tap a dot to inspect it."
          />
        </Section>
      )}

      {mode !== "quick" && <Matches result={result} canEdit={canEdit} />}

      <Positions slug={slug} result={result} canEdit={canEdit} accent={accent} />

      {mode !== "quick" && (
        <Section id="issues">
          <SectionHeader
            kicker="Detailed positions"
            title={`Where ${you} stand on the issues`}
            description={result.profiles.length > 0 ? `${result.profiles.length} issues answered. Open one to see every position behind it.` : undefined}
          />
          {result.profiles.length === 0 ? (
            <p className={`mt-3 ${meta}`}>No issues answered yet.</p>
          ) : (
            <ResultsIssues profiles={result.profiles} slug={slug} canEdit={canEdit} />
          )}
        </Section>
      )}

      <Explore slug={slug} result={result} canEdit={canEdit} mode={mode} ownership={ownership} />
    </div>
  );
}

// ── Overview ──

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
    <Section id="defines">
      <SectionHeader kicker="Overview" title={canEdit ? "Your strongest convictions" : "Their strongest convictions"} />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {convictions.map((a) => {
          const def = axisById[a.axis];
          const pole = a.mean < 0 ? def.negative : def.positive;
          return (
            <a
              key={a.axis}
              href={`#axis-${a.axis}`}
              className="block rounded-xl border p-4 transition-colors hover:border-slate-400 dark:hover:border-slate-600"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0b` }}
            >
              <p className={small}>{def.name}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{pole.label}</p>
              <p className="mt-1 line-clamp-3 text-sm leading-snug text-slate-700 dark:text-slate-300">{pole.description}</p>
              <div className="mt-3">
                <Track you={a.mean} color={accent} size="sm" />
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className={h3}>
            Where {canEdit ? "you break" : "they break"} from {top.ideology.name}
          </h3>
          <p className={`mt-0.5 ${meta}`}>The axes where {canEdit ? "your" : "their"} answers sit furthest from the tradition&rsquo;s position.</p>
        </div>
        {breaks.length > 0 && (
          <p className={`flex items-center gap-4 ${small}`}>
            <span className="inline-flex items-center gap-1.5">
              <YouMarker color={accent} /> {canEdit ? "You" : "Them"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ThemMarker /> {top.ideology.name}
            </span>
          </p>
        )}
      </div>
      {breaks.length === 0 ? (
        <>
          <p className={`mt-2 ${body}`}>
            Nowhere: {canEdit ? "you line" : "they line"} up with {top.ideology.name} on every axis it defines.
            {beyond.length > 0 && ` Where ${canEdit ? "you go" : "they go"} beyond it:`}
          </p>
          {beyond.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {beyond.map((a) => (
                <a
                  key={a.axis}
                  href={`#axis-${a.axis}`}
                  className="rounded-full border px-3 py-1.5 text-sm hover:border-slate-400"
                  style={{ borderColor: `${accent}55`, backgroundColor: `${accent}10` }}
                >
                  <span className="text-slate-600 dark:text-slate-400">{axisById[a.axis].name}: </span>
                  <span className="font-semibold text-slate-950 dark:text-white">{stanceWord(a.axis, a.mean)}</span>
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {breaks.map((c) => (
            <BreakRow key={c.axis} comparison={c} ideologyName={top.ideology.name} accent={accent} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </Section>
  );
}

const gapLabel = (gap: number) => (gap >= 1 ? "Wide gap" : gap >= 0.6 ? "Clear gap" : "Moderate gap");

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
  const yours = c.you < 0 ? def.negative : def.positive;
  return (
    <li className="grid gap-x-8 gap-y-3 p-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-950 dark:text-white">{def.name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {gapLabel(c.gap)} · {c.agreement}% agreement
          </span>
        </p>
        <p className="mt-1.5 text-sm font-semibold text-slate-950 dark:text-white">
          {canEdit ? "You" : "They"}: {stanceWord(c.axis, c.you)}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {ideologyName}: {stanceWord(c.axis, c.them)}
        </p>
        <p className={`mt-1 line-clamp-2 ${small}`}>{yours.description}</p>
      </div>
      <LabeledTrack negative={def.negative.label} positive={def.positive.label}>
        <Track you={c.you} them={c.them} color={accent} youLabel={canEdit ? "You" : "Them"} themLabel={ideologyName} />
      </LabeledTrack>
    </li>
  );
}

// ── Ranked matches ──

function Matches({ result, canEdit }: { result: QuizResult; canEdit: boolean }) {
  const compare = result.ideologies
    .slice(0, 3)
    .map((x) => x.ideology.id)
    .join(",");
  return (
    <Section id="matches">
      <SectionHeader
        kicker="Political map"
        title={canEdit ? "The traditions closest to you" : "The closest traditions"}
        description={`All ${result.ideologies.length} traditions, ranked by similarity. Open one for the axis-by-axis comparison.`}
        actions={
          <Link href={`/atlas/compare?ids=${compare}`} className={btnSecondary}>
            Compare top 3
          </Link>
        }
      />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className={`hidden border-b border-slate-200 bg-slate-50 px-4 py-2 sm:grid ${rowGrid} ${small} dark:border-slate-800 dark:bg-slate-900/50`}>
          <span className="text-right">#</span>
          <span>Tradition</span>
          <span className="text-right">Similarity</span>
          <span />
        </div>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {result.ideologies.slice(0, LISTED).map((m, i) => (
            <MatchRow key={m.ideology.id} rank={i + 1} match={m} />
          ))}
        </ol>
        {result.ideologies.length > LISTED && (
          <details className="group/all border-t border-slate-200 dark:border-slate-800">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/50 dark:hover:text-white">
              <span className="group-open/all:hidden">Show all {result.ideologies.length}</span>
              <span className="hidden group-open/all:inline">Show top {LISTED} only</span>
              <ChevronDown size={15} aria-hidden className="transition-transform group-open/all:rotate-180" />
            </summary>
            <ol className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800/80 dark:border-slate-800">
              {result.ideologies.slice(LISTED).map((m, i) => (
                <MatchRow key={m.ideology.id} rank={LISTED + i + 1} match={m} />
              ))}
            </ol>
          </details>
        )}
      </div>
    </Section>
  );
}

const rowGrid = "grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_1rem] items-center gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_11rem_1rem] sm:gap-x-4";

function MatchRow({ rank, match }: { rank: number; match: IdeologyMatch }) {
  const color = familyColor(match.ideology.family);
  const first = rank === 1;
  return (
    <li>
      <details id={`match-${match.ideology.id}`} className="group/match scroll-mt-32 lg:scroll-mt-20">
        <summary
          className={`grid min-h-14 cursor-pointer list-none px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${rowGrid}`}
          style={first ? { backgroundColor: `${color}0d`, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
        >
          <span className={`text-right tabular-nums ${first ? "font-bold text-slate-950 dark:text-white" : "text-sm text-slate-500 dark:text-slate-400"}`}>{rank}</span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <span className="font-semibold text-slate-950 dark:text-white">{match.ideology.name}</span>
              {first && <span className="rounded-full bg-slate-950 px-2 py-px whitespace-nowrap text-[11px] font-semibold text-white dark:bg-white dark:text-slate-950">Top match</span>}
              <span className="text-xs text-slate-500 dark:text-slate-400">{FAMILIES[match.ideology.family].label}</span>
            </span>
            <span className="mt-0.5 hidden truncate text-sm text-slate-600 group-open/match:hidden sm:block dark:text-slate-400">{match.ideology.description}</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
              <span className="block h-full rounded-full" style={{ width: `${match.match}%`, backgroundColor: color }} />
            </span>
            <span className="ml-auto w-10 text-right text-sm font-semibold text-slate-950 tabular-nums dark:text-white">{match.match}%</span>
          </span>
          <ChevronDown size={16} aria-hidden className="text-slate-500 transition-transform group-open/match:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:pl-15 dark:border-slate-800 dark:bg-slate-900/30">
          <p className={`max-w-3xl ${body}`}>{match.ideology.description}</p>
          <p className={`mt-4 ${small}`}>Axis by axis, closest first · agreement on the right</p>
          <ul className="mt-2 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {match.comparisons.map((c) => {
              const def = axisById[c.axis];
              return (
                <li key={c.axis} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2.75rem] items-center gap-3 text-sm" title={`${def.negative.label} ↔ ${def.positive.label}`}>
                  <span className="truncate text-slate-700 dark:text-slate-300">{def.name}</span>
                  <Track you={c.you} them={c.them} color={color} size="sm" />
                  <span className="text-right text-slate-600 tabular-nums dark:text-slate-400">{c.agreement}%</span>
                </li>
              );
            })}
          </ul>
          {match.lenses.length > 0 && (
            <ul className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-200 pt-3 md:grid-cols-2 dark:border-slate-800">
              {match.lenses.map((l) => {
                const labels = LENS_VALUE_LABELS[l.lens];
                return (
                  <li key={l.lens} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{LENS_NAMES[l.lens]}</span>
                    <span className="truncate text-slate-600 dark:text-slate-400">
                      {l.match ? labels[l.you] : `${labels[l.you]} vs. ${l.accepted.map((v) => labels[v]).join(" or ")}`}
                    </span>
                    <span className={`text-right font-medium ${l.match ? "text-slate-600 dark:text-slate-400" : "text-rose-700 dark:text-rose-400"}`}>{l.match ? "Same" : "Differs"}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href={`/atlas/philosophies/${match.ideology.id}`} className={`mt-4 inline-flex text-sm ${textLink}`}>
            Explore {match.ideology.name} →
          </Link>
        </div>
      </details>
    </li>
  );
}

// ── Axes ──

function Positions({ slug, result, canEdit, accent }: { slug: string; result: QuizResult; canEdit: boolean; accent: string }) {
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));
  const measured = measuredAxes(result);
  const top = result.ideologies[0];
  const unsure = measured.filter((a) => byAxis.get(a.id)!.confidence !== "high").length;
  return (
    <Section id="positions">
      <SectionHeader
        kicker="Detailed positions"
        title={`${canEdit ? "Your" : "Their"} position on ${measured.length} axes`}
        description={`Open any axis to see the answers that placed ${canEdit ? "you" : "them"} there${canEdit && unsure > 0 ? ", or to refine an uncertain one" : ""}.`}
      />
      <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-2.5 ${small} dark:bg-slate-900/50`}>
        <span className="inline-flex items-center gap-1.5">
          <YouMarker color={accent} /> {canEdit ? "You" : "Them"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ThemMarker /> {top.ideology.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded-full" style={{ backgroundColor: `${accent}2e` }} /> Likely range
        </span>
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Confidence:</span>
          <ConfidenceMeter level="high" withLabel />
          <ConfidenceMeter level="medium" withLabel />
          <ConfidenceMeter level="low" withLabel />
        </span>
      </div>
      <div className="mt-5 space-y-6">
        {AXIS_GROUPS.map((g) => {
          const rows = measured.filter((a) => a.group === g.id);
          if (rows.length === 0) return null;
          return (
            <div key={g.id}>
              <h3 className="flex items-baseline gap-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                {g.label}
                <span className="font-normal text-slate-500 tabular-nums dark:text-slate-400">{rows.length}</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {rows.map((a) => (
                  <AxisRow key={a.id} slug={slug} result={byAxis.get(a.id)!} canEdit={canEdit} accent={accent} reference={top.ideology.position[a.id]} refName={top.ideology.name} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function AxisRow({
  slug,
  result,
  canEdit,
  accent,
  reference,
  refName,
}: {
  slug: string;
  result: AxisResult;
  canEdit: boolean;
  accent: string;
  reference?: number;
  refName: string;
}) {
  const def = axisById[result.axis];
  const refine = refineAxisAction.bind(null, slug, result.axis);
  return (
    <details id={`axis-${result.axis}`} className="group scroll-mt-32 lg:scroll-mt-20">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_1rem] items-center gap-x-4 gap-y-2 rounded-lg py-3 hover:bg-slate-50/70 md:grid-cols-[13rem_minmax(0,1fr)_1rem] dark:hover:bg-slate-900/40">
        <span className="min-w-0 md:pl-1">
          <span className="flex items-center gap-2">
            <span className="font-medium text-slate-950 dark:text-white">{def.name}</span>
            <ConfidenceMeter level={result.confidence} />
          </span>
          <span className="block text-sm text-slate-700 dark:text-slate-300">{stanceWord(result.axis, result.mean)}</span>
        </span>
        <ChevronDown size={16} aria-hidden className="text-slate-500 transition-transform group-open:rotate-180 md:order-3" />
        <div className="col-span-2 md:order-2 md:col-span-1">
          <LabeledTrack negative={def.negative.label} positive={def.positive.label}>
            <Track you={result.mean} them={reference} band={[result.mean - result.sd, result.mean + result.sd]} color={accent} />
          </LabeledTrack>
        </div>
      </summary>

      <div className="mb-3 grid gap-4 rounded-xl bg-slate-50 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] dark:bg-slate-900/60">
        <div className="space-y-2">
          <p>
            <span className="font-semibold text-slate-950 dark:text-white">{def.negative.label}:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{def.negative.description}</span>
          </p>
          <p>
            <span className="font-semibold text-slate-950 dark:text-white">{def.positive.label}:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{def.positive.description}</span>
          </p>
          {reference !== undefined && (
            <p className="text-slate-700 dark:text-slate-300">
              {refName}: <span className="font-medium text-slate-950 dark:text-white">{stanceWord(result.axis, reference)}</span>
            </p>
          )}
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ConfidenceMeter level={result.confidence} withLabel />
            <span className={small}>· {result.answered} {result.answered === 1 ? "answer" : "answers"}</span>
          </p>
          {result.confidence === "low" && (
            <p className="text-slate-700 dark:text-slate-300">
              {result.lowReason === "mixed" ? `${canEdit ? "Your" : "Their"} answers on this axis pointed in both directions.` : "Too few answers to place this precisely."}
            </p>
          )}
        </div>
        <div>
          <p className={small}>Why {canEdit ? "you" : "they"} landed here</p>
          {result.influences.length === 0 ? (
            <p className="mt-1 text-slate-600 dark:text-slate-400">No answers have moved this axis yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {result.influences.map((inf) => (
                <li key={inf.answerIndex} className="leading-snug">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{inf.answerLabel}</span>
                  {inf.kind === "statement" ? ": " : " — "}
                  <span className="text-slate-700 dark:text-slate-300">“{inf.text}”</span>
                  <span className="ml-1 whitespace-nowrap text-slate-500 dark:text-slate-400">→ toward {poleLabel(result.axis, inf.toward)}</span>
                  {canEdit && (
                    <Link href={`/quiz/${slug}?edit=${inf.kind}:${inf.itemId}`} className="ml-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
                      change
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && result.confidence !== "high" && (
            <form action={refine} className="mt-3">
              <button type="submit" className={btnSecondary}>
                Answer 4 more to refine this
              </button>
            </form>
          )}
        </div>
      </div>
    </details>
  );
}

// ── Explore further ──

function Explore({
  slug,
  result,
  canEdit,
  mode,
  ownership,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  mode: QuizModeId;
  ownership?: ReactNode;
}) {
  const top = result.ideologies.slice(0, 3);
  const compare = top.map((x) => x.ideology.id).join(",");
  const tiles = [
    { href: `/atlas/compare?ids=${compare}`, kind: "Understand", title: "Compare your top three", text: `See where ${top.map((x) => x.ideology.name).join(", ")} actually diverge.` },
    ...(canEdit
      ? [
          { href: `/atlas/economy?from=${slug}`, kind: "Go deeper", title: "Economic Foundations", text: "Ownership, firms, labor, land, money, trade, and growth, starting from this result." },
          { href: `/atlas/authority?from=${slug}`, kind: "Go deeper", title: "Government & Authority", text: "Legitimacy, participation, restraint, expertise, and political change." },
          { href: `/atlas/foreign-policy?from=${slug}`, kind: "Go deeper", title: "Foreign Policy", text: "Alliances, institutions, military force, trade, aid, and defense posture." },
        ]
      : []),
  ];
  return (
    <Section id="explore">
      <SectionHeader kicker="Explore further" title="Where to go next" />

      {canEdit && result.complete && <SharpenStrip slug={slug} result={result} />}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className={tile}>
            <p className={small}>{t.kind}</p>
            <p className="mt-0.5 font-semibold text-slate-950 dark:text-white">{t.title}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-600 dark:text-slate-400">{t.text}</p>
          </Link>
        ))}
        {canEdit && (
          <a href={everyChurchQuizUrl} rel="noreferrer" className={`${tile} flex gap-3`}>
            <Image src="/brands/everychurch-logo-icon.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className={`block ${small}`}>Christian beliefs</span>
              <span className="mt-0.5 block font-semibold text-slate-950 dark:text-white">Explore on EveryChurch ↗</span>
              <span className="mt-1 line-clamp-2 block text-sm leading-snug text-slate-600 dark:text-slate-400">
                Work through key theological questions and see which Christian traditions align with your beliefs.
              </span>
            </span>
          </a>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href={`/atlas/philosophies/${top[0].ideology.id}`} className={textLink}>
          Read about {top[0].ideology.name}
        </Link>
        {canEdit && (
          <Link href="/atlas/me" className={textLink}>
            Open Your Atlas
          </Link>
        )}
        {canEdit && mode !== "deep" && <span className={meta}>A deeper checkpoint is available from the top of the page.</span>}
      </div>
      {ownership && <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">{ownership}</div>}
    </Section>
  );
}

// The invitation to keep going once the quiz is done: a round of extra
// questions aimed at whatever would most change the result.
function SharpenStrip({ slug, result }: { slug: string; result: QuizResult }) {
  const [a, b] = result.ideologies;
  const lead = a.match - b.match;
  const unsure = result.axes.filter((x) => x.confidence !== "high").length;
  const heading = {
    torn: `${a.ideology.name} or ${b.ideology.name}? Settle it.`,
    lean: `Close the gap between ${a.ideology.name} and ${b.ideology.name}`,
    clear: `Sharpen your ${a.ideology.name} result`,
  }[verdict(result.ideologies)];
  return (
    <div id="sharpen" className="mt-4 flex scroll-mt-32 flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:scroll-mt-20 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/50">
      <div className="min-w-0 max-w-2xl">
        <p className={h3}>{heading}</p>
        <p className={`mt-1 ${meta}`}>
          {lead < VERDICT_CLEAR_LEAD ? `Your top two are ${lead === 0 ? "tied" : `${lead} ${lead === 1 ? "point" : "points"} apart`}. ` : ""}
          Extra questions target where your closest matches disagree
          {unsure > 0 ? ` and the ${unsure} ${unsure === 1 ? "axis" : "axes"} where you're least certain` : ""}.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {ROUND_SIZES.map((size, i) => (
          <form key={size} action={sharpenAction.bind(null, slug, size)}>
            <button type="submit" className={i === 0 ? btnPrimary : btnSecondary}>
              {i === 0 ? "Quick round" : "Deep round"}
              <span className="font-normal opacity-70">
                {size} · ~{Math.round(size / 4)} min
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
