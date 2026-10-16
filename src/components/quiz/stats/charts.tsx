// Small charts for /quiz/stats. Plain HTML/SVG with no client state; every
// mark carries a title for hover, and ChartCard supplies the table view.

import type { AxisId } from "@/lib/quiz/types";
import type { Correlation, DailyRow } from "@/lib/quiz/analytics";

const SERIES = [
  { key: "visits", label: "Landing visits", color: "var(--viz-series-3)" },
  { key: "started", label: "Quizzes started", color: "var(--viz-series-1)" },
  { key: "reached", label: "Reached a checkpoint", color: "var(--viz-series-2)" },
] as const;

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// Grouped columns per day: visits, starts, and starts that reached a checkpoint.
export function DailyColumns({ rows }: { rows: DailyRow[] }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-400">No activity yet.</p>;
  const values = rows.map((r) => ({ date: r.date, visits: r.visits, started: r.started, reached: r.quick }));
  const max = Math.max(1, ...values.flatMap((v) => [v.visits, v.started, v.reached]));
  const every = Math.ceil(rows.length / 8);
  return (
    <div>
      <Legend items={SERIES.map((s) => ({ label: s.label, color: s.color }))} />
      <div className="flex h-44 items-end gap-1 border-b border-[var(--viz-axis)]">
        {values.map((v) => (
          <div
            key={v.date}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-px rounded-sm hover:bg-slate-100 dark:hover:bg-slate-900"
            title={`${shortDate(v.date)}: ${v.visits} visits · ${v.started} started · ${v.reached} reached a checkpoint`}
          >
            {SERIES.map((s) => (
              <span
                key={s.key}
                className="w-full max-w-3 rounded-t-[3px]"
                style={{ height: `${(v[s.key] / max) * 100}%`, minHeight: v[s.key] ? 2 : 0, background: s.color }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] text-[var(--viz-muted)] tabular-nums">
        {values.map((v, i) => (
          <span key={v.date} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % every === 0 ? shortDate(v.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// Counts per bin as compact columns, e.g. a statement's −3…+3 responses.
export function MiniHistogram({ counts, labels, width = 84, height = 24 }: { counts: number[]; labels: string[]; width?: number; height?: number }) {
  const max = Math.max(1, ...counts);
  const w = width / counts.length;
  return (
    <svg width={width} height={height} role="img" aria-label={counts.map((c, i) => `${labels[i]}: ${c}`).join(", ")}>
      {counts.map((c, i) => (
        <rect
          key={i}
          x={i * w + 1}
          y={height - (c / max) * height}
          width={w - 2}
          height={Math.max(c ? 1.5 : 0, (c / max) * height)}
          rx={1.5}
          fill="var(--viz-series-1)"
        >
          <title>{`${labels[i]}: ${c}`}</title>
        </rect>
      ))}
      <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--viz-axis)" />
    </svg>
  );
}

export const RESPONSE_LABELS = ["Strongly disagree", "Disagree", "Somewhat disagree", "Neutral", "Somewhat agree", "Agree", "Strongly agree"];

// Labelled columns for a distribution, e.g. respondents' top match %.
export function Histogram({ counts, labels }: { counts: number[]; labels: string[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div className="flex h-32 items-end gap-1 border-b border-[var(--viz-axis)]">
        {counts.map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end" title={`${labels[i]}: ${c}`}>
            <span className="text-[11px] text-slate-600 tabular-nums dark:text-slate-300">{c || ""}</span>
            <span className="w-full rounded-t-[4px]" style={{ height: `${(c / max) * 85}%`, minHeight: c ? 2 : 0, background: "var(--viz-series-1)" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] text-[var(--viz-muted)]">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 2 === 0 ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// Axis × axis correlation of respondents' positions. Diverging: blue for
// positive, orange for negative, fading to the surface at zero.
export function CorrelationMatrix({ axes, correlations }: { axes: { axis: AxisId; name: string }[]; correlations: Correlation[] }) {
  const lookup = new Map(correlations.flatMap((c) => [[`${c.a}|${c.b}`, c], [`${c.b}|${c.a}`, c]] as const));
  return (
    <div className="overflow-x-auto">
      <Legend
        items={[
          { label: "Move together (r > 0)", color: "var(--viz-series-1)" },
          { label: "Move opposite (r < 0)", color: "var(--viz-series-2)" },
        ]}
      />
      <table className="border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr>
            <th />
            {axes.map((a) => (
              <th key={a.axis} className="h-24 w-6 align-bottom font-normal text-[var(--viz-muted)]">
                <span className="inline-block origin-bottom-left translate-x-3 -rotate-60 whitespace-nowrap">{a.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((row) => (
            <tr key={row.axis}>
              <th className="pr-2 text-right font-normal whitespace-nowrap text-slate-600 dark:text-slate-300">{row.name}</th>
              {axes.map((col) => {
                if (row.axis === col.axis) return <td key={col.axis} className="size-6 rounded-sm bg-[var(--viz-empty)]" />;
                const c = lookup.get(`${row.axis}|${col.axis}`);
                return (
                  <td
                    key={col.axis}
                    className="size-6 rounded-sm"
                    style={c ? { background: c.r >= 0 ? "var(--viz-series-1)" : "var(--viz-series-2)", opacity: 0.12 + 0.88 * Math.abs(c.r) } : undefined}
                    title={c ? `${row.name} × ${col.name}: r = ${c.r} (n ${c.n})` : `${row.name} × ${col.name}: not enough overlap`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
