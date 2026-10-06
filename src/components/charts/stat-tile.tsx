import { formatSigned, formatValue } from "@/lib/format";

// A headline number: label, value, period, and the change against a named
// comparison period. Change is shown in neutral ink with an arrow — up is
// not inherently good or bad for these measures.
export function StatTile({
  label,
  value,
  unit,
  period,
  change,
  compareLabel,
  spark,
}: {
  label: string;
  value: number | null;
  unit?: string;
  period?: string;
  change?: number | null; // percent
  compareLabel?: string;
  spark?: number[];
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {formatValue(value, unit, { compact: true })}
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
          {period && <p>{period}</p>}
          {change !== null && change !== undefined && Number.isFinite(change) && (
            <p className="mt-0.5">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {change > 0 ? "▲" : change < 0 ? "▼" : ""} {formatSigned(change, "percent")}
              </span>{" "}
              {compareLabel}
            </p>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")} fill="none" stroke="var(--viz-axis)" strokeWidth={1.5} />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--viz-series-1)" />
    </svg>
  );
}
