// The top of the results page in three levels: the result and what its
// score measures; why it came out this way, in the respondent's own
// positions; then context (family, coverage, the nearest alternatives) and
// actions.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info, Network, RotateCcw, Sparkles } from "lucide-react";
import { axisById } from "@/lib/quiz/axes";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { umbrellaOf } from "@/lib/quiz/ideologies";
import { verdict, type IdeologyMatch, type QuizResult } from "@/lib/quiz/results";
import { continueQuizAction, reviewDeferredAction, sharpenAction, startQuizAction } from "@/lib/actions/quiz";
import { ROUND_SIZES, type SharpenOutcome } from "@/lib/quiz/refine";
import { nextQuizMode, QUIZ_MODES, type QuizModeId } from "@/lib/quiz/modes";
import { lensIds } from "@/lib/quiz/types";
import { explainResult } from "@/lib/politics/explain";
import { lcPole, pointsApart, poleOf, strengthOf } from "@/lib/politics/axis-language";
import { CountUp } from "@/components/politics/count-up";
import { ExpandableAnalysis } from "@/components/politics/expandable";
import { FamilyBadge, SimilarityBars } from "@/components/politics/tradition";
import { focusRing, leadText, linkChip, metaText, pageTitle } from "@/components/politics/type";
import { QuizShareButton } from "./quiz-share";
import { btnPrimary, btnSecondary, btnTertiary, ConfidenceMeter, textLink } from "./results-ui";
import { BREAK_GAP, measuredAxes, overallCertainty, shareTitle, VERDICT_LABEL, viewHref } from "./result-shared";

function MatchRing({ value, color, reveal }: { value: number; color: string; reveal: boolean }) {
  return (
    <div className="relative size-28 shrink-0 sm:size-36">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
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
          className={reveal ? "quiz-reveal-ring" : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-[2.6rem] dark:text-white">
          <CountUp value={value} animate={reveal} delay={1100} duration={1400} />
          <span className="text-lg font-semibold text-slate-500 sm:text-xl dark:text-slate-400">%</span>
        </span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">similarity</span>
      </div>
    </div>
  );
}

// Axis names in a sentence, each a link to its place on the page.
function AxisList({ ids, href }: { ids: string[]; href: (id: string) => string }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && (i === ids.length - 1 ? (ids.length > 2 ? ", and " : " and ") : ", ")}
          <Link
            href={href(id)}
            className={`font-semibold text-slate-950 underline decoration-slate-300 decoration-2 underline-offset-4 hover:decoration-current dark:text-white dark:decoration-slate-600 ${focusRing}`}
          >
            {axisById[id as keyof typeof axisById].name}
          </Link>
        </span>
      ))}
    </>
  );
}

// Why this result, in two or three sentences built from the result itself.
function Interpretation({ result, canEdit, slug }: { result: QuizResult; canEdit: boolean; slug: string }) {
  const top = result.ideologies[0];
  const { shared, rival } = explainResult(result);
  const href = (axis: string) => viewHref(slug, "axes", `axis-${axis}`);
  const subject = canEdit ? "Your answers" : "These answers";
  const widest = [...top.comparisons].filter((c) => c.gap >= BREAK_GAP).sort((a, b) => b.gap - a.gap)[0];
  const poles = [...new Set(shared.map((c) => lcPole(poleOf(c.axis, c.them).label)))];
  const allStrong = shared.every((c) => strengthOf(Math.min(Math.abs(c.you), Math.abs(c.them))) === "strong");
  return (
    <div className={`space-y-3 ${leadText} max-w-3xl`}>
      {shared.length > 0 ? (
        <p>
          {subject} line up with {top.ideology.name} most closely on{" "}
          <AxisList ids={shared.map((c) => c.axis)} href={href} />, where both are {allStrong ? "strongly " : ""}
          {joinWords(poles)}.
        </p>
      ) : (
        <p>
          {subject} sit nearer {top.ideology.name} than any other tradition overall, without matching it strongly on any
          single axis.
        </p>
      )}
      {rival && (
        <p>
          It leads {rival.name} by {rival.lead} {rival.lead === 1 ? "point" : "points"}
          {rival.axis ? (
            <>
              ; <AxisList ids={[rival.axis]} href={href} /> separates them most for {canEdit ? "you" : "this profile"} (
              {pointsApart(rival.gapTop)} pts from {top.ideology.name}, {pointsApart(rival.gapRival)} from {rival.name})
            </>
          ) : null}
          .
        </p>
      )}
      {widest && (
        <p>
          The widest gap is on <AxisList ids={[widest.axis]} href={() => "#overview"} />, {pointsApart(widest.gap)}{" "}
          points apart on a 100-point scale.
        </p>
      )}
    </div>
  );
}

