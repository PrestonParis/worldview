"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { profileIcons } from "./profile-icons";
import type { ProfileTabId } from "@/lib/people/profile-modules";

// Sticky subnavigation across the profile's modules. Each module is its own
// cached route, so the tabs are real links; the active one scrolls into view
// on narrow screens.
export function ProfileNav({ base, tabs }: { base: string; tabs: { id: ProfileTabId; label: string; href: string }[] }) {
  const pathname = usePathname();
  const active = tabs.find((t) => t.href === pathname)?.id ?? (pathname === base ? "overview" : null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // Horizontal only: scrollIntoView would also scroll the page.
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[aria-current=page]");
    if (list && item) list.scrollLeft = item.offsetLeft - (list.clientWidth - item.clientWidth) / 2;
  }, [active]);

  return (
    <nav aria-label="Profile sections" className="sticky top-14 z-20 -mx-4 mt-5 border-b border-slate-200 bg-[#f7f8fa]/90 dark:bg-[#080b12]/90 px-4 backdrop-blur sm:mx-0 sm:px-0 dark:border-slate-800">
      <ul ref={listRef} className="flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = profileIcons[tab.id];
          const current = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0">
              <Link
                href={tab.href}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                  current ? "text-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {tab.label}
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600 transition-transform duration-300 dark:bg-indigo-400 ${current ? "scale-x-100" : "scale-x-0"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
