"use client";

import { useState } from "react";
import type { UnVote } from "@/lib/israel/data";
import { Segmented } from "./segmented";

const VOTE: Record<string, string> = { "1": "Yes", "-1": "No", "0": "Abstain" };
const label = (v: number | null) => (v === null ? "—" : VOTE[String(v)]);

// Recorded UN votes, newest first, with the U.S. and Israeli votes side by side.
export function UnVotes({ votes }: { votes: UnVote[] }) {
  const [body, setBody] = useState<"all" | "General Assembly" | "Security Council">("all");
  const [filter, setFilter] = useState<"all" | "with" | "apart">("all");
  const [all, setAll] = useState(false);
  const matching = votes
    .filter((v) => body === "all" || v.body === body)
    .filter((v) => filter === "all" || (filter === "with" ? v.us === v.israel : v.us !== v.israel))
    .slice(0, 60);
  const shown = all ? matching : matching.slice(0, 10);

  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">UN voting explorer</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recorded votes on Israel, the Palestinians and the region, newest first.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Body"
            value={body}
            onChange={setBody}
            options={[
              ["all", "Both"],
              ["General Assembly", "General Assembly"],
              ["Security Council", "Security Council"],
            ]}
          />
          <Segmented
            label="Alignment"
            value={filter}
            onChange={setFilter}
            options={[
              ["all", "All"],
              ["with", "U.S. = Israel"],
              ["apart", "U.S. ≠ Israel"],
            ]}
          />
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Resolution</th>
              <th className="py-2 pr-3 font-medium">U.S.</th>
              <th className="py-2 pr-3 font-medium">Israel</th>
              <th className="py-2 pr-3 text-right font-medium">Yes–No–Abst.</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.symbol} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">{v.date}</td>
                <td className="py-2 pr-3">
                  <a href={`https://undocs.org/${v.symbol}`} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                    {v.symbol}
                  </a>
                  <span className="block text-slate-600 dark:text-slate-300">{v.title.replace(/^.*?\[(.*)\]\s*$/, "$1")}</span>
                </td>
                <td className="py-2 pr-3 font-medium">{label(v.us)}</td>
                <td className="py-2 pr-3 font-medium">{label(v.israel)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {v.yes}–{v.no}–{v.abstain}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="py-4 text-sm text-slate-500">No votes match.</p>}
      </div>
      {matching.length > 10 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
          {all ? "Show 10" : `Show ${matching.length} most recent`}
        </button>
      )}
    </div>
  );
}
