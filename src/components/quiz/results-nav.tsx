"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuizShareButton } from "./quiz-share";

export interface ViewLink {
  id: string;
  label: string;
}

// The header over a drill-down view (the ranking, the map, the axes, the
// issues): back to the summary, the result, and a switcher between views.
// A hash naming a closed <details> (an axis, a match) opens it, so those
// stay linkable from the summary.
export function ResultsViewHeader({
  slug,
  views,
  current,
  name,
  match,
  color,
  shareTitle,
}: {
  slug: string;
  views: ViewLink[];
  current: string;
  name: string;
  match: number | null;
  color: string;
  shareTitle: string;
}) {
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
    // A client navigation can land before the URL's hash is in place.
    const frame = requestAnimationFrame(open);
    window.addEventListener("hashchange", open);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", open);
    };
  }, [current]);

  return (
    <nav
      aria-label="Result views"
      className="sticky top-14 z-30 -mx-4 border-b border-slate-200 bg-[#f7f8fa]/90 backdrop-blur-xl sm:-mx-8 lg:top-20 lg:mx-0 lg:rounded-xl lg:border dark:border-slate-800 dark:bg-[#080b12]/90"
    >
      <div className="flex items-center gap-3 px-4 pt-2.5 sm:px-8 lg:px-4">
        <Link
          href={`/quiz/${slug}?view=results`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft size={15} aria-hidden />
          Summary
        </Link>
        <span aria-hidden className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate font-semibold text-slate-950 dark:text-white">{name}</span>
          {match !== null && <span className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">{match}%</span>}
        </span>
        <QuizShareButton
          title={shareTitle}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        />
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-8 lg:px-3">
        {views.map((v) => (
          <Link
            key={v.id}
            href={`/quiz/${slug}?view=${v.id}`}
            aria-current={current === v.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              current === v.id
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
