import type { ReactNode } from "react";
import { formatSigned, formatValue } from "@/lib/format";
import { PeriodTag, type PeriodTagProps } from "./period-tag";

// A headline number: label, value, period, and the change against a named
// comparison period. Change is shown in neutral ink with an arrow — up is
// not inherently good or bad for these measures. `tag` replaces the period
// line with a period chip (see PeriodTag); `note` says what is being
// counted ("Monthly events, not unique people"). `href` makes the whole
// tile a link to the section that explains it.
export function StatTile({
  label,
  value,
  unit,
  period,
  tag,
  note,
  extra,
  change,
  compareLabel,
  spark,
  href,
}: {
  label: ReactNode;
  value: number | null;
  unit?: string;
  period?: string;
  tag?: PeriodTagProps;
  note?: ReactNode;
  extra?: ReactNode; // shown after the value, e.g. "· 14.8%"
  change?: number | null; // percent
  compareLabel?: string;
  spark?: number[];
  href?: string;
}) {
  const Frame = href ? "a" : "div";
  return (
    <Frame
      href={href}
      className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800 ${
        href ? "transition hover:border-slate-400 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-900" : ""
      }`}
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {formatValue(value, unit, { compact: true })}
        {extra && <span className="ml-2 text-lg font-medium text-slate-500 dark:text-slate-400">{extra}</span>}
      </p>
      {tag && <PeriodTag {...tag} className="mt-2" />}
      {note && <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{note}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
          {period && !tag && <p>{period}</p>}
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
    </Frame>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
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
