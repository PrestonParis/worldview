"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/search-input";
import { sourceTypes, type Source } from "@/lib/validation/source";

export function SourceLibraryView({
  sources,
  searchPlaceholder,
}: {
  sources: Source[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => {
      if (typeFilter && s.sourceType !== typeFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) || (s.publisher ?? "").toLowerCase().includes(q)
      );
    });
  }, [sources, query, typeFilter]);

  const presentTypes = useMemo(
    () => sourceTypes.filter((t) => sources.some((s) => s.sourceType === t)),
    [sources],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === null
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            All
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                typeFilter === t
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No sources match.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">
                {s.sourceType.replace("_", " ")}
              </span>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
                >
                  {s.title}
                </a>
              ) : (
                <p className="font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.publisher || "Unknown publisher"}
                {s.publishedAt
                  ? ` · ${new Date(s.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
