"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Maximize2, X } from "lucide-react";
import { ideologies } from "@/lib/quiz/ideologies";
import { ideologyMap, type MapPoint } from "@/lib/quiz/map";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import type { IdeologyFamily } from "@/lib/quiz/types";
import { FamilyChip, SectionHeader, small } from "./results-ui";

const byId = new Map(ideologies.map((i) => [i.id, i]));
const FAMILY_IDS = Object.keys(FAMILIES) as IdeologyFamily[];
const familyCount = Object.fromEntries(FAMILY_IDS.map((f) => [f, ideologies.filter((i) => i.family === f).length])) as Record<IdeologyFamily, number>;

// Plot inset, as a share of each side, so edge dots aren't clipped.
const INSET = 5;
const r2 = (v: number) => Number(v.toFixed(2));
const left = (x: number) => r2(INSET + ((x + 1) / 2) * (100 - 2 * INSET));
const top = (y: number) => r2(INSET + ((1 - y) / 2) * (100 - 2 * INSET));
// Tooltip anchoring near the plot edges, so it stays inside.
const anchorX = (l: number) => (l < 18 ? "translate-x-0" : l > 82 ? "-translate-x-full" : "-translate-x-1/2");

const HIGHLIGHTS = [0, 5, 10] as const;
const dirLabel = "text-xs font-medium text-slate-700 dark:text-slate-300";

