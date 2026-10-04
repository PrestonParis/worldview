"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { generalPages, primaryPages } from "@/lib/nav";
import { GlobalSearch } from "@/components/search/global-search";
import { NewMenu } from "@/components/nav/new-menu";

interface PillRect {
  left: number;
  width: number;
}

export function Header({ accountLabel }: { accountLabel: string | null }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const generalRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const generalActive = generalPages.some(
    (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
  );
  const activeKey = generalActive
    ? "general"
    : primaryPages.find(
        (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
      )?.href;

  useLayoutEffect(() => {
    const activeLink = activeKey ? linkRefs.current.get(activeKey) : undefined;
    const nav = navRef.current;
    if (!activeLink || !nav) {
      setPill(null);
      return;
    }
    setPill({
      left: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
    });
  }, [activeKey]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!generalRef.current?.contains(event.target as Node)) setGeneralOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setGeneralOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

        <div ref={navRef} className="relative flex flex-1 items-center gap-1">
          {pill ? (
            <span
              aria-hidden
              className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md bg-slate-100 transition-[left,width] duration-300 ease-out dark:bg-slate-800"
              style={{ left: pill.left, width: pill.width }}
            />
          ) : null}
          <div ref={generalRef} className="relative z-20 shrink-0">
            <button
              type="button"
              ref={(el) => {
                if (el) linkRefs.current.set("general", el);
                else linkRefs.current.delete("general");
              }}
              aria-haspopup="menu"
              aria-expanded={generalOpen}
              onClick={() => setGeneralOpen((open) => !open)}
              className={`relative z-10 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                generalActive
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              General
              <ChevronDown
                size={14}
                className={`transition-transform ${generalOpen ? "rotate-180" : ""}`}
              />
            </button>

            {generalOpen ? (
              <div
                role="menu"
                className="absolute top-full left-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-950"
              >
                {generalPages.map((page) => {
                  const isActive = pathname === page.href || pathname.startsWith(`${page.href}/`);
                  return (
                    <Link
                      key={page.href}
                      href={page.href}
                      role="menuitem"
                      onClick={() => setGeneralOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 transition-colors ${
                        isActive
                          ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span className="block text-sm font-medium">{page.navLabel}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{page.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {primaryPages.map((page) => {
            const isActive = pathname === page.href || pathname.startsWith(`${page.href}/`);
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

        {accountLabel ? <NewMenu /> : null}

        {accountLabel ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/account"
              className="hidden max-w-48 truncate rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {accountLabel}
            </Link>
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
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
