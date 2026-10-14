import Link from "next/link";
import { US_STATE_GRID } from "@/lib/money/us-states";
import { stateSlug } from "@/lib/states/slug";

// Every state as a same-size tile in its rough geographic position, each
// linking to its profile. `current` highlights one state.
export function StateTileNav({ current }: { current?: string }) {
  const rows = Math.max(...US_STATE_GRID.map((c) => c.row)) + 1;
  const cols = Math.max(...US_STATE_GRID.map((c) => c.col)) + 1;
  return (
    <nav aria-label="States" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {US_STATE_GRID.map((c) => {
        const on = c.abbr === current;
        return (
          <Link
            key={c.abbr}
            href={`/states/${stateSlug(c.name)}`}
            title={c.name}
            aria-current={on ? "page" : undefined}
            style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
            className={`flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold transition-colors sm:text-xs ${
              on
                ? "bg-blue-700 text-white dark:bg-blue-500"
                : "bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white dark:hover:text-slate-950"
            }`}
          >
            {c.abbr}
          </Link>
        );
      })}
    </nav>
  );
}
