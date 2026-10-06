"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crosshair, ExternalLink, X } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { NetworkGraph } from "./network-graph";
import { ENTITY_TYPE_ORDER } from "@/lib/graph/scope";
import {
  relationshipCategories,
  relationshipCategoryColors,
  relationshipCategoryOf,
} from "@/lib/relationships";
import { entityColorFor } from "@/lib/entity-colors";
import type { NetworkLink, NetworkNode, SearchItem } from "@/lib/graph/network";

export function GraphView({
  nodes,
  links,
  searchItems,
  rootEntity,
  depth,
  includeHubs,
  typeFilter,
  relFilter,
  hidesStructural,
  relCategoryCounts,
  totalEntityCount,
  searchPlaceholder,
}: {
  nodes: NetworkNode[];
  links: NetworkLink[];
  searchItems: SearchItem[];
  rootEntity: { id: string; name: string } | null;
  depth: number;
  includeHubs: boolean;
  typeFilter: string[];
  relFilter: string[];
  /** Overview with no relationship filter: seats/committees/parties are left out. */
  hidesStructural: boolean;
  relCategoryCounts: Record<string, number>;
  totalEntityCount: number;
  searchPlaceholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      setSelectedId(null);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const focusOn = useCallback((id: string) => setParams({ root: id }), [setParams]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  // The selected node's ties in view, grouped by relationship category.
  const selectedTies = useMemo(() => {
    if (!selected) return [];
    const groups = new Map<string, { link: NetworkLink; other: NetworkNode; outgoing: boolean }[]>();
    for (const link of links) {
      const outgoing = link.source === selected.id;
      if (!outgoing && link.target !== selected.id) continue;
      const other = nodeById.get(outgoing ? link.target : link.source);
      if (!other) continue;
      const cat = relationshipCategoryOf(link.relType) ?? "other";
      groups.set(cat, [...(groups.get(cat) ?? []), { link, other, outgoing }]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [selected, links, nodeById]);

  const activeTypes = new Set(typeFilter);
  const toggleType = (t: string) => {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setParams({ type: next.size ? [...next].join(",") : null });
  };

  const activeRels = new Set(relFilter);
  const toggleRel = (cat: string) => {
    const next = new Set(activeRels);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setParams({ rel: next.size ? [...next].join(",") : null });
  };
  const availableRels = relationshipCategories.filter((c) => relCategoryCounts[c] > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <EntitySearch entities={searchItems} placeholder={searchPlaceholder} onSelect={focusOn} />

        {ENTITY_TYPE_ORDER.map((t) => {
          const active = activeTypes.has(t);
          const c = entityColorFor(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                active
                  ? "text-slate-900 dark:text-slate-100"
                  : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-800 dark:text-slate-400"
              }`}
              style={active ? { background: c.bg, borderColor: c.border, color: c.text } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.border }} />
              {t}
            </button>
          );
        })}
      </div>

      {availableRels.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-slate-400">relationship:</span>
          {availableRels.map((cat) => {
            const active = activeRels.has(cat);
            const color = relationshipCategoryColors[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleRel(cat)}
                title={`${relCategoryCounts[cat]} ${rootEntity ? "in view" : "in the graph"}`}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  active
                    ? "border-transparent text-white"
                    : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-800 dark:text-slate-400"
                }`}
                style={active ? { background: color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color, outline: active ? "1px solid rgba(255,255,255,.6)" : "none" }}
                />
                {cat}
              </button>
            );
          })}
          {activeRels.size > 0 ? (
            <button
              type="button"
              onClick={() => setParams({ rel: null })}
              className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              reset
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {rootEntity ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Centred on {rootEntity.name}
              <button
                type="button"
                aria-label="Clear focus"
                onClick={() => setParams({ root: null, depth: null, hubs: null })}
                className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <span className="flex items-center gap-1">
              hops:
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setParams({ depth: String(d) })}
                  className={`rounded px-1.5 py-0.5 tabular-nums ${
                    depth === d
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeHubs}
                onChange={(e) => setParams({ hubs: e.target.checked ? "1" : null })}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
              />
              expand parties &amp; chambers
            </label>
          </>
        ) : (
          <span>
            {hidesStructural
              ? `Real ties between ${nodes.length} of ${totalEntityCount} people and organizations. Seats, committees and party cards are hidden — pick “institutional” to add them.`
              : `${nodes.length} of ${totalEntityCount} people and organizations linked by the selected relationships.`}
          </span>
        )}
        <span className="ml-auto tabular-nums">
          {nodes.length} shown · {links.length} links · size = connections · click to inspect,
          double-click to centre
        </span>
      </div>

      <div className="relative mt-3 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {nodes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nothing matches these filters.</p>
        ) : (
          <NetworkGraph
            nodes={nodes}
            links={links}
            rootId={rootEntity?.id ?? null}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onFocus={focusOn}
          />
        )}

        {selected ? (
          <aside className="absolute inset-x-2 bottom-2 max-h-[55%] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:inset-x-auto sm:top-2 sm:right-2 sm:bottom-2 sm:max-h-none sm:w-80 dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span
                  className="inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize"
                  style={{
                    background: entityColorFor(selected.type).bg,
                    borderColor: entityColorFor(selected.type).border,
                    color: entityColorFor(selected.type).text,
                  }}
                >
                  {selected.type}
                </span>
                <h2 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">{selected.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedId(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {selected.description ? (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.description}</p>
            ) : null}

            <div className="mt-3 flex gap-2">
              {selected.id !== rootEntity?.id ? (
                <button
                  type="button"
                  onClick={() => focusOn(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <Crosshair className="h-3.5 w-3.5" /> Centre here
                </button>
              ) : null}
              <Link
                href={`/data/entities/${selected.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Full profile
              </Link>
            </div>

            <h3 className="mt-4 text-xs font-medium tracking-wide text-slate-400 uppercase">
              {selected.degree} connection{selected.degree === 1 ? "" : "s"} in view
            </h3>
            <div className="mt-2 space-y-3">
              {selectedTies.map(([cat, ties]) => (
                <div key={cat}>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 capitalize">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: relationshipCategoryColors[cat as keyof typeof relationshipCategoryColors] ?? "#94A3B8" }}
                    />
                    {cat} · {ties.length}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {ties.slice(0, 12).map(({ link, other, outgoing }) => (
                      <li key={link.id} className="text-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedId(other.id)}
                          className="text-left hover:underline"
                        >
                          <span className="text-slate-400">{outgoing ? link.label : `${link.label} ←`}</span>{" "}
                          <span className="font-medium text-slate-800 dark:text-slate-100">{other.name}</span>
                          {link.role ? <span className="text-slate-400"> · {link.role}</span> : null}
                        </button>
                      </li>
                    ))}
                    {ties.length > 12 ? (
                      <li className="text-xs text-slate-400">+{ties.length - 12} more — centre here to see all</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
