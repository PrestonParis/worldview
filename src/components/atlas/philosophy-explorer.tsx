"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PhilosophyProfile, PhilosophyScope } from "@/lib/atlas/philosophies";
import { FAMILIES, familyColor } from "@/lib/quiz/families";

const filters: { id: "all" | PhilosophyScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "economic", label: "Political economy" },
  { id: "governance", label: "Government" },
  { id: "social", label: "Society" },
  { id: "international", label: "International" },
  { id: "comprehensive", label: "Comprehensive" },
];

export function PhilosophyExplorer({ profiles }: { profiles: PhilosophyProfile[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<(typeof filters)[number]["id"]>("all");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter(
      (p) =>
        (scope === "all" || p.scopes.includes(scope)) &&
        (!q ||
          `${p.ideology.name} ${p.ideology.description} ${p.kind} ${p.history.origins.founders.join(" ")} ${p.history.figures.join(" ")}`
            .toLowerCase()
            .includes(q)),
    );
  }, [profiles, query, scope]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setScope(filter.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${scope === filter.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="flex min-w-60 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <Search size={15} className="text-slate-400" />
          <span className="sr-only">Search philosophies</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search traditions"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        {shown.length} of {profiles.length} traditions
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((profile) => {
          const color = familyColor(profile.ideology.family);
          return (
            <Link
              key={profile.ideology.id}
              href={`/atlas/philosophies/${profile.ideology.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                {FAMILIES[profile.ideology.family].label} · {profile.kind}
              </div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 group-hover:underline dark:text-white">
                {profile.ideology.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {profile.history.origins.when} · {profile.history.origins.where}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {profile.ideology.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.scopes.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
