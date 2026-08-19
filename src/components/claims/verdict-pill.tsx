// No hooks/interactivity — safe to import from either server or client
// components, same as bill-status.tsx's StatusPill.
export function formatVerdict(verdict: string): string {
  if (!verdict) return "Unverified";
  return verdict.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const VERDICT_COLOR: Record<string, string> = {
  "": "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  true: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  mostly_true: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  mixed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  mostly_false: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  false: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  unsubstantiated: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function VerdictPill({ verdict }: { verdict: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${VERDICT_COLOR[verdict] ?? VERDICT_COLOR[""]}`}
    >
      {formatVerdict(verdict)}
    </span>
  );
}
