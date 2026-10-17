import Link from "next/link";
import { Briefcase, Building2, HandCoins, LayoutGrid, List, Mic, Newspaper, Search, UserRound, type LucideIcon } from "lucide-react";
import { DirectoryFacets } from "@/components/people/directory-facets";
import { PortraitImage } from "@/components/people/portrait-image";
import { familyOf } from "@/lib/graph/lean";
import { DIRECTORY_PAGE_SIZE, buildDirectory, directoryHref, stateAbbrOf, type DirectoryParams } from "@/lib/people/directory";
import { FAMILY_FILL } from "@/lib/people/family-colors";
import { entityPartyAndPlace, entityRole, publicEntityPath, roleGroups } from "@/lib/people/public";
import type { Entity } from "@/lib/validation/entity";

export type { DirectoryParams };

const TYPE_ICON: Record<string, LucideIcon> = {
  politician: UserRound,
  pundit: Mic,
  journalist: Newspaper,
  organization: Building2,
  company: Briefcase,
  lobbyist: HandCoins,
  donor: HandCoins,
};

const PARTY_SHORT: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

function placeLabel(entity: Entity): string {
  const { party, place } = entityPartyAndPlace(entity);
  return [PARTY_SHORT[party] ?? party, stateAbbrOf(entity) ?? place].filter(Boolean).join(" · ");
}

// Photo when we have one; otherwise a monogram tinted by political family.
// The monogram sits underneath the photo so a broken image URL degrades to it.
function Portrait({ entity, className }: { entity: Entity; className: string }) {
  const fill = FAMILY_FILL[familyOf(entity)];
  const Icon = TYPE_ICON[entity.type] ?? UserRound;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `color-mix(in srgb, ${fill} 14%, transparent)` }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ color: fill }}>
        <span className="font-semibold leading-none text-[clamp(0.75rem,30cqw,2.5rem)]">{initials(entity.name)}</span>
        <Icon className="h-[22%] max-h-5 w-[22%] max-w-5 opacity-70" aria-hidden />
      </div>
      {entity.imageUrl ? <PortraitImage src={entity.imageUrl} /> : null}
    </div>
  );
}

function Card({ entity, ties }: { entity: Entity; ties: number }) {
  const fill = FAMILY_FILL[familyOf(entity)];
  const meta = placeLabel(entity);
  return (
    <li>
      <Link
        href={publicEntityPath(entity)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
      >
        <Portrait entity={entity} className="aspect-4/5 w-full @container" />
        <div className="h-1 w-full" style={{ background: fill }} />
        <div className="flex flex-1 flex-col p-3">
          <span className="line-clamp-2 font-semibold leading-snug text-slate-950 group-hover:underline dark:text-white">{entity.name}</span>
          <span className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{entityRole(entity)}</span>
          <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
            <span className="truncate text-slate-600 dark:text-slate-300">{meta}</span>
            <span className="shrink-0 tabular-nums text-slate-400" title="Direct documented relationships (excludes seats, committees and party membership)">{ties.toLocaleString("en-US")} {ties === 1 ? "tie" : "ties"}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}

function Row({ entity, ties, maxTies }: { entity: Entity; ties: number; maxTies: number }) {
  return (
    <li className="grid grid-cols-[44px_1fr] items-center gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[44px_minmax(200px,1.4fr)_minmax(160px,1fr)_140px_140px]">
      <Portrait entity={entity} className="h-11 w-11 rounded-full @container" />
      <div className="min-w-0">
        <Link href={publicEntityPath(entity)} className="font-medium text-slate-950 hover:underline dark:text-white">{entity.name}</Link>
        <p className="mt-0.5 truncate text-xs text-slate-400">{entity.description}</p>
      </div>
      <span className="col-start-2 text-sm text-slate-600 md:col-start-auto dark:text-slate-300">{entityRole(entity)}</span>
      <span className="col-start-2 inline-flex items-center gap-2 text-sm text-slate-500 md:col-start-auto">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FAMILY_FILL[familyOf(entity)] }} />
        {placeLabel(entity) || "Not reported"}
      </span>
      <span className="col-start-2 flex items-center gap-2 md:col-start-auto">
        <span className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
          <span className="block h-full rounded-full" style={{ width: `${(ties / maxTies) * 100}%`, background: "var(--viz-series-1)" }} />
        </span>
        <span className="w-10 text-right text-sm font-medium tabular-nums">{ties.toLocaleString("en-US")}</span>
      </span>
    </li>
  );
}

