"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toolPages } from "@/lib/nav";
import { GlobalSearch } from "@/components/search/global-search";
import { NewMenu } from "@/components/nav/new-menu";

interface PillRect {
  left: number;
  width: number;
}

export function Header({ email }: { email: string | null }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
            <Image src="/logo.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Worldview
          </span>
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

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          {searchOpen ? (
            <div className="absolute top-full right-0 z-30 mt-2 w-80">
              <GlobalSearch placeholder="Search Worldview…" autoFocus />
            </div>
          ) : null}
        </div>

        <NewMenu />

        {email ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
