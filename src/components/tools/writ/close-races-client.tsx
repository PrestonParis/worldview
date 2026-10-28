"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { ContestDetail } from "@/lib/db/closeRaces";

// Client pieces of the close-races report: the election picker, the
// expandable contest detail (fetched on first open), and the refresh that
// keeps an open election's page current.

/** Re-renders the page from the server every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}

export function ElectionPicker({ current, elections, query }: { current: string; elections: { id: string; label: string }[]; query: string }) {
  const router = useRouter();
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">Election</span>
      <select
        value={current}
        onChange={(event) => router.push(`/writ/close-races/${encodeURIComponent(event.target.value)}${query}`)}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        {elections.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function ContestDetailToggle({ contestId }: { contestId: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ContestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      try {
        const res = await fetch(`/api/writ/close-races/contests/${contestId}`);
        if (!res.ok) throw new Error(String(res.status));
        setDetail(await res.json());
      } catch {
        setError("Couldn't load this contest's detail.");
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
      >
        Detail
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-3 space-y-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {error ? <p>{error}</p> : null}
          {!detail && !error ? <p>Loading…</p> : null}
          {detail ? <DetailBody detail={detail} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailBody({ detail }: { detail: ContestDetail }) {
  const methods = [...new Set(detail.options.flatMap((o) => Object.keys(o.votesByMethod)))];
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left">
          <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
            <tr>
              <th className="py-1 pr-3 font-semibold">Choice</th>
              <th className="py-1 pr-3 text-right font-semibold">Votes</th>
              {methods.map((m) => (
                <th key={m} className="py-1 pr-3 text-right font-semibold">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.options.map((o) => (
              <tr key={o.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-1 pr-3">
                  {o.name}
                  {o.party ? ` (${o.party})` : ""}
                  {o.incumbent ? " · inc." : ""}
                  {o.isApparentWinner ? " · apparent winner" : ""}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{fmt(o.votes)}</td>
                {methods.map((m) => (
                  <td key={m} className="py-1 pr-3 text-right tabular-nums">
                    {o.votesByMethod[m] != null ? fmt(o.votesByMethod[m]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail.areas.length > 1 ? (
        <div className="overflow-x-auto">
          <p className="mb-1 font-semibold text-slate-900 dark:text-white">By county</p>
          <table className="w-full min-w-[28rem] text-left">
            <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
              <tr>
                <th className="py-1 pr-3 font-semibold">County</th>
                {detail.options.slice(0, 4).map((o) => (
                  <th key={o.id} className="py-1 pr-3 text-right font-semibold">
                    {o.name}
                  </th>
                ))}
                <th className="py-1 pr-3 text-right font-semibold">Reporting</th>
              </tr>
            </thead>
            <tbody>
              {detail.areas.map((a) => (
                <tr key={a.countySlug} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1 pr-3">{a.county}</td>
                  {detail.options.slice(0, 4).map((o) => (
                    <td key={o.id} className="py-1 pr-3 text-right tabular-nums">
                      {a.votes[o.id] != null ? fmt(a.votes[o.id]) : "—"}
                    </td>
                  ))}
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {a.reportingUnits}/{a.totalUnits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {detail.history.length > 1 ? (
        <div>
          <p className="mb-1 font-semibold text-slate-900 dark:text-white">Margin over time</p>
          <ul className="space-y-0.5 tabular-nums">
            {detail.history.map((h) => (
              <li key={h.at}>
                {new Date(h.at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET —{" "}
                {h.marginVotes != null ? `${fmt(h.marginVotes)} votes` : "no margin"}
                {h.marginPct != null ? ` (${h.marginPct.toFixed(2)} pts)` : ""}, {h.reportingUnits}/{h.totalUnits} units
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.ruleSource ? <p className="text-slate-500">Decision rule: {detail.ruleSource}</p> : null}
    </>
  );
}
