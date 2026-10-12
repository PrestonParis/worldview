"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Crosshair, ExternalLink, X } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { Menu, MenuFooter, MenuItem, ToggleGroup } from "./graph-controls";
import type { OverviewTiers } from "@/lib/graph/scope";
import { GRAPH_ROWS, graphRowIndexForType, type GraphRow } from "@/lib/graph/layout";
import { NetworkGraph } from "./network-graph";
import { ENTITY_TYPE_ORDER } from "@/lib/graph/scope";
import {
  relationshipCategories,
  relationshipCategoryColors,
  relationshipCategoryOf,
} from "@/lib/relationships";
import { FAMILY_HEX, FAMILY_LABEL } from "@/lib/people/family-colors";
import { typeLabels } from "@/lib/people/public";
import type { NodeFamily } from "@/lib/graph/lean";
import { publicEntityPath } from "@/lib/people/public";
import { relationshipTypeBySlug } from "@/lib/relationships";
import type { NetworkLink, NetworkNode, SearchItem } from "@/lib/graph/network";

export interface OverviewInfo {
  tiers: OverviewTiers;
  /** Entities the overview can reach at "All". */
  available: number;
  /** Current cap; null = all. */
  limit: number | null;
  limits: number[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function GraphView({
  nodes,
  links,
  searchItems,
  rootEntity,
  depth,
  includeHubs,
  typeFilter,
  relFilter,
  rows,
  overview,
  relCategoryCounts,
  searchPlaceholder,
  hiddenNodeCount = 0,
}: {
  nodes: NetworkNode[];
  links: NetworkLink[];
  searchItems: SearchItem[];
  rootEntity: { id: string; name: string } | null;
  depth: number;
  includeHubs: boolean;
  typeFilter: string[];
  relFilter: string[];
  rows: GraphRow[];
  /** Present on the overview (no focused entity). */
  overview: OverviewInfo | null;
  relCategoryCounts: Record<string, number>;
  searchPlaceholder: string;
  hiddenNodeCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(rootEntity?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // A new subject starts selected; reset during render rather than in an
  // effect so the old selection never paints against the new graph.
  const [shownRoot, setShownRoot] = useState(rootEntity?.id ?? null);
  if (shownRoot !== (rootEntity?.id ?? null)) {
    setShownRoot(rootEntity?.id ?? null);
    setSelectedId(rootEntity?.id ?? null);
    setSelectedEdgeId(null);
  }
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedEdgeId(null);
  }, []);
  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id) setSelectedId(null);
  }, []);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      setSelectedId(null);
      setSelectedEdgeId(null);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const focusOn = useCallback((id: string) => setParams({ root: id }), [setParams]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  const selectedEdge = selectedEdgeId ? links.find((l) => l.id === selectedEdgeId) ?? null : null;
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

  // Row toggles are shorthand for the type filter: a row is on while any of
  // its types is, and toggling it adds or removes all of them at once.
  const rowTypes = GRAPH_ROWS.map((_, r) => ENTITY_TYPE_ORDER.filter((t) => graphRowIndexForType(t) === r));
  const activeRows = new Set<string>(
    GRAPH_ROWS.filter((_, r) => !activeTypes.size || rowTypes[r].some((t) => activeTypes.has(t))).map((row) => row.key),
  );
  const toggleRow = (key: string) => {
    const r = GRAPH_ROWS.findIndex((row) => row.key === key);
    const next = new Set<string>(activeTypes.size ? activeTypes : ENTITY_TYPE_ORDER);
    for (const t of rowTypes[r]) {
      if (activeRows.has(key)) next.delete(t);
      else next.add(t);
    }
    const all = ENTITY_TYPE_ORDER.every((t) => next.has(t));
    setParams({ type: all || !next.size ? null : [...next].join(",") });
  };

  const activeRels = new Set(relFilter);
  const toggleRel = (cat: string) => {
    const next = new Set(activeRels);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setParams({ rel: next.size ? [...next].join(",") : null });
  };
  const availableRels = relationshipCategories.filter((c) => relCategoryCounts[c] > 0);

  // Overview size: the preset steps that are below what's reachable, then "All".
  const setLimit = (value: number | null) =>
    setParams({ limit: value === null ? "all" : value === overview?.limits[0] ? null : String(value) });
  const limitSteps = overview ? overview.limits.filter((l) => l < overview.available) : [];
  const nextLimit = overview
    ? overview.limit === null || nodes.length >= overview.available
      ? undefined
      : limitSteps.find((l) => l > (overview.limit ?? 0)) ?? null
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <EntitySearch entities={searchItems} placeholder={searchPlaceholder} onSelect={focusOn} />

        <ToggleGroup
          active={activeRows}
          onToggle={toggleRow}
          options={GRAPH_ROWS.map((row) => ({
            value: row.key,
            label: row.label,
            // Keep at least one row on.
            disabled: activeRows.size === 1 && activeRows.has(row.key),
          }))}
        />

        <Menu label="Type" badge={activeTypes.size}>
          {() => (
            <>
              {ENTITY_TYPE_ORDER.map((t) => (
                <MenuItem
                  key={t}
                  checked={activeTypes.has(t)}
                  onClick={() => toggleType(t)}
                  label={typeLabels[t] ?? t}
                />
              ))}
              <MenuFooter>
                {activeTypes.size ? (
                  <button type="button" onClick={() => setParams({ type: null })} className="underline underline-offset-2">
                    Show all types
                  </button>
                ) : (
                  "Showing every type"
                )}
              </MenuFooter>
            </>
          )}
        </Menu>

        {availableRels.length > 0 ? (
          <Menu label="Relationship" badge={activeRels.size}>
            {() => (
              <>
                {availableRels.map((cat) => (
                  <MenuItem
                    key={cat}
                    checked={activeRels.has(cat)}
                    onClick={() => toggleRel(cat)}
                    dot={relationshipCategoryColors[cat]}
                    label={cat}
                    hint={fmt(relCategoryCounts[cat])}
                  />
                ))}
                <MenuFooter>
                  {activeRels.size ? (
                    <button type="button" onClick={() => setParams({ rel: null })} className="underline underline-offset-2">
                      Show all relationships
                    </button>
                  ) : (
                    "Showing every relationship"
                  )}
                </MenuFooter>
              </>
            )}
          </Menu>
        ) : null}

        {overview ? (
          <div className="ml-auto">
            <Menu
              align="right"
              label={
                <span className="tabular-nums">
                  {fmt(nodes.length)} <span className="font-normal text-slate-400">of {fmt(overview.available)}</span>
                </span>
              }
            >
              {(close) => (
                <>
                  {limitSteps.map((l) => (
                    <MenuItem
                      key={l}
                      checked={overview.limit === l}
                      onClick={() => {
                        setLimit(l);
                        close();
                      }}
                      label={`Show ${fmt(l)}`}
                    />
                  ))}
                  <MenuItem
                    checked={overview.limit === null || (overview.limit ?? 0) >= overview.available}
                    onClick={() => {
                      setLimit(null);
                      close();
                    }}
                    label="Show all"
                    hint={fmt(overview.available)}
                  />
                  <MenuFooter>
                    <TierBreakdown tiers={overview.tiers} filtered={activeRels.size > 0} />
                  </MenuFooter>
                </>
              )}
            </Menu>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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
              {[1, 2].map((d) => (
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
        ) : overview ? (
          <span>
            <OverviewSummary shown={nodes.length} tiers={overview.tiers} filtered={activeRels.size > 0} />
            {nextLimit !== undefined ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setLimit(nextLimit)}
                  className="font-medium text-slate-900 underline underline-offset-2 hover:no-underline dark:text-slate-100"
                >
                  {nextLimit === null ? `Show all ${fmt(overview.available)}` : `Show ${fmt(nextLimit)}`}
                </button>
              </>
            ) : null}
          </span>
        ) : null}
        <span className="ml-auto tabular-nums">
          {fmt(links.length)} visible relationships{hiddenNodeCount ? ` · ${fmt(hiddenNodeCount)} lower-prominence connections not drawn` : ""}
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
            rows={rows}
            selectedId={selectedId}
            onSelect={selectNode}
            onFocus={focusOn}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={selectEdge}
          />
        )}

        {selected ? (
          <aside className="absolute inset-x-2 bottom-2 max-h-[55%] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:inset-x-auto sm:top-2 sm:right-2 sm:bottom-2 sm:max-h-none sm:w-80 dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <FamilyDot family={selected.family} />
                  {typeLabels[selected.type] ?? selected.type} · {FAMILY_LABEL[selected.family]}
                </span>
                <h2 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">{selected.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => selectNode(null)}
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
                href={publicEntityPath(selected)}
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
                          onClick={() => selectEdge(link.id)}
                          className="text-left hover:underline"
                        >
                          <span className="text-slate-400">{outgoing ? (relationshipTypeBySlug[link.relType]?.verb ?? link.label) : (relationshipTypeBySlug[link.relType]?.inverse ?? link.label)}</span>{" "}
                          <span className="font-medium text-slate-800 dark:text-slate-100">{other.name}</span>
                          {link.role ? <span className="text-slate-400"> · {link.role}</span> : null}
                          {link.validFrom || link.validTo ? <span className="text-slate-400"> · {link.validFrom || "?"}–{link.validTo || "present"}</span> : null}
                          {link.former ? <span className="text-slate-400"> · former</span> : null}
                          <span className="text-slate-400"> · {link.sourced ? "sourced" : "source unavailable"}</span>
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

        {selectedEdge ? (
          <RelationshipInspector
            link={selectedEdge}
            source={nodeById.get(selectedEdge.source)}
            target={nodeById.get(selectedEdge.target)}
            onClose={() => selectEdge(null)}
            onSelectNode={selectNode}
            onFocus={focusOn}
          />
        ) : null}

        <FamilyLegend />
      </div>
    </div>
  );
}

