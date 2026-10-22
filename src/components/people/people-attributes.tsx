"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { PositionFacets, TraitFacets, type SetFilter } from "@/components/people/attribute-facets";
import { PortraitImage } from "@/components/people/portrait-image";
import type { AttributeMatch, AttributeResult } from "@/lib/db/attributes";
import { sideLabels, type GraphSide } from "@/lib/graph/lean";
import { usStateName } from "@/lib/money/us-states";
import { ATTRIBUTE_KEYS, attributeQuery, isFiltered, parseAttributeParams, type AttributeParams } from "@/lib/people/attributes";
import { FAMILY_FILL } from "@/lib/people/family-colors";
import { roleGroups } from "@/lib/people/public";
import { SPECTRUM_ROWS } from "@/lib/people/spectrum";
import { NOT_RECORDED, bornLabels, generations, raceLabels, religionLabels, sexLabels } from "@/lib/people/traits";

// The People page's attribute explorer. Filters live in the query string
// (written with replaceState, so the cached page never re-renders per
// combination) and each change asks /api/people/attributes for fresh facet
// counts and the best-connected matches.

const TRAIT_NOTE =
  "Traits come from Wikidata statements, Wikipedia's categories and Open States; people with no such record count as not recorded.";

const fmt = (n: number) => n.toLocaleString("en-US");

export function useAttributes(initial: AttributeResult) {
  const [params, setParamsState] = useState<AttributeParams>({});
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false);
  const pending = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const current = useRef<AttributeParams>({});

  const setParams = useCallback((next: AttributeParams, { typing = false } = {}) => {
    current.current = next;
    setParamsState(next);
    const query = attributeQuery(next);

    const url = new URL(window.location.href);
    for (const key of ATTRIBUTE_KEYS) url.searchParams.delete(key);
    for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", url);

    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current.controller.abort();
      pending.current = null;
    }
    if (!query) {
      setResult(initial);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    // Typing waits for a pause; clicks go out at once.
    const timer = setTimeout(() => {
      fetch(`/api/people/attributes?${query}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: AttributeResult) => setResult(data))
        .catch((error) => { if (error.name !== "AbortError") console.error(error); })
        .finally(() => { if (pending.current?.controller === controller) { pending.current = null; setLoading(false); } });
    }, typing ? 250 : 0);
    pending.current = { controller, timer };
  }, [initial]);

  // Filters in the address bar (shared links) apply on
  // load, once hydration is done.
  useEffect(() => {
    const fromUrl = parseAttributeParams(new URLSearchParams(window.location.search));
    if (!isFiltered(fromUrl)) return;
    const frame = requestAnimationFrame(() => setParams(fromUrl));
    return () => cancelAnimationFrame(frame);
  }, [setParams]);

  const set: SetFilter = useCallback(
    (key, value) => setParams({ ...current.current, [key]: value || undefined }, { typing: key === "q" }),
    [setParams],
  );
  return { params, setParams, set, result, loading };
}

// A readable label for each active filter.
function chipLabel(key: keyof AttributeParams, value: string): string {
  if (value === NOT_RECORDED) return `${CHIP_PREFIX[key] ?? key}: not recorded`;
  const named: Partial<Record<keyof AttributeParams, string | undefined>> = {
    q: `“${value}”`,
    group: roleGroups.find((g) => g.key === value)?.label,
    row: SPECTRUM_ROWS.find((r) => r.key === value)?.label,
    side: sideLabels[value as GraphSide],
    state: usStateName(value.toUpperCase()),
    ties: `${value} connections`,
    sex: sexLabels[value],
    race: raceLabels[value],
    religion: religionLabels[value],
    born: bornLabels[value],
    gen: generations.find((g) => g.key === value)?.label,
  };
  return named[key] ?? value;
}

const CHIP_PREFIX: Partial<Record<keyof AttributeParams, string>> = {
  sex: "Sex", race: "Race", religion: "Religion", ancestry: "Ancestry", born: "Birthplace", gen: "Generation",
};

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

function Match({ match }: { match: AttributeMatch }) {
  const fill = FAMILY_FILL[match.family];
  return (
    <li>
      <Link href={match.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold" style={{ background: `color-mix(in srgb, ${fill} 14%, transparent)`, color: fill }}>
          {initials(match.name)}
          {match.imageUrl ? <PortraitImage src={match.imageUrl} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-950 group-hover:underline dark:text-white">{match.name}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{[match.role, match.place].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400" title="Direct documented relationships (excludes seats, committees and party membership)">
          {fmt(match.ties)} {match.ties === 1 ? "tie" : "ties"}
        </span>
      </Link>
    </li>
  );
}

export function PeopleAttributes({
  params,
  set,
  clear,
  result,
  loading,
}: {
  params: AttributeParams;
  set: SetFilter;
  clear: () => void;
  result: AttributeResult;
  loading: boolean;
}) {
  const filtered = isFiltered(params);
  const active = ATTRIBUTE_KEYS.filter((key) => key !== "q" && params[key]);

  return (
    <section id="attributes" aria-labelledby="attributes-title" className="scroll-mt-24 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="attributes-title" className="text-2xl font-semibold tracking-tight">Attributes</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {filtered ? `${fmt(result.total)} match` : `${fmt(result.total)} people and organizations. Pick any attribute to see who fits.`}
          </p>
        </div>
        <label className="relative w-full sm:w-96">
          <span className="sr-only">Search by name or description</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={params.q ?? ""}
            onChange={(event) => set("q", event.target.value.slice(0, 100))}
            placeholder="Search within these attributes"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      {active.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {active.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set(key, undefined)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-900 bg-slate-900 py-1 pr-2 pl-3 text-white dark:border-white dark:bg-white dark:text-slate-950"
            >
              {chipLabel(key, params[key]!)} <X className="h-3.5 w-3.5" aria-label="Remove" />
            </button>
          ))}
          <button type="button" onClick={clear} className="px-2 py-1 text-slate-500 underline underline-offset-2">Clear all</button>
        </div>
      ) : null}

      <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {filtered ? (
          result.matches.length ? (
            <div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.matches.map((match) => <Match key={match.id} match={match} />)}
              </ul>
              {result.total > result.matches.length ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  The {result.matches.length} best connected of {fmt(result.total)}. Search or add an attribute to narrow.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">Nobody matches these attributes.</p>
          )
        ) : null}

        <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <TraitFacets facets={result.facets} params={params} set={set} />
          <p className="mt-5 text-xs text-slate-400">{TRAIT_NOTE}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <PositionFacets facets={result.facets} params={params} set={set} />
        </div>
      </div>
    </section>
  );
}
