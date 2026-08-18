// Shared between the (client) list view and the (server) detail page — no
// hooks/interactivity, so no "use client" needed; safe to import from
// either side of the boundary.
export function formatBillStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const STATUS_COLOR: Record<string, string> = {
  introduced: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_committee: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  passed_chamber: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  passed_both_chambers: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  enacted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  vetoed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_COLOR[status] ?? STATUS_COLOR.introduced}`}
    >
      {formatBillStatus(status)}
    </span>
  );
}