const joinWords = (w: string[]) => (w.length <= 1 ? w.join("") : `${w.slice(0, -1).join(", ")} and ${w.at(-1)}`);

export function ResultHero({
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
    : snapshot
      ? "Political neighborhood"
      : "Closest political tradition";
  const umbrella = umbrellaOf(top.ideology.id);
  const measured = measuredAxes(result).length;
  const certainty = overallCertainty(result);
  // The page only opens the runner for an unfinished checkpoint or a sharpen
  // round in progress; past a checkpoint, moving on is the footer's Continue.
  const incomplete = canEdit && (!checkpointComplete || result.roundLeft > 0);
  const canSharpen = canEdit && result.complete && !incomplete;
  const share = shareTitle(result, canEdit, mode);

  return (
    <section
      id="top"
      aria-labelledby="result-name"
      className="relative scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 mask-[linear-gradient(to_right,transparent,black_70%)] dark:opacity-30"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: `radial-gradient(40rem 18rem at 0% 0%, ${color}1a, transparent 70%)` }}
      />

      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {canEdit && sharpened && result.complete && <SharpenedStatus outcome={sharpened} top={top} />}

          {/* 1 · The result and what its score measures */}
          <p
            className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 ${anim("quiz-reveal-intro")}`}
          >
            <Sparkles size={15} aria-hidden style={{ color }} />
            {intro}
          </p>
          <div className="mt-3 flex items-center gap-5 sm:gap-7">
            {!snapshot && (
              <div className={anim("quiz-reveal-intro")}>
                <MatchRing value={top.match} color={color} reveal={reveal} />
              </div>
            )}
            <div className="min-w-0">
              <h1 id="result-name" className={`${pageTitle} ${anim("quiz-reveal-name")}`}>
                {snapshot ? `${FAMILIES[top.ideology.family].label} neighborhood` : top.ideology.name}
              </h1>
              <div className={`mt-3 flex flex-wrap items-center gap-2 ${anim("quiz-reveal-rest")}`}>
                <FamilyBadge family={top.ideology.family} />
                {!snapshot && umbrella && (
                  <Link href={`/atlas/philosophies/${umbrella.id}?from=${slug}`} className={linkChip}>
                    <Network size={14} aria-hidden className="text-slate-500" />
                    Part of {umbrella.name}
                  </Link>
                )}
                {!snapshot && result.ideologies[1] && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {VERDICT_LABEL[verdict(result.ideologies)]}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!snapshot && (
            <p className={`mt-4 flex max-w-2xl gap-2 ${metaText} ${anim("quiz-reveal-rest")}`}>
              <Info size={15} aria-hidden className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                Similarity measures how closely {canEdit ? "your" : "these"} answers match this tradition&apos;s modeled
                positions on {measured} {measured === 1 ? "axis" : "axes"} and {lensIds.length} categorical questions.
                100 means an identical profile; it is a distance, not a probability.
              </span>
            </p>
          )}

          {/* 2 · Why */}
          <div className={`mt-6 border-t border-slate-200 pt-6 dark:border-slate-800 ${anim("quiz-reveal-rest")}`}>
            <h2 className="mb-2 text-sm font-semibold text-slate-950 dark:text-white">
              {canEdit ? "Why you got this result" : "Why this result"}
            </h2>
            {snapshot ? (
              <p className={leadText}>
                {canEdit ? "Your" : "The"} closest signals point toward{" "}
                {result.ideologies
                  .slice(0, 3)
                  .map((m) => m.ideology.name)
                  .join(", ")}
                . A longer profile can tell them apart.
              </p>
            ) : (
              <Interpretation result={result} canEdit={canEdit} slug={slug} />
            )}
            {!snapshot && (
              <ExpandableAnalysis
                className="mt-4"
                summaryClassName="py-1 text-sm font-medium text-slate-700 dark:text-slate-300"
                chevron="start"
                summary={<>About {top.ideology.name}</>}
              >
                <div className="mt-2 max-w-3xl pl-6 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                  <p>{top.ideology.description}</p>
                  <Link
                    href={`/atlas/philosophies/${top.ideology.id}?from=${slug}`}
                    className={`mt-2 inline-flex text-sm ${textLink}`}
                  >
                    Open the Atlas entry →
                  </Link>
                </div>
              </ExpandableAnalysis>
            )}
          </div>

          {/* 3 · Context and actions */}
          <div className={`mt-6 flex flex-wrap items-center gap-2 ${anim("quiz-reveal-rest")}`}>
            {incomplete ? (
              <Link href={`/quiz/${slug}?take=1`} className={btnPrimary}>
                {result.roundLeft > 0 ? `Finish sharpening · ${result.roundLeft} left` : "Continue the quiz"}
                <ArrowRight size={15} aria-hidden />
              </Link>
            ) : canSharpen ? (
              <form action={sharpenAction.bind(null, slug, ROUND_SIZES[0])}>
                <button type="submit" className={btnPrimary}>
                  {sharpened ? "Go another round" : "Sharpen this result"}
                  <span className="font-normal opacity-70">+{ROUND_SIZES[0]} questions</span>
                </button>
              </form>
            ) : null}
            <QuizShareButton title={share} className={incomplete || canSharpen ? btnSecondary : btnPrimary} />
            {canEdit && (
              <form action={startQuizAction}>
                <input type="hidden" name="mode" value={mode} />
                <button type="submit" className={btnTertiary}>
                  <RotateCcw size={14} aria-hidden />
                  Retake
                </button>
              </form>
            )}
          </div>
          <p className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${metaText}`}>
            <span>
              {result.answeredCount} answers · {measured} of {axisCount} axes measured
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ConfidenceMeter level={certainty} />
              {certainty === "high" ? "High" : certainty === "medium" ? "Medium" : "Low"} overall certainty
            </span>
          </p>
        </div>

        <aside
          aria-label={snapshot ? "Closest signals" : "Closest traditions"}
          className={`self-start rounded-xl border border-slate-200 bg-white/85 p-4 backdrop-blur sm:p-5 dark:border-slate-800 dark:bg-slate-950/70 ${anim("quiz-reveal-rest")}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {snapshot ? "Closest signals" : "Closest traditions"}
            </h2>
            {!snapshot && <span className={metaText}>similarity</span>}
          </div>
          <div className="mt-3">
            {snapshot ? (
              <ol className="space-y-2">
                {result.ideologies.slice(0, 3).map((m, i) => (
                  <li
                    key={m.ideology.id}
                    className="flex items-center gap-2.5 font-medium text-slate-900 dark:text-slate-100"
                  >
                    <span className="w-4 text-right text-sm text-slate-500 tabular-nums">{i + 1}</span>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: familyColor(m.ideology.family) }}
                      aria-hidden
                    />
                    {m.ideology.name}
                  </li>
                ))}
              </ol>
            ) : (
              <SimilarityBars
                animate
                delay={reveal ? 1900 : 150}
                items={result.ideologies.slice(0, 5).map((m) => ({
                  id: m.ideology.id,
                  name: m.ideology.name,
                  family: m.ideology.family,
                  value: m.match,
                  href: viewHref(slug, "traditions", `match-${m.ideology.id}`),
                }))}
              />
            )}
          </div>
          {!snapshot && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              <Link href={viewHref(slug, "traditions")} className={textLink}>
                All {result.ideologies.length} ranked
              </Link>
              <Link href="#compare" className={textLink}>
                Compare them
              </Link>
            </div>
          )}
        </aside>
      </div>
      {footer}
    </section>
  );
}

const axisCount = Object.keys(axisById).length;

// What a sharpen round changed: a secondary status line above the result.
function SharpenedStatus({ outcome, top }: { outcome: SharpenOutcome; top: IdeologyMatch }) {
  const changed = outcome.was.id !== top.ideology.id;
  const delta = top.match - outcome.was.match;
  return (
    <p className="quiz-reveal-intro mb-4 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full bg-slate-950/5 px-3 py-1 text-[13px] dark:bg-white/10">
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
      <span className="text-slate-600 dark:text-slate-400">after {outcome.round} more answers</span>
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
          {complete && next
            ? `Keep this result, or continue to the ${QUIZ_MODES[next].shortName.toLowerCase()}.`
            : complete
              ? "Your full political map is done."
              : ""}
          {deferredCount > 0 &&
            ` ${deferredCount} skipped ${deferredCount === 1 ? "question" : "questions"} to review.`}
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
