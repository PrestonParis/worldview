"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ModelExplorerTab {
  id: string;
  label: string;
  count?: string;
  title: string;
  description: string;
  panel: ReactNode;
}

// Tabs over server-rendered panels; only the active tab is client state.
// Each tab is linkable as #<id> (e.g. /quiz#traditions).
export function UnderTheHood({ tabs }: { tabs: ModelExplorerTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const base = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0];

  // Open the tab named in the URL hash, on load and when a link changes it.
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (!tabs.some((t) => t.id === id)) return;
      setActive(id);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    };
    if (window.location.hash) sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [tabs]);

  // The underline slides to the active tab.
  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[tabs.findIndex((t) => t.id === active)];
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, tabs]);

  const choose = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };

  const onKey = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    choose(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className="scroll-mt-20">
      <div className="relative -mx-2 overflow-x-auto px-2">
        <div role="tablist" aria-label="Explore the quiz model" className="relative flex gap-1 border-b border-slate-950/8 dark:border-white/8">
          {tabs.map((tab, index) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`${base}-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => choose(tab.id)}
                onKeyDown={(event) => onKey(event, index)}
                className={`flex shrink-0 items-baseline gap-1.5 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-950 dark:focus-visible:outline-white ${
                  isActive ? "text-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
                {tab.count && <span className="text-xs text-slate-400 tabular-nums dark:text-slate-500">{tab.count}</span>}
              </button>
            );
          })}
          {bar && (
            <span
              aria-hidden="true"
              className="absolute -bottom-px h-0.5 rounded-full bg-slate-950 transition-all duration-300 ease-out dark:bg-white"
              style={{ left: bar.left + 12, width: Math.max(0, bar.width - 24) }}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 py-7 sm:py-9 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <header key={selected.id} className="quiz-step">
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{selected.title}</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.description}</p>
        </header>

        <div className="min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="tabpanel"
              id={`${base}-panel-${tab.id}`}
              aria-labelledby={`${base}-tab-${tab.id}`}
              hidden={active !== tab.id}
              tabIndex={0}
              className="quiz-step min-h-64 focus-visible:outline-none"
            >
              {tab.panel}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
