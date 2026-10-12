import Link from "next/link";
import type { IdeologyBin, PartySplit, RollCallSummary } from "@/lib/legislation/overview";

const BINS = Array.from({ length: 20 }, (_, i) => Math.round((-1 + i * 0.1) * 10) / 10);

// Members of one chamber binned by DW-NOMINATE first dimension, stacked by
// party: the shape of the current Congress, liberal left to conservative
// right. Plain HTML columns; each column's title carries its counts.
export function IdeologyHistogram({ bins }: { bins: IdeologyBin[] }) {
  const byX = new Map(bins.map((b) => [b.x0, b]));
  const filled = BINS.map((x0) => byX.get(x0) ?? { x0, dem: 0, rep: 0, other: 0 });
  const max = Math.max(1, ...filled.map((b) => b.dem + b.rep + b.other));
  if (!bins.length) return <p className="py-10 text-center text-sm text-slate-400">No data loaded yet.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-px border-b border-(--viz-axis)">
        {filled.map((b) => {
          const total = b.dem + b.rep + b.other;
          return (
            <div
              key={b.x0}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${b.x0.toFixed(1)} to ${(b.x0 + 0.1).toFixed(1)}: ${total} members${total ? ` (${b.dem} D, ${b.rep} R${b.other ? `, ${b.other} other` : ""})` : ""}`}
            >
              {total > 0 && (
                <div className="flex flex-col overflow-hidden rounded-t-[2px]" style={{ height: `${(total / max) * 100}%` }}>
                  <div style={{ flexGrow: b.rep, background: "var(--viz-rep)" }} />
                  <div style={{ flexGrow: b.other, background: "var(--viz-muted)" }} />
                  <div style={{ flexGrow: b.dem, background: "var(--viz-dem)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-(--viz-muted) tabular-nums">
        <span>−1.0 · most liberal</span>
        <span>0</span>
        <span>most conservative · +1.0</span>
      </div>
    </div>
  );
}

function SplitBar({ label, split, color }: { label: string; split: PartySplit; color: string }) {
  const total = split.yea + split.nay;
  return (
    <div className="flex items-center gap-2 text-xs" title={`${label}: ${split.yea} yea, ${split.nay} nay`}>
      <span className="w-3 shrink-0 font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-(--viz-empty)">
        {total > 0 && <span style={{ width: `${(split.yea / total) * 100}%`, background: color }} />}
      </span>
      <span className="w-20 shrink-0 text-right text-slate-600 tabular-nums dark:text-slate-300">
        {split.yea}–{split.nay}
      </span>
    </div>
  );
}

// Recent roll calls: question, bill, result, and each party's yea share
// (filled = yea, track = nay).
export function RollCallList({ rollCalls }: { rollCalls: RollCallSummary[] }) {
  if (!rollCalls.length) return <p className="py-10 text-center text-sm text-slate-400">No roll-call votes loaded yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rollCalls.map((rc) => (
        <li key={rc.id} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(rc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {rc.chamber} roll call{" "}
              {rc.rollNumber}
              {rc.partyLine && <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Party line</span>}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
              {rc.question}
              <span className={`ml-2 text-xs font-semibold ${/pass|agreed/i.test(rc.result) ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                {rc.result}
              </span>
            </p>
            {rc.billNumber && rc.billId && (
              <Link href={`/legislation/${rc.billId}`} className="mt-0.5 block truncate text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400">
                {rc.billNumber} · {rc.billTitle}
              </Link>
            )}
          </div>
          <div className="space-y-1 self-center">
            <SplitBar label="D" split={rc.dem} color="var(--viz-dem)" />
            <SplitBar label="R" split={rc.rep} color="var(--viz-rep)" />
          </div>
        </li>
      ))}
    </ul>
  );
}
