"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { VoterRollCallVote } from "@/lib/db/votingRecord";

type Row = VoterRollCallVote & { broke: boolean };

const POSITION_LABEL: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  absent: "Absent",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MemberVotingRecord({
  rows,
  policyAreas,
}: {
  rows: Row[];
  policyAreas: string[];
}) {
  const [policyArea, setPolicyArea] = useState("");
  const [brokeOnly, setBrokeOnly] = useState(false);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (policyArea && r.policyArea !== policyArea) return false;
        if (brokeOnly && !r.broke) return false;
        return true;
      }),
    [rows, policyArea, brokeOnly],
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={policyArea}
          onChange={(e) => setPolicyArea(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">All policy areas</option>
          {policyAreas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={brokeOnly}
            onChange={(e) => setBrokeOnly(e.target.checked)}
          />
          Broke with party only
        </label>
        <span className="text-xs text-slate-400">{visible.length} shown</span>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {visible.map((r) => (
          <li key={r.voteId} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {r.billId ? (
                  <Link
                    href={`/legislation/${r.billId}`}
                    className="underline underline-offset-2"
                  >
                    {r.billNumber ?? "Bill"}
                  </Link>
                ) : (
                  <span>{r.chamber} Roll Call {r.rollNumber}</span>
                )}
                {r.billTitle ? <span className="text-slate-500"> — {r.billTitle}</span> : null}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {r.question || `${r.chamber} Roll Call ${r.rollNumber}`}
                {r.policyArea ? ` · ${r.policyArea}` : ""} · {formatDate(r.date)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              {r.broke ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  broke with party
                </span>
              ) : null}
              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                {POSITION_LABEL[r.position] ?? r.position}
              </span>
            </div>
          </li>
        ))}
        {visible.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No votes match this filter.</p>
        ) : null}
      </ul>
    </div>
  );
}
