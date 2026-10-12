"use client";

import { useEffect, useRef, useState } from "react";

// Sticky in-page navigation for long data pages. Highlights the section
// being read (the last one whose top has passed the nav) and keeps the
// active link scrolled into view on narrow screens.
export function SectionNav({ sections }: { sections: readonly (readonly [id: string, label: string])[] }) {
  const [active, setActive] = useState<string>(sections[0]?.[0] ?? "");
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const update = () => {
      const line = 140; // just below the site header + this nav
      let current = els[0]?.id ?? "";
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      // At the very bottom, the last section is the one being read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els.at(-1)?.id ?? current;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  useEffect(() => {
    const ul = list.current;
    const link = ul?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!ul || !link) return;
    const { offsetLeft, offsetWidth } = link;
    if (offsetLeft < ul.scrollLeft || offsetLeft + offsetWidth > ul.scrollLeft + ul.clientWidth) {
      ul.scrollTo({ left: offsetLeft - 16, behavior: "smooth" });
    }
  }, [active]);

  const index = sections.findIndex(([id]) => id === active);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-20 -mx-4 border-y sm:-mx-8 border-slate-100 bg-white/90 backdrop-blur dark:border-slate-900 dark:bg-slate-950/90"
    >
      <ul ref={list} className="flex gap-1 overflow-x-auto px-4 py-2 text-sm whitespace-nowrap sm:px-8">
        {sections.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              data-id={id}
              aria-current={id === active ? "location" : undefined}
              className={`block rounded-md px-2.5 py-1 ${
                id === active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              }`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <div className="h-0.5 bg-slate-100 dark:bg-slate-900" aria-hidden>
        <div
          className="h-full bg-slate-400 transition-[width] dark:bg-slate-500"
          style={{ width: `${((Math.max(0, index) + 1) / sections.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