// Every tradition on the map's two principal directions, with you placed
// among them. Hover or tap a dot to inspect it; filter by family; number
// your closest matches. Expands to a focused full-screen view.
export function ResultsMap({
  ranked,
  you,
  youLabel,
  accent,
  kicker,
  title,
  description,
  matchBase,
}: {
  ranked: { id: string; match: number }[]; // every tradition, best match first
  you: MapPoint;
  youLabel: string;
  accent: string;
  kicker: string;
  title: string;
  description: string;
  matchBase: string; // a tradition's row in the ranking is `${matchBase}${id}`
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState(ranked[0].id);
  const [families, setFamilies] = useState<Set<IdeologyFamily>>(new Set());
  const [highlight, setHighlight] = useState<(typeof HIGHLIGHTS)[number]>(5);
  const [focused, setFocused] = useState(false);

  const rankOf = useMemo(() => new Map(ranked.map((m, i) => [m.id, i + 1])), [ranked]);
  const matchOf = useMemo(() => new Map(ranked.map((m) => [m.id, m.match])), [ranked]);
  const closest = ranked.slice(0, Math.max(highlight, 5));
  const numbered = new Set(ranked.slice(0, highlight).map((m) => m.id));
  const visible = (f: IdeologyFamily) => families.size === 0 || families.has(f);

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocused(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  const toggleFamily = (f: IdeologyFamily) =>
    setFamilies((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const inspected = byId.get(hovered ?? selected)!;
  const tip = hovered ? byId.get(hovered) : undefined;
  const youAt = { l: left(you.x), t: top(you.y) };

  const plot = (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-950/5 dark:bg-slate-900/60 dark:ring-white/5 ${
        focused ? "h-[min(72dvh,56rem)] min-h-80" : "aspect-square sm:aspect-[16/11]"
      }`}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Quadrant lines; the four directions are labelled outside the plot so dots never cover them. */}
      <div aria-hidden className="absolute inset-y-3 left-1/2 w-px bg-slate-200 dark:bg-slate-800" />
      <div aria-hidden className="absolute inset-x-3 top-1/2 h-px bg-slate-200 dark:bg-slate-800" />

      {/* Threads from you to each numbered match. */}
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
        {[...numbered].map((id) => {
          const p = ideologyMap[id];
          return (
            <line
              key={id}
              x1={youAt.l}
              y1={youAt.t}
              x2={left(p.x)}
              y2={top(p.y)}
              stroke={accent}
              strokeOpacity={hovered === id || selected === id ? 0.9 : 0.35}
              strokeWidth={1.25}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {ideologies.map((i) => {
        const p = ideologyMap[i.id];
        const rank = rankOf.get(i.id)!;
        const isNumbered = numbered.has(i.id);
        const on = visible(i.family);
        const active = hovered === i.id || selected === i.id;
        return (
          <button
            key={i.id}
            type="button"
            tabIndex={isNumbered ? 0 : -1}
            // The unnumbered dots are pointer-only; the closest list carries the ranking.
            aria-hidden={isNumbered ? undefined : true}
            aria-label={`${rank}. ${i.name}, ${matchOf.get(i.id)}% match`}
            aria-pressed={selected === i.id}
            onClick={() => setSelected(i.id)}
            onMouseEnter={() => setHovered(i.id)}
            onFocus={() => setHovered(i.id)}
            onBlur={() => setHovered(null)}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold text-white ring-2 transition-[opacity,transform] duration-200 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-white ${
              isNumbered ? "z-20 size-6 text-[11px]" : "z-10 size-3"
            } ${active ? "scale-125 ring-slate-950 dark:ring-white" : "ring-white dark:ring-slate-950"}`}
            style={{
              left: `${left(p.x)}%`,
              top: `${top(p.y)}%`,
              backgroundColor: familyColor(i.family),
              opacity: on || isNumbered ? 1 : 0.14,
            }}
          >
            {isNumbered ? rank : null}
          </button>
        );
      })}

      {/* You: a pulsing ring with a label pill above, never covering a dot's centre. */}
      <div aria-hidden className="pointer-events-none absolute z-30" style={{ left: `${youAt.l}%`, top: `${youAt.t}%` }}>
        <span className="quiz-map-you absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: accent }} />
        <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white/70 dark:bg-slate-950/70" style={{ borderColor: accent }} />
        <span className="absolute -translate-x-1/2 -translate-y-[calc(100%+1.25rem)] rounded-full bg-slate-950 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow dark:bg-white dark:text-slate-950">
          {youLabel}
        </span>
      </div>

      {tip && (
        <div
          className={`pointer-events-none absolute z-40 -translate-y-[calc(100%+1rem)] rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-950/10 dark:bg-slate-900 dark:ring-white/10 ${anchorX(left(ideologyMap[tip.id].x))}`}
          style={{ left: `${left(ideologyMap[tip.id].x)}%`, top: `${top(ideologyMap[tip.id].y)}%` }}
        >
          <p className="font-semibold whitespace-nowrap text-slate-950 dark:text-white">{tip.name}</p>
          <p className="text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
            #{rankOf.get(tip.id)} · {matchOf.get(tip.id)}% match · {FAMILIES[tip.family].label}
          </p>
        </div>
      )}
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by family">
        {FAMILY_IDS.map((f) => {
          const on = families.has(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => toggleFamily(f)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : families.size > 0
                    ? "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-800 dark:text-slate-400"
                    : "border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:text-slate-200"
              }`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: familyColor(f) }} />
              {FAMILIES[f].label}
              <span className="tabular-nums opacity-70">{familyCount[f]}</span>
            </button>
          );
        })}
        {families.size > 0 && (
          <button type="button" onClick={() => setFamilies(new Set())} className="min-h-8 px-2 text-xs font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
            Show all
          </button>
        )}
      </div>
      <div className="inline-flex items-center gap-2">
        <span className={small}>Number</span>
        <div className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
          {HIGHLIGHTS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={highlight === n}
              onClick={() => setHighlight(n)}
              className={`min-h-7 rounded-md px-2.5 text-xs font-medium ${
                highlight === n ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {n === 0 ? "None" : `Top ${n}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const side = (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <FamilyChip family={inspected.family} />
          <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">#{rankOf.get(inspected.id)} of {ranked.length}</span>
        </div>
        <p className="mt-2 text-lg leading-snug font-semibold text-slate-950 dark:text-white">{inspected.name}</p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <span className="block h-full rounded-full" style={{ width: `${matchOf.get(inspected.id)}%`, backgroundColor: familyColor(inspected.family) }} />
          </span>
          <span className="text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">{matchOf.get(inspected.id)}%</span>
        </div>
        <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{inspected.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href={`${matchBase}${inspected.id}`} onClick={() => setFocused(false)} className="font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 dark:text-white dark:decoration-slate-600">
            Axis by axis
          </a>
          <Link href={`/atlas/philosophies/${inspected.id}`} className="font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 dark:text-white dark:decoration-slate-600">
            Read more
          </Link>
        </div>
      </div>
      <div>
        <p className={small}>Closest to {youLabel === "You" ? "you" : "this profile"}</p>
        <ol className="mt-1.5 space-y-px">
          {closest.map((m, i) => {
            const t = byId.get(m.id)!;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m.id)}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    selected === m.id ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: familyColor(t.family) }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{t.name}</span>
                  <span className="text-slate-600 tabular-nums dark:text-slate-400">{m.match}%</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );

  const content = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-3">
        <div>
          <p aria-hidden className={`pb-1 text-center ${dirLabel}`}>↑ Free market</p>
          {plot}
          <p aria-hidden className={`grid grid-cols-3 pt-1 ${dirLabel}`}>
            <span>← Progressive</span>
            <span className="text-center">↓ State-directed</span>
            <span className="text-right">Traditional →</span>
          </p>
        </div>
        {controls}
      </div>
      {side}
    </div>
  );

  return (
    <>
      <SectionHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => setFocused(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-500 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white"
          >
            <Maximize2 size={14} aria-hidden />
            Focus view
          </button>
        }
      />
      <div className="mt-5">{!focused && content}</div>
      {focused && (
        <div role="dialog" aria-modal="true" aria-label="Ideology map" className="fixed inset-0 z-50 overflow-y-auto bg-white p-4 sm:p-6 dark:bg-slate-950">
          <div className="mx-auto max-w-[110rem]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{title}</p>
              <button
                type="button"
                autoFocus
                onClick={() => setFocused(false)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200"
              >
                <X size={15} aria-hidden />
                Close
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
