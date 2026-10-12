import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatTile } from "@/components/charts/stat-tile";

export interface HeadlineTile {
  label: string;
  value: number | null;
  unit: string;
  period?: string;
  change?: number | null;
  compareLabel?: string;
  spark?: number[];
}

// One topic's headline numbers on the home page, linking through to the
// full section. A topic whose data hasn't loaded is skipped by the caller.
export function TopicHeadlines({
  title,
  href,
  summary,
  tiles,
}: {
  title: string;
  href: string;
  summary: string;
  tiles: HeadlineTile[];
}) {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            <Link href={href} className="hover:underline hover:underline-offset-4">
              {title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{summary}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          Open {title} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>
    </section>
  );
}
