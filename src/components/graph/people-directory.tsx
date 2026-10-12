import Link from "next/link";
import { Search } from "lucide-react";
import { leanOf } from "@/lib/graph/lean";
import {
  PEOPLE_PAGE_SIZE,
  entityPartyAndPlace,
  entityRole,
  publicEntityPath,
  roleGroups,
} from "@/lib/people/public";
import type { Entity } from "@/lib/validation/entity";

export interface DirectoryParams {
  q?: string;
  group?: string;
  side?: string;
  sort?: string;
  page?: string;
}

function hrefFor(params: DirectoryParams, patch: Partial<DirectoryParams>): string {
  const next = new URLSearchParams({ view: "directory" });
  for (const [key, value] of Object.entries({ ...params, ...patch })) {
    if (value) next.set(key, value);
  }
  return `/people?${next.toString()}`;
}

export function PeopleDirectory({
  entities,
  degree,
  params,
}: {
  entities: Entity[];
  degree: Map<string, number>;
  params: DirectoryParams;
}) {
  const query = (params.q ?? "").trim().toLowerCase();
  const group = roleGroups.find((item) => item.key === params.group);
  const rows = entities
    .filter((entity) => !group || (group.types as readonly string[]).includes(entity.type))
    .filter((entity) => {
      const lean = leanOf(entity);
      if (params.side === "liberal") return lean === "liberal";
      if (params.side === "conservative") return lean === "conservative";
      if (params.side === "uncharacterized") return lean === null;
      return true;
    })
    .filter((entity) => !query || `${entity.name} ${entity.description} ${entity.metadata}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (params.sort === "name") return a.name.localeCompare(b.name);
      if (params.sort === "updated") return String(b.updatedAt).localeCompare(String(a.updatedAt));
      return (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name);
    });
  const pages = Math.max(1, Math.ceil(rows.length / PEOPLE_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const visible = rows.slice((page - 1) * PEOPLE_PAGE_SIZE, page * PEOPLE_PAGE_SIZE);

  return (
    <section className="pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {rows.length.toLocaleString("en-US")} {group ? group.label.toLowerCase() : "people and organizations"}
          </p>
        </div>
        <form action="/people" className="relative w-full sm:w-96">
          <input type="hidden" name="view" value="directory" />
          {params.group ? <input type="hidden" name="group" value={params.group} /> : null}
          {params.side ? <input type="hidden" name="side" value={params.side} /> : null}
          {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={params.q} placeholder="Search the directory" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950" />
        </form>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link href={hrefFor(params, { group: undefined, page: undefined })} className={`rounded-full border px-3 py-1.5 ${!params.group ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>All roles</Link>
        {roleGroups.map((item) => (
          <Link key={item.key} href={hrefFor(params, { group: item.key, page: undefined })} className={`rounded-full border px-3 py-1.5 ${params.group === item.key ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>{item.label}</Link>
        ))}
        {(params.group || params.side || params.q) ? <Link href="/people?view=directory" className="px-2 py-1.5 text-slate-500 underline underline-offset-2">Clear filters</Link> : null}
        <span className="ml-auto flex items-center gap-2 text-slate-500">
          Sort
          <Link href={hrefFor(params, { sort: undefined, page: undefined })} className={!params.sort ? "font-semibold text-slate-950 dark:text-white" : ""}>Connections</Link>
          <Link href={hrefFor(params, { sort: "name", page: undefined })} className={params.sort === "name" ? "font-semibold text-slate-950 dark:text-white" : ""}>A-Z</Link>
          <Link href={hrefFor(params, { sort: "updated", page: undefined })} className={params.sort === "updated" ? "font-semibold text-slate-950 dark:text-white" : ""}>Updated</Link>
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_90px] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid dark:bg-slate-900/60">
          <span>Name</span><span>Role</span><span>Party / place</span><span className="text-right">Connections</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map((entity) => {
            const { party, place } = entityPartyAndPlace(entity);
            return (
              <li key={entity.id} className="grid gap-1 px-5 py-4 md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_90px] md:items-center md:gap-4">
                <div className="min-w-0">
                  <Link href={publicEntityPath(entity)} className="font-medium text-slate-950 hover:underline dark:text-white">{entity.name}</Link>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{entity.description}</p>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">{entityRole(entity)}</span>
                <span className="text-sm text-slate-500">{[party, place].filter(Boolean).join(" · ") || "Not reported"}</span>
                <span className="text-right text-sm font-medium tabular-nums">{(degree.get(entity.id) ?? 0).toLocaleString("en-US")}</span>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No directory entries match these filters.</p> : null}
      </div>

      {pages > 1 ? (
        <nav aria-label="Directory pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={hrefFor(params, { page: String(page - 1) })} className="font-medium">Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={hrefFor(params, { page: String(page + 1) })} className="font-medium">Next</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
