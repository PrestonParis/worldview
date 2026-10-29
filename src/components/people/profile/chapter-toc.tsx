"use client";

import { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";

interface Chapter {
  key: string;
  title: string;
}

// The biography's chapter list: a sticky side column on wide screens with the
// chapter being read highlighted, and a fold-out list above the text otherwise.
export function ChapterToc({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(chapters[0]?.key ?? "");

  useEffect(() => {
    const sections = chapters.map((c) => document.getElementById(c.key)).filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    // The last chapter whose top has passed the reading line (just under the
    // sticky header and tab bar).
    const update = () => {
      const line = 160;
      let current = sections[0].id;
      for (const section of sections) if (section.getBoundingClientRect().top <= line) current = section.id;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [chapters]);

  const list = (
    <ol className="space-y-0.5 text-sm">
      {chapters.map((c, i) => {
        const current = c.key === active;
        return (
          <li key={c.key}>
            <a
              href={`#${c.key}`}
              aria-current={current ? "location" : undefined}
              className={`flex gap-2 rounded-lg px-2.5 py-1.5 leading-5 transition-colors ${
                current
                  ? "bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span className={`w-4 shrink-0 tabular-nums ${current ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}`}>{i + 1}</span>
              <span>{c.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <nav aria-label="Chapters" className="hidden lg:block">
        <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto">
          <p className="mb-2 flex items-center gap-2 px-2.5 text-xs font-semibold text-slate-400">
            <ListOrdered aria-hidden className="h-3.5 w-3.5" /> Chapters
          </p>
          {list}
        </div>
      </nav>
      <details className="group order-first rounded-2xl border border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-950">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          <ListOrdered aria-hidden className="h-4 w-4" /> {chapters.length} chapters
          <span aria-hidden className="ml-auto text-slate-400 transition group-open:rotate-90">›</span>
        </summary>
        <nav aria-label="Chapters" className="border-t border-slate-100 p-2 dark:border-slate-800">
          {list}
        </nav>
      </details>
    </>
  );
}
