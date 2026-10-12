// Display formatting shared by the demographics explorer.

export function formatShare(value: number): string {
  return `${value.toFixed(1)}%`;
}

// A projected low–high range; a single value when both ends round alike.
export function formatRange(low: number, high: number): string {
  const lo = low.toFixed(1);
  const hi = high.toFixed(1);
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}

// Percentage-point change, signed with an arrow: "↑ 7.9 pp".
export function formatPoints(change: number): string {
  if (Math.abs(change) < 0.05) return "no change";
  return `${change > 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)} pp`;
}

export function formatPeople(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e7) return `${Math.round(value / 1e6)}M`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e4) return `${Math.round(value / 1e3)}K`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

export function changeTone(change: number): string {
  if (change > 0.05) return "text-emerald-600 dark:text-emerald-400";
  if (change < -0.05) return "text-rose-600 dark:text-rose-400";
  return "text-slate-400";
}
