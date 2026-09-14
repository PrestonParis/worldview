// Shared between the (client) list view and the (server) detail page — no
// hooks, so no "use client" needed (mirrors legislation/bill-status.tsx).
export function formatElectionStatus(status: string): string {
  return status.replace(/^./, (c) => c.toUpperCase());
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  provisional: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  certified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function ElectionStatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_COLOR[status] ?? STATUS_COLOR.scheduled}`}
    >
      {formatElectionStatus(status)}
    </span>
  );
}
