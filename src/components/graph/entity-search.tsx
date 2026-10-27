"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { entityColorFor } from "@/lib/entity-colors";

export interface EntitySearchResult {
  id: string;
  name: string;
  type: string;
  href: string;
}

interface EntitySearchResponse {
  matches: EntitySearchResult[];
}

export function EntitySearch({
  placeholder,
  onSelect,
}: {
  placeholder: string;
  onSelect: (entity: EntitySearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/people/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
        .then((data: EntitySearchResponse) => setResults(data.matches))
        .catch((error: Error) => {
          if (error.name !== "AbortError") setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
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

  function selectEntity(entity: EntitySearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    setLoading(false);
    onSelect(entity);
  }

  return (
    <div ref={containerRef} className="relative w-56 max-w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        name="people-search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search people and organizations"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && Boolean(query.trim())}
        aria-controls="people-search-results"
        value={query}
        onChange={(e) => {
          const value = e.target.value.slice(0, 100);
          setQuery(value);
          if (!value.trim()) {
            setResults([]);
            setLoading(false);
          } else {
            setLoading(true);
          }
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            selectEntity(results[highlighted]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {open && query.trim() ? (
        <div id="people-search-results" className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">No matches.</p>
          ) : (
            <ul>
              {results.map((entity, i) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => selectEntity(entity)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      i === highlighted
                        ? "bg-slate-100 dark:bg-slate-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                      style={{
                        background: entityColorFor(entity.type).bg,
                        borderColor: entityColorFor(entity.type).border,
                      }}
                    />
                    <span className="truncate text-slate-800 dark:text-slate-200">{entity.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{entity.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