function FamilyDot({ family }: { family: NodeFamily }) {
  return (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full">
      <span className="block h-full w-full rounded-full dark:hidden" style={{ background: FAMILY_HEX.light[family] }} />
      <span className="hidden h-full w-full rounded-full dark:block" style={{ background: FAMILY_HEX.dark[family] }} />
    </span>
  );
}

function FamilyLegend() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 hidden max-w-[220px] flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-600 backdrop-blur sm:flex dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
      {(["liberal", "conservative", "unplaced", "institution"] as const).map((family) => (
        <span key={family} className="inline-flex items-center gap-1.5">
          <FamilyDot family={family} />
          {FAMILY_LABEL[family]}
        </span>
      ))}
      <span className="mt-0.5 text-slate-400">Line colour = relationship type. Click a line for details.</span>
    </div>
  );
}

// What one relationship is, when, and where it's documented.
function RelationshipInspector({
  link,
  source,
  target,
  onClose,
  onSelectNode,
  onFocus,
}: {
  link: NetworkLink;
  source?: NetworkNode;
  target?: NetworkNode;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const type = relationshipTypeBySlug[link.relType];
  const category = relationshipCategoryOf(link.relType);
  const color = category ? relationshipCategoryColors[category] : "#94A3B8";
  const dates = link.validFrom || link.validTo ? `${link.validFrom || "?"} – ${link.validTo || "present"}` : null;
  const end = (node?: NetworkNode) =>
    node ? (
      <button type="button" onClick={() => onSelectNode(node.id)} className="inline-flex items-center gap-1.5 text-left font-semibold text-slate-900 hover:underline dark:text-white">
        <FamilyDot family={node.family} />
        {node.name}
      </button>
    ) : (
      <span className="text-slate-400">Unknown</span>
    );

  return (
    <aside className="absolute inset-x-2 bottom-2 max-h-[55%] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:inset-x-auto sm:top-2 sm:right-2 sm:bottom-auto sm:max-h-none sm:w-80 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 capitalize dark:text-slate-400">
          <span className="h-0.5 w-4 rounded" style={{ background: color }} />
          {category ?? "relationship"}
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-1 text-sm">
        {end(source)}
        <p className="flex items-center gap-1.5 pl-4 text-slate-500 dark:text-slate-400">
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{type?.verb ?? link.label}</span>
        </p>
        {end(target)}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {type && link.label && link.label.toLowerCase() !== type.verb.toLowerCase() && link.label.toLowerCase() !== type.label.toLowerCase() ? (
          <div>
            <dt className="text-xs text-slate-400">Detail</dt>
            <dd className="text-slate-700 dark:text-slate-200">{link.label}</dd>
          </div>
        ) : null}
        {link.role ? (
          <div>
            <dt className="text-xs text-slate-400">Role</dt>
            <dd className="text-slate-700 dark:text-slate-200">{link.role}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-slate-400">When</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {dates ?? "Dates not recorded"}
            {link.former ? " · former" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Source</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {link.sourceUrl ? (
              <a href={link.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 hover:underline">
                {link.sourceTitle || link.sourceUrl}
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              </a>
            ) : (
              link.sourceTitle ?? (link.sourced ? "Recorded source" : "No source recorded")
            )}
            {link.sourcePublisher ? <span className="block text-xs text-slate-400">{link.sourcePublisher}</span> : null}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {[source, target].map((node) =>
          node ? (
            <button
              key={node.id}
              type="button"
              onClick={() => onFocus(node.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
            >
              <Crosshair className="h-3.5 w-3.5" /> Centre on {node.name.split(" ").slice(-1)[0]}
            </button>
          ) : null,
        )}
      </div>
    </aside>
  );
}

// One line saying where everyone not on the canvas is.
function OverviewSummary({
  shown,
  tiers,
  filtered,
}: {
  shown: number;
  tiers: OverviewTiers;
  filtered: boolean;
}) {
  if (filtered) return <>{fmt(shown)} of {fmt(tiers.direct)} linked by the selected relationships.</>;
  if (shown <= tiers.direct) {
    return (
      <>
        Showing {fmt(shown)} of the {fmt(tiers.direct)} with direct ties to someone. Another{" "}
        {fmt(tiers.structural)} are linked only by seats and committees, and {fmt(tiers.unconnected)} have no ties
        yet.
      </>
    );
  }
  return (
    <>
      Showing all {fmt(tiers.direct)} with direct ties plus {fmt(Math.min(shown - tiers.direct, tiers.structural))}{" "}
      linked by seats and committees
      {shown > tiers.direct + tiers.structural
        ? ` and ${fmt(shown - tiers.direct - tiers.structural)} with no ties yet`
        : ""}
      .
    </>
  );
}

function TierBreakdown({ tiers, filtered }: { tiers: OverviewTiers; filtered: boolean }) {
  if (filtered) return <>{fmt(tiers.direct)} match the selected relationships.</>;
  return (
    <span className="block space-y-0.5 py-0.5 normal-case">
      <span className="block">Fills in this order:</span>
      <span className="block">1. {fmt(tiers.direct)} with direct ties</span>
      <span className="block">2. {fmt(tiers.structural)} linked by seats &amp; committees</span>
      <span className="block">3. {fmt(tiers.unconnected)} with no ties yet</span>
    </span>
  );
}
