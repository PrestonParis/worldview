"use client";

import type { MatrixCell } from "./compare-stats";

// Blue for positive r, orange for negative, deeper with |r|. Neither color
// means better or worse.
function tint(r: number | null) {
  if (r === null) return undefined;
  const pct = Math.round(Math.abs(r) * 85);
  return `color-mix(in srgb, var(${r >= 0 ? "--viz-series-1" : "--viz-series-2"}) ${pct}%, transparent)`;
}

const signed = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`;

export function CorrelationMatrix({
  labels,
  matrix,
  xi,
  yi,
  onSelect,
}: {
  labels: string[];
  matrix: MatrixCell[][];
  xi: number;
  yi: number;
  onSelect: (x: number, y: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {labels.map((label, j) => (
              <th key={j} className="w-24 max-w-24 px-1 pb-1 align-bottom font-medium text-slate-500" title={label}>
                <span className="line-clamp-3 text-left">{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i}>
              <th scope="row" className="max-w-44 pr-2 text-right font-medium text-slate-500" title={label}>
                <span className="line-clamp-2">{label}</span>
              </th>
              {labels.map((_, j) => {
                const cell = matrix[i][j];
                if (i === j) return <td key={j} className="h-12 w-24 rounded-lg bg-slate-50 dark:bg-slate-900/60" />;
                const selected = (xi === j && yi === i) || (xi === i && yi === j);
                const strong = cell.r !== null && Math.abs(cell.r) >= 0.55;
                return (
                  <td key={j} className="h-12 w-24 p-0">
                    <button
                      type="button"
                      onClick={() => onSelect(j, i)}
                      title={`${labels[j]} (X) vs. ${label} (Y): r = ${cell.r === null ? "n/a" : signed(cell.r)}, ${cell.n} places`}
                      className={`flex h-full w-full flex-col items-center justify-center rounded-lg border transition hover:ring-2 hover:ring-slate-400 ${
                        selected ? "border-slate-900 ring-2 ring-slate-900 dark:border-white dark:ring-white" : "border-slate-200 dark:border-slate-800"
                      }`}
                      style={{ background: tint(cell.r) }}
                    >
                      <span
                        className={`font-mono text-sm font-semibold tabular-nums ${strong ? "text-white" : "text-slate-900 dark:text-slate-100"}`}
                      >
                        {cell.r === null ? "—" : signed(cell.r)}
                      </span>
                      <span className={`text-[10px] ${strong ? "text-white/80" : "text-slate-500"}`}>n={cell.n}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
