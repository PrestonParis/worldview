"use client";

import { useState } from "react";
import Link from "next/link";

export interface LandscapeItem {
  id: string;
  name: string;
  type: string;
  href: string;
  side: "liberal" | "conservative" | "unplaced";
  blurb: string;
}

const TABS = [
  { key: "pundit", label: "Commentators" },
  { key: "journalist", label: "Journalists" },
  { key: "organization", label: "Organizations" },
] as const;

const COLUMNS = [
  { side: "liberal", label: "Left of center", color: "var(--viz-dem)" },
  { side: "unplaced", label: "Not placed on either side", color: "var(--viz-muted)" },
  { side: "conservative", label: "Right of center", color: "var(--viz-rep)" },
] as const;

const PREVIEW = 36;

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export function MovementLandscape({ items }: { items: LandscapeItem[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pundit");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inTab = items.filter((item) => item.type === tab);
  // Organizations without a side are mostly chambers, committees and
  // agencies — institutions, not part of a movement landscape.
  const columns = COLUMNS.filter((c) => tab !== "organization" || c.side !== "unplaced");

  return (
    <div>
      <div role="tablist" aria-label="Landscape type" className="inline-flex rounded-full border border-slate-200 p-1 dark:border-slate-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`mt-6 grid gap-4 ${columns.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {columns.map((column) => {
          const people = inTab.filter((item) => item.side === column.side).sort((a, b) => a.name.localeCompare(b.name));
          const key = `${tab}-${column.side}`;
          const shown = expanded.has(key) ? people : people.slice(0, PREVIEW);
          return (
            <section
              key={column.side}
              className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              style={{ background: `color-mix(in srgb, ${column.color} 6%, transparent)` }}
            >
              <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.color }} />
                  {column.label}
                </span>
                <span className="font-normal text-slate-400 tabular-nums">{people.length}</span>
              </h3>
              {people.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">None recorded yet.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {shown.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        title={item.blurb}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: column.color }}
                          aria-hidden
                        >
                          {initials(item.name)}
                        </span>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {people.length > PREVIEW ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className="mt-3 text-xs font-medium text-slate-600 underline underline-offset-2 hover:no-underline dark:text-slate-300"
                >
                  {expanded.has(key) ? "Show fewer" : `Show all ${people.length}`}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
