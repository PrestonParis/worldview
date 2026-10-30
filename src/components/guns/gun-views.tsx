"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useGunSelection } from "./selection";

export interface GunView {
  id: string;
  label: string;
  kicker: string;
  figure: string;
  caption: string;
  scope: string;
  content: ReactNode;
}

// The workspaces below the Policy Explorer: a strip of previews, one open at
// a time, in the URL as ?view=. A #id link opens the matching workspace.
export function GunViews({ views }: { views: GunView[] }) {
  const sel = useGunSelection();
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

  // Opening a workspace from elsewhere on the page (the explorer's evidence
  // link) scrolls to it too.
  const lastView = useRef(sel.view);
  useEffect(() => {
    if (sel.view && sel.view !== lastView.current) scrollOnOpen.current = true;
    lastView.current = sel.view;
    if (!open || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, sel.view]);

  const pick = (id: string) => {
    sel.set({ view: id === sel.view ? null : id });
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Workspaces" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {views.map((v) => {
          const on = v.id === open?.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="gun-view"
              onClick={() => pick(v.id)}
              className={`flex min-w-0 flex-col rounded-2xl p-4 text-left transition-colors ${
                on
                  ? "bg-slate-900 text-white ring-1 ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white"
                  : "bg-white ring-1 ring-slate-200 hover:ring-slate-400 dark:bg-slate-950 dark:ring-slate-800 dark:hover:ring-slate-600"
              }`}
            >
              <span className={`text-sm font-semibold ${on ? "" : "text-slate-950 dark:text-white"}`}>{v.label}</span>
              <span className={`text-xs ${on ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>{v.kicker}</span>
              <span className="mt-3 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{v.figure}</span>
              <span className={`mt-1 text-[11px] leading-4 ${on ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>
                {v.caption}
              </span>
            </button>
          );
        })}
      </div>

      {open && (
        <div ref={panel} id="gun-view" role="tabpanel" aria-label={open.label} className="scroll-mt-20 space-y-6" style={{ animation: "chapter-in 220ms ease-out" }}>
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
          <div className="space-y-6">{open.content}</div>
        </div>
      )}
    </div>
  );
}
