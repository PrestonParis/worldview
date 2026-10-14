"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleHelp } from "lucide-react";
import { runnerStateAction, submitAnswerAction } from "@/lib/actions/quiz";
import type { AnsweredItem, RunnerItem, RunnerState } from "@/lib/quiz/runner";
import type { QuizAnswer } from "@/lib/quiz/engine";

// Disagree on the left, agree on the right, matching keys 1–7.
const SCALE: { value: number; label: string }[] = [
  { value: -3, label: "Strongly disagree" },
  { value: -2, label: "Disagree" },
  { value: -1, label: "Somewhat disagree" },
  { value: 0, label: "Neutral" },
  { value: 1, label: "Somewhat agree" },
  { value: 2, label: "Agree" },
  { value: 3, label: "Strongly agree" },
];

// The results preview link appears once there's something to show.
const PREVIEW_AFTER = 15;

// Latest answer count per quiz in this tab, to tell when the page was
// restored with an older state than the one last seen.
const seenKey = (slug: string) => `quiz-answered:${slug}`;
function readSeen(slug: string): number {
  try {
    return Number(sessionStorage.getItem(seenKey(slug)) ?? 0);
  } catch {
    return 0;
  }
}
function writeSeen(slug: string, count: number) {
  try {
    sessionStorage.setItem(seenKey(slug), String(count));
  } catch {}
}

// Showing an earlier answer to change it: either stepped back to from the
// recent list, or opened directly from a results-page link.
type Editing = { answered: AnsweredItem; recentIndex: number | null };

