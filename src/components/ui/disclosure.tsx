"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Secondary explanation tucked behind a one-line summary, so the data comes
// first. Opens itself when the URL hash points at it, so in-page links to
// its id still land on visible content.
export function Disclosure({ id, summary, children }: { id?: string; summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!id) return;
    const sync = () => {
      if (window.location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView();
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <details ref={ref} id={id} className="group scroll-mt-28 rounded-2xl border border-slate-200 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium text-slate-900 dark:text-white">
        {summary}
        <span aria-hidden className="text-slate-400 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}
