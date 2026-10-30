"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCrimeSelection } from "./selection";
import { Segmented } from "./segmented";

export interface CrimeView {
  id: string;
  label: string;
  kicker: string; // what the view answers, in a few words
  figure: string; // the preview's headline number
  caption: string; // what the figure is, with its own year
  spark?: number[];
  scope: string; // the view's own date range and sources
  content: ReactNode;
}

// The analyses below the Atlas: a strip of previews, one open at a time.
// The open view is part of the shared selection, so it is in the URL; old
// #section links open the matching view.
export function CrimeViews({ views }: { views: CrimeView[] }) {
  const sel = useCrimeSelection();
  const open = views.find((v) => v.id === sel.view) ?? null;
  const panel = useRef<HTMLDivElement>(null);
  const scrollOnOpen = useRef(false);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (views.some((v) => v.id === id)) {
        scrollOnOpen.current = true;
        sel.set({ view: id });
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  useEffect(() => {
    if (!open || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const pick = (id: string) => {
    scrollOnOpen.current = id !== sel.view;
    sel.set({ view: id === sel.view ? null : id });
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Analyses" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {views.map((v) => {
          const on = v.id === open?.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="crime-view"
              onClick={() => pick(v.id)}
              className={`group flex min-w-0 flex-col rounded-2xl p-4 text-left transition-colors ${
                on
                  ? "bg-slate-900 text-white ring-1 ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white"
                  : "bg-white ring-1 ring-slate-200 hover:ring-slate-400 dark:bg-slate-950 dark:ring-slate-800 dark:hover:ring-slate-600"
              }`}
            >
              <span className={`text-sm font-semibold ${on ? "" : "text-slate-950 dark:text-white"}`}>{v.label}</span>
              <span className={`text-xs ${on ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>{v.kicker}</span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="text-xl font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-2xl">{v.figure}</span>
                {v.spark && <Spark values={v.spark} />}
              </span>
              <span className={`mt-1 text-[11px] leading-4 ${on ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>{v.caption}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div ref={panel} id="crime-view" role="tabpanel" aria-label={open.label} className="scroll-mt-20 space-y-6" style={{ animation: "chapter-in 220ms ease-out" }}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{open.label}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{open.scope}</p>
            </div>
            <button
              type="button"
              onClick={() => pick(open.id)}
              aria-label={`Close ${open.label}`}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          {open.content}
        </div>
      )}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const [w, h] = [64, 24];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0 opacity-80">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Tabs inside one view (the Data Explorer), each tab rendered on the server.
export function ViewTabs({ label, tabs }: { label: string; tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [tab, setTab] = useState(tabs[0]?.id ?? "");
  return (
    <div className="space-y-5">
      <Segmented label={label} value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t.id, label: t.label }))} />
      {tabs.filter((t) => t.id === tab).map((t) => (
        <div key={t.id} className="space-y-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
