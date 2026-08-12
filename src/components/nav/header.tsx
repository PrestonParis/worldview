"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { toolPages, dataAdminPage } from "@/lib/nav";

interface PillRect {
  left: number;
  width: number;
}

export function Header() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);

  useLayoutEffect(() => {
    const activeLink = linkRefs.current.get(pathname);
    const nav = navRef.current;
    if (!activeLink || !nav) {
      setPill(null);
      return;
    }
    setPill({
      left: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
    });
  }, [pathname]);

  return (
    <header className="header-enter sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex h-14 items-center gap-6 px-6">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100"
        >
          Worldview
        </Link>

        <div ref={navRef} className="relative flex flex-1 items-center gap-1 overflow-x-auto">
          {pill ? (
            <span
              aria-hidden
              className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md bg-slate-100 transition-[left,width] duration-300 ease-out dark:bg-slate-800"
              style={{ left: pill.left, width: pill.width }}
            />
          ) : null}
          {toolPages.map((page) => {
            const isActive = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                ref={(el) => {
                  if (el) linkRefs.current.set(page.href, el);
                  else linkRefs.current.delete(page.href);
                }}
                className={`relative z-10 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {page.navLabel}
              </Link>
            );
          })}
        </div>

        <Link
          href={dataAdminPage.href}
          className="shrink-0 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Manage Data
        </Link>
      </div>
    </header>
  );
}
