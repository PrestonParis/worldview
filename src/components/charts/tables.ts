import { formatValue } from "@/lib/format";
import type { TableView } from "./chart-card";
import type { RankedItem } from "./ranked-bars";
import type { Series } from "./time-series-chart";

// Table views for ChartCard: one row per period (newest first) with a column
// per series, or one row per ranked item.
export function seriesTable(series: Series[], unit: string): TableView {
  const xs = [...new Map(series.flatMap((s) => s.points.map((p) => [p.x, p.label] as const))).entries()].sort((a, b) => b[0] - a[0]);
  const maps = series.map((s) => new Map(s.points.map((p) => [p.x, p.value])));
  return {
    columns: ["Period", ...series.map((s) => s.label)],
    rows: xs.map(([x, label]) => [label, ...maps.map((m) => formatValue(m.get(x), unit))]),
  };
}

export function rankedTable(items: RankedItem[], label: string, unit: string): TableView {
  const notes = items.some((i) => i.note);
  return {
    columns: [label, "Value", ...(notes ? ["Note"] : [])],
    rows: items.map((i) => [i.label, formatValue(i.value, unit), ...(notes ? [i.note ?? ""] : [])]),
  };
}
