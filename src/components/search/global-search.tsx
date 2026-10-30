"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { typeColorFor } from "@/lib/type-colors";
import type { SearchResponse, SearchResult } from "@/app/api/search/route";

type Group = SearchResponse["order"][number];

const GROUP_LABELS: Record<Group, string> = {
  pages: "Pages & data",
  datasets: "Datasets",
  entities: "People & organizations",
};

const PEOPLE_TYPES = new Set(["politician", "judge", "pundit", "journalist", "donor", "lobbyist"]);

const EMPTY: SearchResponse = { pages: [], datasets: [], entities: [], order: [] };

const ALL_PEOPLE_ID = "all-people";

/** Each group's rows; people end with a link to the full directory search. */
function groupItems(results: SearchResponse, group: Group, query: string): SearchResult[] {
  const items = results[group];
  if (group !== "entities" || items.length === 0) return items;
  const q = query.trim();
  return [
    ...items,
    { id: ALL_PEOPLE_ID, label: `All people matching “${q}”`, meta: "", href: `/subpoena?q=${encodeURIComponent(q)}` },
  ];
}

export function GlobalSearch({
  placeholder = "Search…",
  placeholders,
  size = "md",
  autoFocus = false,
}: {
  placeholder?: string;
  /** Cycles through these as the placeholder when the input is empty and unfocused. */
  placeholders?: string[];
  size?: "md" | "lg";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!placeholders || placeholders.length < 2 || query || open) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [placeholders, query, open]);

  useEffect(() => {
    const q = query.trim();
    // Nothing to fetch when empty — the dropdown itself is gated on
    // `query.trim()`, so stale results just never get rendered. Loading
    // is set to true from the input's onChange (a real event handler),
    // not here, so this effect only ever sets state inside a callback.
    if (!q) return;
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : EMPTY))
        .then((data: SearchResponse) => setResults(data))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const flat = useMemo(
    () => results.order.flatMap((key) => groupItems(results, key, query).map((r) => ({ ...r, group: key }))),
    [results, query],
  );

  function select(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  const inputClass =
    size === "lg"
      ? "w-full rounded-xl border border-slate-300 bg-white py-4 pl-12 pr-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      : "w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <div ref={containerRef} className="relative w-full">
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
          size === "lg" ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
        }`}
      />
      <input
        // A bare unnamed text input looks like a username field to Safari's
        // password autofill; declaring it a search box keeps it out.
        type="search"
        name="q"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search"
        data-1p-ignore
        data-lpignore="true"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          setHighlighted(0);
          setOpen(true);
          setLoading(Boolean(value.trim()));
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || flat.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, flat.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            select(flat[highlighted]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholders ? placeholders[placeholderIndex] : placeholder}
        className={`${inputClass} appearance-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
      />

      {open && query.trim() ? (
        <div
          className={`absolute top-full z-30 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
            // The header's box is narrow, so its results open wider, leftward.
            size === "lg" ? "left-0 max-h-96 w-full overflow-y-auto" : "right-0 w-[max(100%,min(22rem,calc(100vw-2rem)))]"
          }`}
        >
          {loading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            results.order.map((key) => {
              const items = groupItems(results, key, query);
              if (items.length === 0) return null;
              return (
                <div key={key} className="border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
                  <p className="px-4 pt-1 pb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    {GROUP_LABELS[key]}
                  </p>
                  <ul>
                    {items.map((item) => {
                      const flatIndex = flat.findIndex((f) => f.group === key && f.id === item.id);
                      const color = typeColorFor(PEOPLE_TYPES.has(item.type ?? "") ? "people" : key);
                      const active = flatIndex === highlighted;
                      if (item.id === ALL_PEOPLE_ID) {
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setHighlighted(flatIndex)}
                              onClick={() => select(item)}
                              className={`flex w-full items-center px-4 py-2 text-left text-xs font-medium text-slate-500 transition-colors dark:text-slate-400 ${
                                active ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              }`}
                            >
                              <span className="truncate">{item.label} →</span>
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setHighlighted(flatIndex)}
                            onClick={() => select(item)}
                            className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                              active
                                ? "bg-slate-100 dark:bg-slate-800"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full border-2"
                              style={{ background: item.dossier ? color.border : color.bg, borderColor: color.border }}
                            />
                            <span className="truncate text-slate-800 dark:text-slate-200">{item.label}</span>
                            {item.dossier ? (
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
                                Dossier
                              </span>
                            ) : null}
                            <span className="ml-auto shrink-0 truncate pl-2 text-xs text-slate-400">
                              {item.meta}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
