"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { QuizShareButton } from "./quiz-share";

export interface NavGroup {
  label: string;
  items: { id: string; label: string }[];
}

// The results' table of contents: a sticky sidebar from lg up, a sticky
// horizontal bar under the site header below that. The section in view is
// highlighted. A hash naming a closed <details> (an axis, a match) opens it,
// so those stay linkable.
export function ResultsNav({
  groups,
  name,
  match,
  color,
  shareTitle,
}: {
  groups: NavGroup[];
  name: string;
  match: number | null;
  color: string;
  shareTitle: string;
}) {
  const items = groups.flatMap((g) => g.items);
  const key = items.map((i) => i.id).join();
  const [active, setActive] = useState(items[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = key.split(",");
    let frame = 0;
    const update = () => {
      frame = 0;
      // The last section whose top has passed a line a third of the way down.
      const line = window.innerHeight / 3;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = ids.at(-1)!;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      let opened = false;
      for (let d: HTMLDetailsElement | null = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
        if (!d.open) opened = d.open = true;
      }
      if (opened) el.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  // Keep the active pill in view in the horizontal bar.
  useEffect(() => {
    const bar = barRef.current;
    const pill = bar?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!bar || !pill || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: pill.offsetLeft - bar.clientWidth / 2 + pill.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label="Results sections"
      className="sticky top-14 z-30 -mx-4 min-w-0 self-start border-b border-slate-200 bg-[#f7f8fa]/90 backdrop-blur-xl sm:-mx-8 lg:top-20 lg:mx-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none dark:border-slate-800 dark:bg-[#080b12]/90 lg:dark:bg-transparent"
    >
      {/* Below lg: one scrolling row of pills. */}
      <div ref={barRef} className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-8 lg:hidden">
        {items.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            data-id={i.id}
            aria-current={active === i.id ? "location" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active === i.id
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {i.label}
          </a>
        ))}
      </div>

      {/* lg and up: a compact result header over the table of contents. */}
      <div className="hidden lg:block">
        <a href="#top" className="group block rounded-xl px-3 py-2 hover:bg-slate-950/5 dark:hover:bg-white/5">
          <span className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950 dark:text-white">{name}</span>
            {match !== null && <span className="text-sm font-semibold text-slate-700 tabular-nums dark:text-slate-200">{match}%</span>}
          </span>
        </a>
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 text-xs font-medium text-slate-500 dark:text-slate-400">{g.label}</p>
              <ul className="mt-1 space-y-px">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <a
                      href={`#${i.id}`}
                      aria-current={active === i.id ? "location" : undefined}
                      className={`relative block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        active === i.id
                          ? "bg-white font-semibold text-slate-950 shadow-sm ring-1 ring-slate-950/5 dark:bg-slate-900 dark:text-white dark:ring-white/10"
                          : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                      }`}
                    >
                      {active === i.id && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full" style={{ backgroundColor: color }} />}
                      {i.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
          <QuizShareButton
            title={shareTitle}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          />
          <a
            href="#top"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ArrowUp size={14} aria-hidden />
            Top
          </a>
        </div>
      </div>
    </nav>
  );
}
