"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, CircleHelp } from "lucide-react";
import {
  deferQuestionAction,
  reviewDeferredAction,
  runnerStateAction,
  sharpenAction,
  submitAnswerAction,
} from "@/lib/actions/quiz";
import type { AnsweredItem, RunnerItem, RunnerState } from "@/lib/quiz/runner";
import type { QuizAnswer } from "@/lib/quiz/engine";
import { ROUND_SIZES, type SharpenOutcome } from "@/lib/quiz/refine";
import { readStoredNumber, writeStoredNumber } from "@/lib/browser/storage";
import { AgreeScale, SCALE } from "./agree-scale";
import { card, ghostButton, kbd, primaryButton, segmented, segmentedItem } from "./styles";

// Latest answer count per quiz in this tab, to tell when the page was
// restored with an older state than the one last seen.
const seenKey = (slug: string) => `quiz-answered:${slug}`;
function readSeen(slug: string): number {
  return readStoredNumber("session", seenKey(slug));
}
function writeSeen(slug: string, count: number) {
  writeStoredNumber("session", seenKey(slug), count);
}

// Showing an earlier answer to change it: either stepped back to from the
// recent list, or opened directly from a results-page link.
type Editing = { answered: AnsweredItem; recentIndex: number | null };

export function QuizRunner({
  slug,
  initial,
  initialEdit,
  round,
}: {
  slug: string;
  initial: RunnerState;
  initialEdit?: AnsweredItem;
  round?: SharpenOutcome;
}) {
  const router = useRouter();
  // Where a finished quiz or sharpen round lands: the reveal, carrying the
  // earlier top match so it can show what changed.
  const revealHref = round
    ? `/quiz/${slug}?${new URLSearchParams({ reveal: "1", round: String(round.round), was: round.was.id, wasPct: String(round.was.match) })}`
    : `/quiz/${slug}?reveal=1`;
  // Issue importance is ranked on one board before the results.
  const finishHref = useCallback(
    (needsPriorities: boolean) => (needsPriorities ? `${revealHref}&view=priorities` : revealHref),
    [revealHref],
  );
  // A round resumed later arrives without its URL params; its size is then
  // whatever was left on arrival.
  const [roundTotal] = useState(() => Math.max(round?.round ?? 0, initial.refineLeft));
  const [state, setState] = useState(initial);
  const [editing, setEditing] = useState<Editing | null>(
    initialEdit ? { answered: initialEdit, recentIndex: null } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [single, setSingle] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();
  // Known stale only on a client-side restore; a fresh server render is
  // current, so this is false during hydration.
  const [syncing, setSyncing] = useState(
    () => !initialEdit && typeof window !== "undefined" && readSeen(slug) > initial.answeredCount,
  );
  const answeredHere = useRef(false);
  const pending = submitting || syncing;

  // Browser back/forward restores this page from Next's client cache with the
  // state it was first rendered with, which can be several answers behind.
  // Re-read the live state on mount; input is held while it loads when this
  // tab has already seen a later state.
  useEffect(() => {
    if (initialEdit) return;
    let cancelled = false;
    runnerStateAction(slug)
      .then((res) => {
        if (cancelled || answeredHere.current || !res.ok) return;
        writeSeen(slug, res.data.answeredCount);
        if (res.data.answeredCount === initial.answeredCount) return;
        setState(res.data);
        if (res.data.complete && !res.data.next) {
          router.replace(round ? finishHref(res.data.needsPriorities) : `/quiz/${slug}`);
          router.refresh();
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initial.answeredCount, initialEdit, router, round, finishHref]);

  const item: RunnerItem | null = editing ? editing.answered.item : state.next;
  const current = editing ? editing.answered.value : undefined;

  const submit = useCallback(
    (value: number | string | string[] | null) => {
      if (!item || pending) return;
      const answer: QuizAnswer =
        item.kind === "statement"
          ? { kind: "statement", id: item.id, value: value as number | null }
          : { kind: "choice", id: item.id, value: value as string | string[] | null };
      setError(null);
      answeredHere.current = true;
      startTransition(async () => {
        const res = await submitAnswerAction(slug, answer);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        writeSeen(slug, res.data.answeredCount);
        const wasDirectEdit = editing?.recentIndex === null;
        setEditing(null);
        setMulti([]);
        setSingle(null);
        setState(res.data);
        if (res.data.complete && (!res.data.next || wasDirectEdit)) {
          router.replace(wasDirectEdit ? `/quiz/${slug}` : finishHref(res.data.needsPriorities));
          router.refresh();
        }
      });
    },
    [item, pending, slug, editing, router, finishHref],
  );

  const defer = useCallback(() => {
    if (!item || pending) return;
    setError(null);
    answeredHere.current = true;
    startTransition(async () => {
      const res = await deferQuestionAction(slug, item.kind, item.id);
      if (!res.ok) return setError(res.error);
      setEditing(null);
      setMulti([]);
      setSingle(null);
      setState(res.data);
    });
  }, [item, pending, slug]);

  const back = useCallback(() => {
    const idx = editing ? (editing.recentIndex ?? state.recent.length) - 1 : state.recent.length - 1;
    if (idx < 0) return;
    setMulti([]);
    setSingle(null);
    setEditing({ answered: state.recent[idx], recentIndex: idx });
  }, [editing, state.recent]);
  const canGoBack = editing ? (editing.recentIndex ?? state.recent.length) > 0 : state.recent.length > 0;

  // Keyboard: 1–7 on the agreement scale, S defers, N records not sure,
  // ← or Backspace goes back, Enter confirms a pending selection.
  const confirmRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        return back();
      }
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) return confirmRef.current();
      if (["s", "S"].includes(e.key)) return editing ? undefined : defer();
      if (["n", "N"].includes(e.key)) return submit(null);
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (item.kind === "statement" && n <= 7) submit(SCALE[n - 1].value);
      if (item.kind === "choice" && item.selection === "single" && n <= item.options.length) {
        if (item.isScreener) setSingle(item.options[n - 1].id);
        else submit(item.options[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, submit, defer, back, editing]);

  const selectedMultiple =
    item?.kind === "choice" && (item.selection === "multiple" || item.selection === "checklist")
      ? multi.length > 0
        ? multi
        : Array.isArray(current)
          ? current
          : []
      : [];
  const selectedSingle =
    item?.kind === "choice" && item.selection === "single"
      ? (single ?? (typeof current === "string" ? current : null))
      : null;

  const toggleMultiple = (id: string, exclusive: boolean) => {
    const base = selectedMultiple;
    if (base.includes(id)) return setMulti(base.filter((value) => value !== id));
    if (exclusive) return setMulti([id]);
    const exclusiveIds = new Set(
      item?.kind === "choice" ? item.options.filter((o) => o.exclusive).map((o) => o.id) : [],
    );
    setMulti([...base.filter((value) => !exclusiveIds.has(value)), id]);
  };

  const multiChoice = item?.kind === "choice" && (item.selection === "multiple" || item.selection === "checklist");
  const needsConfirm = item?.kind === "choice" && (multiChoice || item.isScreener);
  const canConfirm = !pending && (multiChoice ? selectedMultiple.length > 0 : !!selectedSingle);
  const confirm = () => {
    if (!needsConfirm || !canConfirm) return;
    submit(multiChoice ? selectedMultiple : selectedSingle!);
  };
  useEffect(() => {
    confirmRef.current = confirm;
  });

  const inRound = state.refineLeft > 0 && roundTotal > 0;
  const roundDone = Math.max(0, roundTotal - state.refineLeft);
  const progress = inRound ? roundDone / roundTotal : state.progress;

  // The quiz takes over the content area, full bleed under the site header,
  // so the question is the whole page. Follows the site theme.
  return (
    <div className="-mx-4 -my-8 min-h-[calc(100dvh-3.5rem)] text-slate-900 sm:-mx-8 dark:text-slate-100">
      <header className="sticky top-14 z-10 border-b border-slate-950/6 bg-[#f7f8fa]/85 backdrop-blur-md dark:border-white/6 dark:bg-[#080b12]/85">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3 sm:px-6">
          <p className="shrink-0 text-sm">
            <span className="font-medium text-slate-950 dark:text-white">
              {inRound ? "Sharpening" : state.modeName}
            </span>
            <span className="ml-2 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {inRound
                ? `${Math.min(roundDone + 1, roundTotal)}/${roundTotal}`
                : state.targetScreens > 0
                  ? `${state.answeredCount}/${state.targetScreens}`
                  : `${state.answeredCount} answered`}
            </span>
            {state.minutesLeft > 0 && (
              <span
                className="ml-2 text-xs text-slate-500 dark:text-slate-400"
                title={`About ${state.questionsLeft} more ${state.questionsLeft === 1 ? "question" : "questions"} at your pace`}
              >
                · ~{state.minutesLeft} min left
              </span>
            )}
          </p>
          <div
            className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-950/8 dark:bg-white/10"
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            title={`${state.axesMeasured}/${state.axesTotal} dimensions measured · ${state.issuesDone}/${state.issuesTotal} issues covered`}
          >
            <div
              className="h-full rounded-full bg-slate-950 transition-[width] duration-500 ease-out dark:bg-white"
              style={{ width: `${Math.max(2, progress * 100)}%` }}
            />
          </div>
          {inRound ? (
            <Link href={`/quiz/${slug}?view=results`} className={`${ghostButton} shrink-0`}>
              Stop here
            </Link>
          ) : (
            <span className="hidden shrink-0 font-mono text-xs text-slate-500 tabular-nums sm:inline dark:text-slate-400">
              {state.axesMeasured}/{state.axesTotal} dimensions
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-10 pb-10 sm:px-6 sm:pt-16">
        {item ? (
          <section
            key={`${item.kind}:${item.id}`}
            aria-busy={pending}
            className={`quiz-step transition-opacity ${pending ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {item.area}{" "}
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.topic}</span>
              </p>
              {editing && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Changing an earlier answer
                </span>
              )}
            </div>
            <h2 className="mt-3 text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-slate-950 sm:text-[2.25rem] dark:text-white">
              {item.kind === "statement" ? item.text : item.prompt}
            </h2>
            <details className="group mt-4 w-fit max-w-full">
              <summary className="-ml-2 flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-950/5 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200">
                <CircleHelp size={14} aria-hidden="true" />
                {item.kind === "statement" ? "Why this question?" : "What does this mean?"}
                <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{item.explanation}</p>
            </details>

            {item.kind === "statement" ? (
              <div className={`${card} mt-8 px-4 py-6 sm:px-8 sm:py-8`}>
                <AgreeScale
                  value={typeof current === "number" ? current : null}
                  onPick={(v) => submit(v)}
                  disabled={pending}
                />
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-2">
                {item.options.map((o, i) => {
                  const selected = multiChoice ? selectedMultiple.includes(o.id) : selectedSingle === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={pending}
                      onClick={() => {
                        if (multiChoice) toggleMultiple(o.id, o.exclusive);
                        else if (item.isScreener) setSingle(o.id);
                        else submit(o.id);
                      }}
                      className={`group flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-[15px] leading-snug shadow-sm transition-all disabled:cursor-wait ${
                        selected
                          ? "bg-white text-slate-950 ring-2 ring-slate-950 dark:bg-slate-800 dark:text-white dark:ring-white"
                          : "bg-white text-slate-800 ring-1 ring-slate-950/8 hover:ring-slate-950/25 dark:bg-slate-900/60 dark:text-slate-200 dark:shadow-none dark:ring-white/8 dark:hover:ring-white/25"
                      }`}
                    >
                      {multiChoice ? (
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                            selected
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "ring-1 ring-slate-950/20 group-hover:ring-slate-950/40 dark:ring-white/25"
                          }`}
                        >
                          {selected && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                        </span>
                      ) : (
                        <span
                          className={`${kbd} shrink-0 ${selected ? "bg-slate-950 text-white ring-slate-950 dark:bg-white dark:text-slate-950 dark:ring-white" : ""}`}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                      )}
                      {o.text}
                    </button>
                  );
                })}
                {item.selection === "checklist" && (
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Checked policies count as support. Policies left unchecked count as opposition.
                  </p>
                )}
                {needsConfirm && (
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={confirm}
                    className={`${primaryButton} mt-3 w-full`}
                  >
                    {item.selection === "checklist"
                      ? `Save ${selectedMultiple.some((id) => item.options.find((o) => o.id === id)?.exclusive) ? "no supported policies" : `${selectedMultiple.length} supported`}`
                      : item.selection === "multiple"
                        ? `Continue with ${selectedMultiple.length} ${selectedMultiple.length === 1 ? "selection" : "selections"}`
                        : "Continue"}
                    <kbd className="ml-1 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[11px] font-medium dark:bg-slate-950/10">
                      ↵
                    </kbd>
                  </button>
                )}
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="sticky bottom-0 -mx-4 mt-10 flex items-center justify-between gap-2 border-t border-slate-950/6 bg-[#f7f8fa]/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-5 sm:pb-0 sm:backdrop-blur-none dark:border-white/6 dark:bg-[#080b12]/90 sm:dark:bg-transparent">
              <button type="button" onClick={back} disabled={!canGoBack || pending} className={`${ghostButton} -ml-3`}>
                <ArrowLeft size={15} aria-hidden="true" />
                Back
              </button>
              <div className="flex items-center gap-1">
                {editing && (
                  <button type="button" onClick={() => setEditing(null)} className={ghostButton}>
                    Keep answer
                  </button>
                )}
                {!editing && (
                  <button
                    type="button"
                    onClick={defer}
                    disabled={pending}
                    title="Moves this question to the end of this section."
                    className={ghostButton}
                  >
                    Skip for now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => submit(null)}
                  disabled={pending}
                  title="Records no opinion and leaves the question out of your result."
                  className={`${ghostButton} ${current === null ? "bg-slate-950/5 text-slate-950 dark:bg-white/10 dark:text-white" : ""}`}
                >
                  Not sure
                </button>
              </div>
            </div>
            <p className="mt-4 hidden flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className={kbd}>{item.kind === "statement" ? "1–7" : "1–9"}</span> answer
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={kbd}>S</span> skip for now
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={kbd}>N</span> not sure
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={kbd}>←</span> back
              </span>
              {item.kind === "statement" && (
                <span className="text-slate-400 dark:text-slate-500">
                  Neutral is a position; Not sure records no opinion.
                </span>
              )}
            </p>
          </section>
        ) : (
          <section className={`${card} quiz-step px-6 py-10 text-center sm:px-10`}>
            <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {state.complete
                ? `Your ${state.modeName.toLowerCase()} is ready.`
                : "You’ve deferred the remaining questions."}
            </p>
            <Link href={state.complete ? finishHref(state.needsPriorities) : `/quiz/${slug}?view=results`} className={`${primaryButton} mt-6`}>
              {state.complete ? "See your results" : "See your current result"}
              <span aria-hidden="true">→</span>
            </Link>
            {!state.complete && state.deferredCount > 0 && (
              <form action={reviewDeferredAction.bind(null, slug)} className="mt-3">
                <button type="submit" className={ghostButton}>
                  Review {state.deferredCount} skipped {state.deferredCount === 1 ? "question" : "questions"}
                </button>
              </form>
            )}
            {state.mode === "deep" && (
              <div className="mt-8 border-t border-slate-950/6 pt-6 dark:border-white/6">
                <p className="text-sm text-slate-600 dark:text-slate-300">Want a sharper read first?</p>
                <div className={`${segmented} mt-3`}>
                  {ROUND_SIZES.map((size) => (
                    <form key={size} action={sharpenAction.bind(null, slug, size)}>
                      <button type="submit" className={segmentedItem(false)}>
                        +{size} questions
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-500">
          {inRound
            ? "Saved after every answer. These questions target the positions that most affect your result."
            : "Saved after every answer. The number of questions adapts to your answers."}
        </p>
      </div>
    </div>
  );
}
