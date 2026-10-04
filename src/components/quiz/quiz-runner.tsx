"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleHelp } from "lucide-react";
import { submitAnswerAction } from "@/lib/actions/quiz";
import type { AnsweredItem, RunnerItem, RunnerState } from "@/lib/quiz/runner";
import type { QuizAnswer } from "@/lib/quiz/engine";

// Agree on the left, matching keys 1–7.
const SCALE: { value: number; label: string }[] = [
  { value: 3, label: "Strongly agree" },
  { value: 2, label: "Agree" },
  { value: 1, label: "Somewhat agree" },
  { value: 0, label: "Neutral" },
  { value: -1, label: "Somewhat disagree" },
  { value: -2, label: "Disagree" },
  { value: -3, label: "Strongly disagree" },
];

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
  const [pending, startTransition] = useTransition();

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
      startTransition(async () => {
        const res = await submitAnswerAction(slug, answer);
        if (!res.ok) {
          setError(res.error);
          return;
        }
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

  // Keyboard: 1–7 on the agreement scale, 1–n for options, S to skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "s" || e.key === "S") return submit(null);
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

  const pct = Math.round(state.progress * 100);
  const shownLabel = SCALE.find((s) => s.value === (hovered ?? current))?.label;
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            {state.answeredCount} answered · {pct}% of your profile settled
          </span>
          <Link href={`/quiz/${slug}?view=results`} className="hover:text-slate-900 dark:hover:text-white">
            See results so far →
          </Link>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-slate-900 transition-[width] duration-500 dark:bg-slate-100" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {item ? (
        <section
          aria-busy={pending}
          className={`rounded-3xl border border-slate-800 bg-slate-950 px-6 py-8 text-slate-100 shadow-xl shadow-black/15 transition-opacity sm:px-10 sm:py-10 ${pending ? "opacity-60" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
              {item.kind === "choice" ? item.issue : "Do you agree?"}
            </p>
            {editing && (
              <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                Changing an earlier answer
              </span>
            )}
          </div>
          <h2 className="mt-3 text-2xl leading-snug font-semibold tracking-tight text-balance text-white sm:text-[1.75rem]">
            {item.kind === "statement" ? item.text : item.prompt}
          </h2>
          <details key={item.id} className="group mt-4 w-fit max-w-full">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:outline-none">
              <CircleHelp size={15} aria-hidden="true" />
              What does this mean?
              <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-slate-300">
              {item.explanation}
            </p>
          </details>

          {item.kind === "statement" ? (
            <div className="mt-10">
              <div className="flex items-center justify-between gap-1 sm:gap-3" onMouseLeave={() => setHovered(null)}>
                {SCALE.map((s) => {
                  const selected = current === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-label={s.label}
                      aria-pressed={selected}
                      title={s.label}
                      disabled={pending}
                      onClick={() => submit(s.value)}
                      onMouseEnter={() => setHovered(s.value)}
                      onFocus={() => setHovered(s.value)}
                      onBlur={() => setHovered(null)}
                      className={`shrink-0 rounded-full border-2 transition-all duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:cursor-wait ${CIRCLE_SIZE[Math.abs(s.value)]} ${toneClass(s.value, selected)}`}
                    />
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <span className="font-medium text-emerald-400">Agree</span>
                <span className="text-center whitespace-nowrap text-slate-400" aria-live="polite">
                  {shownLabel ?? " "}
                </span>
                <span className="text-right font-medium text-violet-400">Disagree</span>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-2.5">
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
                        ? "border-slate-400 bg-slate-800 text-white"
                        : "border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors ${item.selection === "multiple" ? "rounded-md" : "rounded-full"} ${
                        selected
                          ? "border-white"
                          : "border-slate-600 group-hover:border-slate-400"
                      }`}
                    >
                      {selected && <span className={`size-2.5 bg-white ${item.selection === "multiple" ? "rounded-sm" : "rounded-full"}`} />}
                    </span>
                    {o.text}
                  </button>
                );
              })}
              {item.isScreener && (
                <fieldset className="mt-5 border-t border-slate-800 pt-5">
                  <legend className="px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    How important is this issue to you?
                  </legend>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={selectedImportance === level}
                        onClick={() => setImportance(level)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${selectedImportance === level ? "border-slate-300 bg-slate-800 text-white" : "border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"}`}
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
                  className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {item.selection === "multiple"
                    ? `Continue with ${selectedMultiple.length} ${selectedMultiple.length === 1 ? "selection" : "selections"}`
                    : "Continue"}
                </button>
              )}
            </div>
          )}

          <div className="mt-10 flex items-center justify-between border-t border-slate-800 pt-5">
            <button
              type="button"
              onClick={back}
              disabled={!canGoBack || pending}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              ← Back
            </button>
            <div className="flex items-center gap-1">
              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  Keep answer
                </button>
              )}
              <button
                type="button"
                onClick={() => submit(null)}
                disabled={pending}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-slate-800 hover:text-white ${
                  current === null ? "font-semibold text-white" : "text-slate-400"
                }`}
              >
                Skip
              </button>
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-800 bg-slate-950 px-6 py-12 text-center text-slate-100 shadow-xl shadow-black/15">
          <p className="text-xl font-semibold text-white">Your profile is complete.</p>
          <Link href={`/quiz/${slug}`} className="mt-4 inline-block text-sm font-medium text-slate-300 hover:text-white">
            See your results →
          </Link>
        </section>
      )}

      <p className="text-center text-xs text-slate-400">Your progress saves after every answer.</p>
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
      ? "border-emerald-500 bg-emerald-500"
      : "border-emerald-500/70 hover:bg-emerald-500/15 focus-visible:ring-emerald-500";
  }
  if (value < 0) {
    return selected
      ? "border-violet-500 bg-violet-500"
      : "border-violet-500/70 hover:bg-violet-500/15 focus-visible:ring-violet-500";
  }
  return selected
    ? "border-slate-400 bg-slate-400"
    : "border-slate-600 hover:bg-slate-400/15 focus-visible:ring-slate-400";
}
