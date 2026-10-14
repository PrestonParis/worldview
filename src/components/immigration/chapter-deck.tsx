"use client";

import { Children, useState, useSyncExternalStore, type ReactNode } from "react";

export interface ImmigrationChapter {
  id: string;
  label: string;
  group: "Start" | "Core system" | "Population & places" | "Reference";
}

const subscribeToHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};

const readHash = () => window.location.hash.slice(1);

export function ImmigrationChapterDeck({ chapters, children }: { chapters: ImmigrationChapter[]; children: ReactNode }) {
  const items = Children.toArray(children);
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const hashIndex = chapters.findIndex((chapter) => chapter.id === hash);
  const [chosen, setChosen] = useState(0);
  const activeIndex = hashIndex >= 0 ? hashIndex : Math.min(chosen, chapters.length - 1);
  const active = chapters[activeIndex];

  const select = (index: number) => {
    setChosen(index);
    const chapter = chapters[index];
    if (!chapter) return;
    window.history.replaceState(null, "", `#${chapter.id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    document.getElementById("immigration-chapters")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const groups = [...new Set(chapters.map((chapter) => chapter.group))];

  return (
    <section id="immigration-chapters" className="scroll-mt-24 space-y-6">
      <label className="block lg:hidden">
        <span className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Explore immigration</span>
        <select value={activeIndex} onChange={(event) => select(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
          {chapters.map((chapter, index) => <option key={chapter.id} value={index}>{chapter.label}</option>)}
        </select>
      </label>

      <div className="grid items-start gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 lg:block" aria-label="Immigration explorer">
          <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">Explore immigration</p>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group}>
                {group !== "Start" && <p className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{group}</p>}
                <div className="space-y-0.5" role="tablist" aria-label={group}>
                  {chapters.map((chapter, index) => chapter.group === group && (
                    <button
                      key={chapter.id}
                      type="button"
                      role="tab"
                      aria-selected={index === activeIndex}
                      onClick={() => select(index)}
                      className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${index === activeIndex ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"}`}
                    >
                      {chapter.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div key={active.id} role="tabpanel" aria-label={active.label} className="min-w-0 motion-safe:animate-[chapter-in_240ms_ease-out]">
          {items[activeIndex]}
        </div>
      </div>

      <nav className="flex items-center justify-between border-t border-slate-200 pt-5 dark:border-slate-800" aria-label="Immigration chapters">
        <button type="button" disabled={activeIndex === 0} onClick={() => select(activeIndex - 1)} className="text-sm font-semibold text-slate-600 disabled:invisible dark:text-slate-300">← {chapters[activeIndex - 1]?.label}</button>
        <span className="text-xs text-slate-400">{activeIndex + 1} of {chapters.length}</span>
        <button type="button" disabled={activeIndex === chapters.length - 1} onClick={() => select(activeIndex + 1)} className="text-sm font-semibold text-slate-600 disabled:invisible dark:text-slate-300">{chapters[activeIndex + 1]?.label} →</button>
      </nav>
    </section>
  );
}
