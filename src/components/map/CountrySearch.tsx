"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { countryId, searchCountries, type CountryFeature } from "@/lib/countries";
import { useAppStore } from "@/lib/store/useAppStore";

export function CountrySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CountryFeature[]>([]);
  const [open, setOpen] = useState(false);
  const selectCountry = useAppStore((s) => s.selectCountry);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    searchCountries(query).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSelect(feature: CountryFeature) {
    selectCountry(countryId(feature));
    setQuery(feature.properties.name);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    selectCountry(null);
  }

  return (
    <div ref={containerRef} className="absolute left-1/2 top-4 z-10 w-80 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950/90 px-3 py-2 shadow-lg backdrop-blur">
        <Search size={14} className="shrink-0 text-neutral-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a country or territory..."
          className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-neutral-500 hover:text-neutral-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && visibleResults.length > 0 && (
        <ul className="mt-1 max-h-72 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-950/95 shadow-lg backdrop-blur">
          {visibleResults.map((feature) => (
            <li key={countryId(feature)}>
              <button
                type="button"
                onClick={() => handleSelect(feature)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <span>{feature.properties.name}</span>
                <span className="text-xs text-neutral-500">
                  {feature.properties["ISO3166-1-Alpha-2"]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
