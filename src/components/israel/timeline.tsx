"use client";

import { useState } from "react";
import type { TimelineEvent } from "@/lib/israel/records";
import { Segmented } from "./segmented";

const LANES = ["all", "Financial", "Military", "Political", "Diplomatic"] as const;
const date = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [lane, setLane] = useState<(typeof LANES)[number]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const shown = events.filter((e) => lane === "all" || e.lane === lane);
  return (
    <div>
      <Segmented label="Lane" value={lane} onChange={setLane} options={LANES.map((l) => [l, l === "all" ? "All" : l] as const)} />
      <ol className="mt-5 space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
        {shown.map((e) => {
          const key = e.date + e.title;
          const expanded = open === key;
          return (
            <li key={key} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-white bg-slate-400 dark:border-slate-950" />
              <button type="button" onClick={() => setOpen(expanded ? null : key)} aria-expanded={expanded} className="w-full text-left">
                <p className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {date(e.date)} · {e.lane}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-white">
                  {e.title} <span aria-hidden className="text-sm font-normal text-slate-400">{expanded ? "−" : "+"}</span>
                </h3>
                {!expanded && <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{e.changed}</p>}
              </button>
              {expanded && (
                <>
                  <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {(
                      [
                        ["What happened", e.happened],
                        ["What the U.S. did", e.us],
                        ["What Israel did", e.israel],
                        ["What changed", e.changed],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{k}</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <a href={e.source.url} className="mt-1.5 inline-block text-xs text-slate-500 underline underline-offset-2 dark:text-slate-400">
                    {e.source.label}
                  </a>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
