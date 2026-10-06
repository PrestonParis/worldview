import { formatValue } from "@/lib/format";

export interface RankedItem {
  label: string;
  value: number;
  note?: string;
}

// Horizontal bars, largest first, value at the bar tip. Plain HTML so labels
// wrap naturally at any width; each row is its own hover/focus target via
// its title.
export function RankedBars({
  items,
  unit,
  slot = 1,
  limit = 10,
}: {
  items: RankedItem[];
  unit?: string;
  slot?: 1 | 2 | 3;
  limit?: number;
}) {
  const shown = items.slice(0, limit);
  if (!shown.length) return <p className="py-10 text-center text-sm text-slate-400">No data loaded yet.</p>;
  const max = Math.max(...shown.map((i) => i.value));
  return (
    <ol className="space-y-2">
      {shown.map((item) => (
        <li
          key={item.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]"
          title={`${item.label}: ${formatValue(item.value, unit)}${item.note ? ` (${item.note})` : ""}`}
        >
          <span className="truncate text-slate-600 dark:text-slate-300">{item.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-3.5 shrink-0 rounded-r"
              style={{ width: `calc(${Math.max(0.5, (item.value / max) * 100)}% - 4.5rem)`, minWidth: 2, background: `var(--viz-series-${slot})` }}
            />
            <span className="shrink-0 text-xs font-medium text-slate-900 tabular-nums dark:text-white">
              {formatValue(item.value, unit, { compact: true })}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
