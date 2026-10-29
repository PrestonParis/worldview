"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatValue } from "@/lib/format";
import type { MemberVotes as Member } from "@/lib/israel/data";
import type { KeyVote } from "@/lib/israel/records";
import { Segmented } from "./segmented";

const POSITION: Record<string, { label: string; cls: string }> = {
  yea: { label: "Yes", cls: "bg-slate-900 text-white dark:bg-white dark:text-slate-900" },
  nay: { label: "No", cls: "border border-slate-400 text-slate-700 dark:text-slate-200" },
  present: { label: "Present", cls: "text-slate-500" },
  absent: { label: "Didn't vote", cls: "text-slate-400" },
};
const PARTY_DOT: Record<string, string> = { D: "var(--viz-dem)", R: "var(--viz-rep)" };

// Every member who cast one of the key votes: how they voted on each, and
// what the tracked pro-Israel groups gave or spent for or against them.
export function MemberVotes({ members, votes }: { members: Member[]; votes: KeyVote[] }) {
  const [q, setQ] = useState("");
  const [chamber, setChamber] = useState<"Senate" | "House">("Senate");
  const [selected, setSelected] = useState<string | null>(null);
  const cols = votes.filter((v) => v.chamber === chamber);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members
      .filter((m) => cols.some((v) => m.votes[v.id]) && (!needle || m.name.toLowerCase().includes(needle)))
      .slice(0, needle ? 60 : 200);
  }, [members, cols, q]);
  const pick = members.find((m) => m.id === selected) ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">How each member voted</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick a member to see every key vote and the pro-Israel PAC money around them.</p>
        </div>
        <Segmented
          label="Chamber"
          value={chamber}
          onChange={(c) => {
            setChamber(c);
            setSelected(null);
          }}
          options={[
            ["Senate", "Senate"],
            ["House", "House"],
          ]}
        />
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name"
        className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        aria-label="Search members"
      />
      <div className="mt-3 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <ul className="max-h-96 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelected(m.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${m.id === selected ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
              >
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: PARTY_DOT[m.party] ?? "var(--viz-muted)" }} />
                <span className="truncate text-slate-800 dark:text-slate-100">{m.name}</span>
                <span className="ml-auto text-xs text-slate-400">{m.party}</span>
              </button>
            </li>
          ))}
          {!list.length && <li className="px-3 py-2 text-sm text-slate-500">No member matches.</li>}
        </ul>
        {pick ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">
                {pick.name} <span className="text-sm font-normal text-slate-500">({pick.party})</span>
              </p>
              <Link href={pick.href} className="text-sm font-medium underline underline-offset-2">
                Open dossier →
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {[
                ["From pro-Israel PACs", pick.received],
                ["Outside spending for", pick.supportedBy],
                ["Outside spending against", pick.opposedBy],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">{v ? formatValue(v as number, "usd", { compact: true }) : "—"}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {cols.map((v) => {
                const p = POSITION[pick.votes[v.id] ?? ""];
                return (
                  <li key={v.id} className="flex items-start gap-3 py-2">
                    <span className={`mt-0.5 w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium ${p?.cls ?? "text-slate-400"}`}>{p?.label ?? "Not serving"}</span>
                    <span className="min-w-0">
                      <a href={v.url} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                        {v.measure}
                      </a>{" "}
                      <span className="text-slate-500 dark:text-slate-400">· {v.date}</span>
                      <span className="block text-slate-600 dark:text-slate-300">Yes would: {v.yesMeans.charAt(0).toLowerCase() + v.yesMeans.slice(1)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">PAC money covers the 2022–2026 FEC cycles loaded in Worldview.</p>
          </div>
        ) : (
          <p className="self-center text-sm text-slate-500 dark:text-slate-400">Select a member from the list.</p>
        )}
      </div>
    </div>
  );
}
