"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";
import type { SuiteToolId } from "@/lib/tools/views";

// Recently opened case files, dockets and views, per tool. Kept in this
// browser only: a convenience, not a saved list.

interface RecentItem {
  href: string;
  label: string;
}

const KEY = (tool: SuiteToolId) => `worldview-tool-recent-${tool}`;
const LIMIT = 8;
const EVENT = "worldview-tool-recent";

function read(tool: SuiteToolId): RecentItem[] {
  try {
    const value = readStoredJson("local", KEY(tool));
    return Array.isArray(value)
      ? value.filter((x): x is RecentItem => Boolean(x) && typeof x.href === "string" && typeof x.label === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Records the current page in the tool's recent list. Renders nothing. */
export function RecordVisit({ tool, href, label }: { tool: SuiteToolId; href: string; label: string }) {
  useEffect(() => {
    try {
      const next = [{ href, label }, ...read(tool).filter((x) => x.href !== href)].slice(0, LIMIT);
      writeStoredJson("local", KEY(tool), next);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Storage unavailable (private window); recent items simply don't persist.
    }
  }, [tool, href, label]);
  return null;
}

export function RecentItems({ tool, label }: { tool: SuiteToolId; label: string }) {
  const pathname = usePathname();
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(read(tool));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [tool]);

  if (!items.length) return null;
  return (
    <div>
      <p className="px-3 text-xs font-semibold text-slate-400">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`block truncate rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  current
                    ? "bg-slate-100 font-medium text-slate-950 dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
