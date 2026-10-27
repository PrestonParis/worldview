"use client";

import { useEffect, useRef, useState } from "react";
import { SECTION_ICON, type SectionIconId } from "@/lib/politics/icons";

// Sticky in-page navigation for long data pages. Highlights the section
// being read (the last one whose top has passed the nav) and keeps the
// active link scrolled into view on narrow screens.
// An optional third entry names an icon from the shared section set.
export function SectionNav({
  sections,
  label = "Sections",
  inset = false,
  side = false,
}: {
  sections: readonly (readonly [id: string, label: string, icon?: SectionIconId])[];
  label?: string;
  // Inset: a rounded bar within the content column instead of edge to edge.
  inset?: boolean;
  // Side: a vertical list in a right-hand column on wide screens (place it in
  // an <aside> beside the content); the usual bar below that width.
  side?: boolean;
}) {
  const [active, setActive] = useState<string>(sections[0]?.[0] ?? "");
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const update = () => {
      const line = 140; // just below the site header + this nav
      let current = els[0]?.id ?? "";
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      // At the very bottom, the last section is the one being read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
        current = els.at(-1)?.id ?? current;
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
      aria-label={label}
      className={`sticky top-14 z-20 bg-white/90 backdrop-blur dark:bg-slate-950/90 ${
        side
          ? "-mx-4 border-y border-slate-100 sm:-mx-8 lg:top-20 lg:mx-0 lg:border-y-0 lg:bg-transparent lg:backdrop-blur-none dark:border-slate-900 lg:dark:bg-transparent"
          : inset
            ? "-mx-4 overflow-hidden border-y border-slate-200 sm:mx-0 sm:rounded-xl sm:border dark:border-slate-800"
            : "-mx-4 border-y border-slate-100 sm:-mx-8 dark:border-slate-900"
      }`}
    >
      <ul
        ref={list}
        className={`flex gap-1 overflow-x-auto py-2 text-sm whitespace-nowrap ${
          side
            ? "px-4 sm:px-8 lg:flex-col lg:overflow-visible lg:border-l lg:border-slate-200 lg:py-0 lg:pr-0 lg:pl-3 lg:dark:border-slate-800"
            : inset
              ? "px-4 sm:px-2"
              : "px-4 sm:px-8"
        }`}
      >
        {sections.map(([id, text, icon]) => {
          const Icon = icon ? SECTION_ICON[icon] : null;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                data-id={id}
                aria-current={id === active ? "location" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
                  id === active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                {Icon && <Icon size={15} aria-hidden className="shrink-0" />}
                {text}
              </a>
            </li>
          );
        })}
      </ul>
      <div className={`h-0.5 bg-slate-100 dark:bg-slate-900 ${side ? "lg:hidden" : ""}`} aria-hidden>
        <div
          className="h-full bg-slate-400 transition-[width] dark:bg-slate-500"
          style={{ width: `${((Math.max(0, index) + 1) / sections.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
