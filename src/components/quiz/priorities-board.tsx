"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { setPrioritiesAction } from "@/lib/actions/quiz";
import type { PriorityItem } from "@/lib/quiz/runner";
import { card, kbd, primaryButton } from "./styles";

type Level = 1 | 2 | 3;

const COLUMNS: { level: Level; label: string; hint: string }[] = [
  { level: 3, label: "High", hint: "Could decide your vote" },
  { level: 2, label: "Medium", hint: "Matters, but not above all" },
  { level: 1, label: "Low", hint: "Rarely on your mind" },
];

// Movement before a press becomes a drag, so a tap still selects.
const DRAG_THRESHOLD = 5;

type Drag = { id: string; startX: number; startY: number; x: number; y: number; active: boolean; over: Level | null };

// Every answered issue on one board: drag each into High, Medium, or Low.
// Everything starts in Medium. Tap an issue and then a column to move it
// without dragging; with the keyboard, ← and → move the focused issue.
export function PrioritiesBoard({ slug, items, continueHref }: { slug: string; items: PriorityItem[]; continueHref: string }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, Level>>(() =>
    Object.fromEntries(items.map((i) => [i.screenerId, i.importance ?? 2])),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  // Saves can overlap; only the newest result is reported.
  const saveSeq = useRef(0);

  const save = (next: Record<string, Level>) => {
    const seq = ++saveSeq.current;
    return setPrioritiesAction(slug, next).then((res) => {
      if (seq === saveSeq.current) setError(res.ok ? null : res.error);
      return res.ok;
    });
  };

  const move = (id: string, level: Level) => {
    setSelected(null);
    if (levels[id] === level) return;
    const next = { ...levels, [id]: level };
    setLevels(next);
    void save(next);
  };

  const columnAt = (x: number, y: number): Level | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-level]");
    return el ? (Number(el.dataset.level) as Level) : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, over: null });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const active = drag.active || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active, over: active ? columnAt(e.clientX, e.clientY) : null });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.active) {
      const level = columnAt(e.clientX, e.clientY);
      if (level) move(drag.id, level);
    } else {
      setSelected((s) => (s === drag.id ? null : drag.id));
    }
    setDrag(null);
  };

  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    const i = COLUMNS.findIndex((c) => c.level === levels[id]);
    const to = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : null;
    if (to === null || to < 0 || to >= COLUMNS.length) return;
    e.preventDefault();
    move(id, COLUMNS[to].level);
    // The button remounts in its new column; keep focus on it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-issue="${id}"]`)?.focus());
  };

  const finish = () =>
    startTransition(async () => {
      if (await save(levels)) router.push(continueHref);
    });

  const dragged = drag?.active ? items.find((i) => i.screenerId === drag.id) : undefined;

  return (
    <div className="-mx-4 -my-8 min-h-[calc(100dvh-3.5rem)] text-slate-900 sm:-mx-8 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <p className="text-sm text-slate-500 dark:text-slate-400">Last step</p>
        <h2 className="mt-2 text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-slate-950 sm:text-[2.25rem] dark:text-white">
          Which issues matter most to you?
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-600 dark:text-slate-300">
          Drag each issue into High, Medium, or Low. Everything starts in Medium, so only move what stands out. You can
          also tap an issue, then tap a column.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {COLUMNS.map((c) => {
            const inColumn = items.filter((i) => levels[i.screenerId] === c.level);
            const target = drag?.active ? drag.over === c.level : !!selected && levels[selected] !== c.level;
            return (
              <section
                key={c.level}
                data-level={c.level}
                aria-label={`${c.label} importance`}
                onClick={() => selected && move(selected, c.level)}
                className={`${card} flex min-h-40 flex-col p-4 transition-shadow ${
                  target ? "ring-2 ring-slate-950 dark:ring-white" : ""
                } ${selected && levels[selected] !== c.level ? "cursor-pointer" : ""}`}
              >
                <header className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{c.label}</h3>
                  <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">{inColumn.length}</span>
                </header>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.hint}</p>
                <ul className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
                  {inColumn.map((i) => {
                    const isSelected = selected === i.screenerId;
                    const isDragged = drag?.active && drag.id === i.screenerId;
                    return (
                      <li key={i.screenerId}>
                        <button
                          type="button"
                          data-issue={i.screenerId}
                          aria-pressed={isSelected}
                          aria-keyshortcuts="ArrowLeft ArrowRight"
                          onPointerDown={(e) => onPointerDown(e, i.screenerId)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onPointerCancel={() => setDrag(null)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected((s) => (s === i.screenerId ? null : i.screenerId));
                            } else onKeyDown(e, i.screenerId);
                          }}
                          className={`inline-flex touch-none items-center gap-1 rounded-lg py-1.5 pr-3 pl-1.5 text-sm select-none transition-all ${
                            isDragged ? "opacity-30" : ""
                          } ${
                            isSelected
                              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                              : "cursor-grab bg-slate-100 text-slate-800 ring-1 ring-slate-950/6 hover:ring-slate-950/25 active:cursor-grabbing dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:ring-white/30"
                          }`}
                        >
                          <GripVertical size={14} aria-hidden="true" className="opacity-50" />
                          {i.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {dragged && drag && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-50 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg bg-slate-950 py-1.5 pr-3 pl-1.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-950"
            style={{ left: drag.x, top: drag.y }}
          >
            <GripVertical size={14} className="opacity-50" />
            {dragged.name}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
            <span className={kbd}>←</span>
            <span className={kbd}>→</span> move the focused issue
          </p>
          <button type="button" onClick={finish} disabled={saving} className={`${primaryButton} w-full sm:w-auto`}>
            Continue to results <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