export function QuizRunner({
  slug,
  initial,
  initialEdit,
}: {
  slug: string;
  initial: RunnerState;
  initialEdit?: AnsweredItem;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [editing, setEditing] = useState<Editing | null>(initialEdit ? { answered: initialEdit, recentIndex: null } : null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [single, setSingle] = useState<string | null>(null);
  const [importance, setImportance] = useState<1 | 2 | 3 | null>(null);
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
          router.replace(`/quiz/${slug}`);
          router.refresh();
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initial.answeredCount, initialEdit, router]);

  const item: RunnerItem | null = editing ? editing.answered.item : state.next;
  const current = editing ? editing.answered.value : undefined;

  const submit = useCallback(
    (value: number | string | string[] | null, answerImportance?: 1 | 2 | 3) => {
      if (!item || pending) return;
      const answer: QuizAnswer =
        item.kind === "statement"
          ? { kind: "statement", id: item.id, value: value as number | null }
          : { kind: "choice", id: item.id, value: value as string | string[] | null, importance: answerImportance };
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
        setHovered(null);
        setMulti([]);
        setSingle(null);
        setImportance(null);
        setState(res.data);
        if (res.data.complete && (!res.data.next || wasDirectEdit)) {
          router.replace(wasDirectEdit ? `/quiz/${slug}` : `/quiz/${slug}?reveal=1`);
          router.refresh();
        }
      });
    },
    [item, pending, slug, editing, router],
  );

  const back = () => {
    const idx = editing ? (editing.recentIndex ?? state.recent.length) - 1 : state.recent.length - 1;
    if (idx < 0) return;
    setMulti([]);
    setSingle(null);
    setImportance(null);
    setEditing({ answered: state.recent[idx], recentIndex: idx });
  };
  const canGoBack = editing ? (editing.recentIndex ?? state.recent.length) > 0 : state.recent.length > 0;

  // Keyboard: 1–7 on the agreement scale, 1–n for options, N (or S) to skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (["s", "S", "n", "N"].includes(e.key)) return submit(null);
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
  }, [item, submit]);

  const shownValue = hovered ?? (typeof current === "number" ? current : null);
  const shownLabel = SCALE.find((s) => s.value === shownValue)?.label;
  const canPreview = state.answeredCount >= PREVIEW_AFTER;
  const selectedMultiple =
    item?.kind === "choice" && item.selection === "multiple"
      ? multi.length > 0
        ? multi
        : Array.isArray(current)
          ? current
          : []
      : [];
  const selectedSingle =
    item?.kind === "choice" && item.selection === "single"
      ? single ?? (typeof current === "string" ? current : null)
      : null;
  const selectedImportance = importance ?? editing?.answered.importance ?? 2;

  const toggleMultiple = (id: string, exclusive: boolean) => {
    const base = selectedMultiple;
    if (base.includes(id)) return setMulti(base.filter((value) => value !== id));
    if (exclusive) return setMulti([id]);
    const exclusiveIds = new Set(item?.kind === "choice" ? item.options.filter((o) => o.exclusive).map((o) => o.id) : []);
    setMulti([...base.filter((value) => !exclusiveIds.has(value)), id]);
  };

  // The quiz takes over the content area, full bleed under the header, so
  // the question is the whole page. Follows the site theme.
  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-50 text-slate-900 sm:-mx-8 dark:bg-slate-950 dark:text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-disagree-500/20 blur-3xl dark:bg-disagree-500/15" />
        <div className="absolute -right-32 -bottom-40 size-[34rem] rounded-full bg-agree-500/20 blur-3xl dark:bg-agree-500/15" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(100_116_139/0.18)_1px,transparent_1px)] dark:bg-[radial-gradient(rgb(148_163_184/0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <header className="relative border-b border-slate-200 bg-white/70 backdrop-blur dark:border-white/5 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Political profile</p>
            <p className="mt-0.5 text-sm font-medium text-slate-950 tabular-nums dark:text-white">
              {state.answeredCount === 0 ? "Getting started" : `${state.answeredCount} answered`}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Meter label="Dimensions measured" value={state.axesMeasured} total={state.axesTotal} segmented />
            <Meter label="Issues covered" value={state.issuesDone} total={state.issuesTotal} />
          </div>
          {canPreview ? (
            <Link
              href={`/quiz/${slug}?view=results`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-900/5 hover:text-slate-950 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white"
            >
              Preview your profile →
            </Link>
          ) : (
            <span className="text-xs text-slate-500">Profile preview after {PREVIEW_AFTER} answers</span>
          )}
        </div>
      </header>

      <div className="relative mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        {item ? (
          <section aria-busy={pending} className={`transition-opacity ${pending ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="tracking-[0.14em] text-slate-500 uppercase">{item.area}</span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>
                <span className="text-slate-700 dark:text-slate-300">{item.topic}</span>
              </p>
              {editing && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Changing an earlier answer
                </span>
              )}
            </div>
            <h2 className="mt-4 text-2xl leading-snug font-semibold tracking-tight text-balance text-slate-950 sm:text-[2rem] dark:text-white sm:leading-tight">
              {item.kind === "statement" ? item.text : item.prompt}
            </h2>
            <details key={item.id} className="group mt-5 w-fit max-w-full">
              <summary className="-ml-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600 focus-visible:outline-none">
                <CircleHelp size={15} aria-hidden="true" />
                {item.kind === "statement" ? "Why this question?" : "What does this mean?"}
                <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 max-w-2xl border-l-2 border-slate-300 pl-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {item.explanation}
              </p>
            </details>

            {item.kind === "statement" ? (
              <div className="mt-12">
                <p
                  className={`mb-5 h-6 text-center text-base font-semibold ${shownValue === null ? "text-slate-400 dark:text-slate-600" : shownValue > 0 ? "text-agree-600 dark:text-agree-400" : shownValue < 0 ? "text-disagree-600 dark:text-disagree-400" : "text-slate-700 dark:text-slate-200"}`}
                  aria-live="polite"
                >
                  {shownLabel ?? "Pick a point on the scale"}
                </p>
                <div className="flex items-center justify-between gap-1 sm:gap-3" onMouseLeave={() => setHovered(null)}>
                  {SCALE.map((s, i) => {
                    const selected = current === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        aria-label={`${s.label} (key ${i + 1})`}
                        aria-pressed={selected}
                        title={s.label}
                        disabled={pending}
                        onClick={() => submit(s.value)}
                        onMouseEnter={() => setHovered(s.value)}
                        onFocus={() => setHovered(s.value)}
                        onBlur={() => setHovered(null)}
                        className={`shrink-0 rounded-full border-2 transition-all duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:cursor-wait ${CIRCLE_SIZE[Math.abs(s.value)]} ${toneClass(s.value, selected)}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 items-start text-xs font-medium sm:text-sm">
                  <span className="text-disagree-600 dark:text-disagree-400">Strongly disagree</span>
                  <span className="text-center text-slate-500 dark:text-slate-400">Neutral</span>
                  <span className="text-right text-agree-600 dark:text-agree-400">Strongly agree</span>
                </div>
              </div>
            ) : (
              <div className="mt-10 flex flex-col gap-2.5">
                {item.options.map((o) => {
                  const selected = item.selection === "multiple" ? selectedMultiple.includes(o.id) : selectedSingle === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={pending}
                      onClick={() => {
                        if (item.selection === "multiple") toggleMultiple(o.id, o.exclusive);
                        else if (item.isScreener) setSingle(o.id);
                        else submit(o.id);
                      }}
                      className={`group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left text-[15px] leading-snug transition-colors disabled:cursor-wait ${
                        selected
                          ? "border-slate-900 bg-white text-slate-950 ring-1 ring-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-white dark:ring-0"
                          : "border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors ${item.selection === "multiple" ? "rounded-md" : "rounded-full"} ${
                          selected
                            ? "border-slate-900 dark:border-white"
                            : "border-slate-300 group-hover:border-slate-500 dark:border-slate-600 dark:group-hover:border-slate-400"
                        }`}
                      >
                        {selected && <span className={`size-2.5 bg-slate-900 dark:bg-white ${item.selection === "multiple" ? "rounded-sm" : "rounded-full"}`} />}
                      </span>
                      {o.text}
                    </button>
                  );
                })}
                {item.isScreener && (
                  <fieldset className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
                    <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      How important is this issue to you?
                    </legend>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={selectedImportance === level}
                          onClick={() => setImportance(level)}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${selectedImportance === level ? "border-slate-900 bg-slate-900 text-white dark:border-slate-300 dark:bg-slate-800" : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-950 dark:border-white/10 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"}`}
                        >
                          {level === 1 ? "Low" : level === 2 ? "Medium" : "High"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {(item.selection === "multiple" || item.isScreener) && (
                  <button
                    type="button"
                    disabled={pending || (item.selection === "multiple" ? selectedMultiple.length === 0 : !selectedSingle)}
                    onClick={() => submit(item.selection === "multiple" ? selectedMultiple : selectedSingle!, item.isScreener ? selectedImportance : undefined)}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {item.selection === "multiple"
                      ? `Continue with ${selectedMultiple.length} ${selectedMultiple.length === 1 ? "selection" : "selections"}`
                      : "Continue"}
                  </button>
                )}
              </div>
            )}

            <div className="mt-12 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
              <button
                type="button"
                onClick={back}
                disabled={!canGoBack || pending}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white disabled:pointer-events-none disabled:opacity-40"
              >
                ← Back
              </button>
              <div className="flex items-center gap-1">
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    Keep answer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => submit(null)}
                  disabled={pending}
                  title="Skips the question. It doesn't count as a neutral answer."
                  className={`rounded-lg border px-3.5 py-1.5 text-sm transition-colors hover:bg-slate-900/5 hover:text-slate-950 dark:hover:bg-white/5 dark:hover:text-white ${
                    current === null ? "border-slate-500 font-semibold text-slate-950 dark:border-slate-400 dark:text-white" : "border-slate-300 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-transparent dark:text-slate-300"
                  }`}
                >
                  Not sure / skip
                </button>
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <p className="mt-6 text-xs leading-5 text-slate-500">
              {item.kind === "statement"
                ? "Neutral means you hold a middle view. Not sure skips the question and doesn't move your results."
                : "Not sure skips the question and doesn't move your results."}{" "}
              <span className="hidden sm:inline">
                Number keys answer, N skips.
              </span>
            </p>
          </section>
        ) : (
          <section className="py-12 text-center">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">Your profile is complete.</p>
            <Link href={`/quiz/${slug}`} className="mt-4 inline-block text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
              See your results →
            </Link>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-600">
          Saved after every answer. The number of questions adapts to your answers.
        </p>
      </div>
    </div>
  );
}

function Meter({ label, value, total, segmented }: { label: string; value: number; total: number; segmented?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">
        {label} <span className="font-medium text-slate-800 tabular-nums dark:text-slate-200">{value}/{total}</span>
      </p>
      {segmented ? (
        <div className="mt-1.5 flex gap-0.5" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1 w-1.5 rounded-full sm:w-2 ${i < value ? "bg-slate-700 dark:bg-slate-300" : "bg-slate-200 dark:bg-slate-800"}`} />
          ))}
        </div>
      ) : (
        <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-slate-200 sm:w-32 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full rounded-full bg-slate-700 transition-[width] dark:bg-slate-300 duration-500" style={{ width: `${(value / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// Circle diameter by strength: strongest at the ends, neutral smallest.
const CIRCLE_SIZE: Record<number, string> = {
  3: "size-11 sm:size-14",
  2: "size-9 sm:size-11",
  1: "size-7 sm:size-9",
  0: "size-6 sm:size-7",
};

function toneClass(value: number, selected: boolean): string {
  if (value > 0) {
    return selected
      ? "border-agree-600 bg-agree-600 dark:border-agree-500 dark:bg-agree-500"
      : "border-agree-600/80 hover:bg-agree-500/15 focus-visible:ring-agree-500 dark:border-agree-500/70";
  }
  if (value < 0) {
    return selected
      ? "border-disagree-600 bg-disagree-600 dark:border-disagree-500 dark:bg-disagree-500"
      : "border-disagree-600/80 hover:bg-disagree-500/15 focus-visible:ring-disagree-500 dark:border-disagree-500/70";
  }
  return selected
    ? "border-slate-400 bg-slate-400"
    : "border-slate-300 hover:bg-slate-400/15 focus-visible:ring-slate-400 dark:border-slate-600";
}