const pill = (on: boolean) =>
  `rounded-full border px-3 py-1.5 ${on ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"}`;

export function PeopleDirectory({
  entities,
  degree,
  params,
}: {
  entities: Entity[];
  degree: Map<string, number>;
  params: DirectoryParams;
}) {
  const { rows, facets } = buildDirectory(entities, degree, params);
  const group = roleGroups.find((item) => item.key === params.group);
  const pages = Math.max(1, Math.ceil(rows.length / DIRECTORY_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const visible = rows.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE);
  const isList = params.layout === "list";
  const maxTies = Math.max(1, ...visible.map((entity) => degree.get(entity.id) ?? 0));
  const filtered = Boolean(params.group || params.side || params.state || params.ties || params.q);

  return (
    <section className="pb-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {rows.length.toLocaleString("en-US")} {group ? group.label.toLowerCase() : "people and organizations"}
            {filtered ? " match" : ""}
          </p>
        </div>
        <form action="/people/directory" className="relative w-full sm:w-96">
          {(["group", "side", "state", "ties", "sort", "layout"] as const).map((key) =>
            params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
          )}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={params.q} placeholder="Search the directory" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950" />
        </form>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href={directoryHref(params, { group: undefined })} className={pill(!params.group)}>All roles</Link>
        {roleGroups.map((item) => (
          <Link key={item.key} href={directoryHref(params, { group: item.key })} className={pill(params.group === item.key)}>
            {item.label} <span className="ml-1 tabular-nums opacity-60">{(facets.group[item.key] ?? 0).toLocaleString("en-US")}</span>
          </Link>
        ))}
        {filtered ? <Link href={directoryHref({ layout: params.layout }, {})} className="px-2 py-1.5 text-slate-500 underline underline-offset-2">Clear filters</Link> : null}
      </div>

      <DirectoryFacets facets={facets} params={params} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-3">
          Sort
          <Link href={directoryHref(params, { sort: undefined })} className={!params.sort ? "font-semibold text-slate-950 dark:text-white" : "hover:text-slate-950 dark:hover:text-white"}>Connections</Link>
          <Link href={directoryHref(params, { sort: "name" })} className={params.sort === "name" ? "font-semibold text-slate-950 dark:text-white" : "hover:text-slate-950 dark:hover:text-white"}>A-Z</Link>
          <Link href={directoryHref(params, { sort: "updated" })} className={params.sort === "updated" ? "font-semibold text-slate-950 dark:text-white" : "hover:text-slate-950 dark:hover:text-white"}>Updated</Link>
        </span>
        <span className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800" role="group" aria-label="Layout">
          <Link href={directoryHref(params, { layout: undefined, page: params.page })} aria-current={!isList ? "true" : undefined} aria-label="Grid" className={`rounded-md p-1.5 ${!isList ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "hover:text-slate-950 dark:hover:text-white"}`}><LayoutGrid className="h-4 w-4" /></Link>
          <Link href={directoryHref(params, { layout: "list", page: params.page })} aria-current={isList ? "true" : undefined} aria-label="List" className={`rounded-md p-1.5 ${isList ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "hover:text-slate-950 dark:hover:text-white"}`}><List className="h-4 w-4" /></Link>
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-slate-800">No directory entries match these filters.</p>
      ) : isList ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="hidden grid-cols-[44px_minmax(200px,1.4fr)_minmax(160px,1fr)_140px_140px] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid dark:bg-slate-900/60">
            <span /><span>Name</span><span>Role</span><span>Party / place</span><span className="text-right">Connections</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((entity) => <Row key={entity.id} entity={entity} ties={degree.get(entity.id) ?? 0} maxTies={maxTies} />)}
          </ul>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((entity) => <Card key={entity.id} entity={entity} ties={degree.get(entity.id) ?? 0} />)}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Directory pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={directoryHref(params, { page: String(page - 1) })} className="font-medium">Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={directoryHref(params, { page: String(page + 1) })} className="font-medium">Next</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
