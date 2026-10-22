"use client";

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import type { Entity } from "@/lib/validation/entity";
import { Surface } from "@/components/ui/surface";
import { parseEntityMetadata, publicEntityPath, typeLabels } from "@/lib/people/public";

interface Props {
  featuredEntities: Entity[];
  initialQuery: string;
}

const PERSON_TYPES = new Set(["politician", "judge", "pundit", "journalist", "lobbyist", "donor"]);
const DISCOVERY_SECTIONS = [
  {
    key: "influence",
    eyebrow: "Money and influence",
    title: "The people financing political power",
    description: "Major donors, business leaders, and operators whose money or networks shape campaigns and policy.",
    types: new Set(["donor"]),
    limit: 32,
  },
  {
    key: "government",
    eyebrow: "Government and elections",
    title: "Officeholders and candidates",
    description: "Biographical case files for the people seeking, holding, and using public power.",
    types: new Set(["politician", "judge"]),
    limit: 8,
  },
  {
    key: "media",
    eyebrow: "Media and ideas",
    title: "Voices shaping the political conversation",
    description: "Journalists and commentators whose work influences what the public and policymakers debate.",
    types: new Set(["pundit", "journalist"]),
    limit: 8,
  },
  {
    key: "institutions",
    eyebrow: "Institutions",
    title: "Organizations in the influence network",
    description: "Committees, advocacy groups, and institutions that connect people, money, and political action.",
    types: new Set(["organization", "company", "lobbyist"]),
    limit: 8,
  },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function influenceAreas(entity: Entity): string[] {
  const value = parseEntityMetadata(entity.metadata).influenceAreas;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 2)
    : [];
}

function DiscoveryCard({ entity }: { entity: Entity }) {
  const areas = influenceAreas(entity);
  return (
    <Link
      href={publicEntityPath(entity)}
      className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-950/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-700"
    >
      <div className="flex items-start justify-between gap-4">
        {entity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imported public profile image
          <img src={entity.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {initials(entity.name)}
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
          {typeLabels[entity.type] ?? entity.type}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
        {entity.name}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {entity.description || entity.biography || "Open the profile for biography, money, and documented connections."}
      </p>
      {areas.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {areas.map((area) => (
            <span
              key={area}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
            >
              {area}
            </span>
          ))}
        </div>
      ) : null}
      <span className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
        Open profile <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function SubpoenaDiscovery({ entities }: { entities: Entity[] }) {
  const personCount = entities.filter((entity) => PERSON_TYPES.has(entity.type)).length;
  const institutionCount = entities.length - personCount;
  return (
    <div className="space-y-8">
      <Surface className="overflow-hidden bg-slate-950 text-white dark:bg-black">
        <div className="grid grid-cols-1 gap-8 px-6 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:px-10 xl:py-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-indigo-300 uppercase">
              <Briefcase className="h-4 w-4" /> Start with the people
            </div>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Follow a life. Then follow the money.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Subpoena brings biography, political giving, institutional ties, and source records into one canonical
              profile so the full story stays in view.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="min-w-28 rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">Featured people</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{personCount}</dd>
            </div>
            <div className="min-w-28 rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Featured institutions
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{institutionCount}</dd>
            </div>
          </dl>
        </div>
      </Surface>

      {DISCOVERY_SECTIONS.map((section) => {
        const sectionEntities = entities.filter((entity) => section.types.has(entity.type)).slice(0, section.limit);
        if (sectionEntities.length === 0) return null;
        return (
          <section key={section.key} aria-labelledby={`subpoena-${section.key}`}>
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-indigo-600 uppercase dark:text-indigo-400">
                  {section.eyebrow}
                </p>
                <h2
                  id={`subpoena-${section.key}`}
                  className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white"
                >
                  {section.title}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-500 sm:text-right">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sectionEntities.map((entity) => (
                <DiscoveryCard key={entity.id} entity={entity} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SubpoenaWorkspace({ featuredEntities, initialQuery }: Props) {
  // Search lives in the Subpoena tool bar (a GET form to this page's ?q=).
  return (
    <div className="space-y-6">
      <Surface className="p-4 sm:p-5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
            {initialQuery ? `Results for “${initialQuery}”` : "People to explore"}
          </span>
          {(initialQuery ? featuredEntities : featuredEntities.slice(0, 10)).map((entity) => (
            <Link
              key={entity.id}
              href={publicEntityPath(entity)}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              {entity.name}
              <span className="ml-1.5 font-normal opacity-60">{typeLabels[entity.type] ?? entity.type}</span>
            </Link>
          ))}
          {featuredEntities.length === 0 ? (
            <span className="text-sm text-slate-500">No people or organizations matched “{initialQuery}”.</span>
          ) : null}
        </div>
      </Surface>

      {featuredEntities.length || !initialQuery ? (
        <SubpoenaDiscovery entities={featuredEntities} />
      ) : (
        <Surface className="px-6 py-16 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
          <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">No profile found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Try a different spelling, surname, organization, or political role.
          </p>
        </Surface>
      )}
    </div>
  );
}
