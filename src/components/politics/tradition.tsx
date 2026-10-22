// Traditions as the same small building blocks on every page: the family
// chip, a summary line, and ranked similarity bars.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import type { IdeologyFamily } from "@/lib/quiz/types";
import { chartLabel, focusRing, metaText } from "./type";

export function FamilyDot({ family, className = "size-2.5" }: { family: IdeologyFamily; className?: string }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: familyColor(family) }}
    />
  );
}

export function FamilyBadge({ family, href }: { family: IdeologyFamily; href?: string }) {
  const color = familyColor(family);
  const cls = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-slate-800 dark:text-slate-100 ${focusRing}`;
  const inner = (
    <>
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {FAMILIES[family].label} family
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} hover:brightness-95`} style={{ backgroundColor: `${color}24` }}>
      {inner}
    </Link>
  ) : (
    <span className={cls} style={{ backgroundColor: `${color}24` }}>
      {inner}
    </span>
  );
}

export interface SimilarityItem {
  id: string;
  name: string;
  family: IdeologyFamily;
  value: number; // 0–100
  href?: string;
}

// Ranked similarity bars. The leader is emphasised and its lead over the
// runner-up annotated; widths grow in turn when `animate` is set.
export function SimilarityBars({
  items,
  startRank = 1,
  animate = false,
  delay = 0,
  unit = "%",
  highlightFirst = true,
}: {
  items: SimilarityItem[];
  startRank?: number;
  animate?: boolean;
  delay?: number;
  unit?: string;
  highlightFirst?: boolean;
}) {
  return (
    <ol className="space-y-2.5">
      {items.map((m, i) => {
        const color = familyColor(m.family);
        const lead = i === 0 && items[1] ? m.value - items[1].value : null;
        const first = i === 0 && highlightFirst;
        const content = (
          <>
            <span className="flex items-baseline gap-2.5">
              <span
                className={`w-5 shrink-0 text-right text-sm tabular-nums ${first ? "font-bold text-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}
              >
                {startRank + i}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${first ? "font-semibold text-slate-950 dark:text-white" : "font-medium text-slate-800 dark:text-slate-200"}`}
              >
                {m.name}
              </span>
              {lead !== null && lead > 0 && highlightFirst && (
                <span className={`${chartLabel} hidden sm:inline`}>+{lead} ahead</span>
              )}
              <span
                className={`w-12 text-right tabular-nums ${first ? "text-lg font-bold text-slate-950 dark:text-white" : "text-sm font-semibold text-slate-800 dark:text-slate-200"}`}
              >
                {m.value}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{unit}</span>
              </span>
            </span>
            <span
              className={`mt-1 ml-7.5 block overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${first ? "h-2" : "h-1.5"}`}
            >
              <span
                className={`block h-full rounded-full ${animate ? "wv-grow" : ""}`}
                style={{
                  width: `${Math.max(2, m.value)}%`,
                  backgroundColor: color,
                  ["--i" as string]: i,
                  ["--d" as string]: `${delay}ms`,
                }}
              />
            </span>
          </>
        );
        return (
          <li key={m.id}>
            {m.href ? (
              <Link
                href={m.href}
                className={`group block rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-slate-950/[0.03] dark:hover:bg-white/5 ${focusRing}`}
              >
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

// One tradition as a link row: family dot, name, a meta line, arrow.
export function TraditionRow({
  href,
  name,
  family,
  meta,
  value,
}: {
  href: string;
  name: string;
  family: IdeologyFamily;
  meta?: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 transition-colors hover:border-slate-400 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900/40 ${focusRing}`}
    >
      <FamilyDot family={family} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-950 dark:text-white">{name}</span>
        {meta && <span className={`block truncate ${metaText}`}>{meta}</span>}
      </span>
      {value && <span className="text-sm font-semibold text-slate-700 tabular-nums dark:text-slate-300">{value}</span>}
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
