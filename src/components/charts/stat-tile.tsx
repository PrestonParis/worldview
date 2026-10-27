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
  compact = false,
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
  compact?: boolean;
}) {
  const Frame = href ? "a" : "div";
  return (
    <Frame
      href={href}
      className={`flex min-w-0 flex-col border border-slate-200 dark:border-slate-800 ${compact ? "rounded-xl p-3" : "rounded-2xl p-4"} ${
        href ? "transition hover:border-slate-400 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-900" : ""
      }`}
    >
      <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500 dark:text-slate-400`}>{label}</p>
      <p className={`${compact ? "mt-1 text-2xl" : "mt-2 text-3xl"} font-semibold tracking-tight text-slate-950 dark:text-white`}>
        {formatValue(value, unit, { compact: true })}
        {extra && <span className="ml-2 text-lg font-medium text-slate-500 dark:text-slate-400">{extra}</span>}
      </p>
      {tag && <PeriodTag {...tag} className="mt-2" />}
      {note && <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{note}</p>}
      <div className={`mt-auto flex items-end justify-between gap-3 ${compact ? "pt-1" : "pt-2"}`}>
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
        {spark && spark.length > 1 && <Sparkline values={spark} unit={unit} />}
      </div>
    </Frame>
  );
}

export function Sparkline({ values, unit }: { values: number[]; unit?: string }) {
  const w = 96;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const [fx, fy] = pts[0];
  const [lx, ly] = pts.at(-1)!;
  const description = `Trend across ${values.length} observations: first ${formatValue(values[0], unit, { compact: true })}, low ${formatValue(min, unit, { compact: true })}, high ${formatValue(max, unit, { compact: true })}, latest ${formatValue(values.at(-1), unit, { compact: true })}`;
  return (
    <svg width={w} height={h} className="shrink-0" role="img" aria-label={description}>
      <title>{description}</title>
      <line x1="2" x2={w - 2} y1={h / 2} y2={h / 2} stroke="var(--viz-grid)" />
      <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")} fill="none" stroke="var(--viz-axis)" strokeWidth={1.5} />
      <circle cx={fx} cy={fy} r={2} fill="var(--viz-muted)" />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--viz-series-1)" />
    </svg>
  );
}
