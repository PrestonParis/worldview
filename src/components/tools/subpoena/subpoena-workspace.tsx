"use client";

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import type { Entity } from "@/lib/validation/entity";
import type { SubpoenaDirectory } from "@/lib/db/subpoena";
import { Surface } from "@/components/ui/surface";
import { entityRole, parseEntityMetadata, publicEntityPath } from "@/lib/people/public";
import { initials } from "@/lib/format";

interface Props {
  directory: SubpoenaDirectory;
  initialQuery: string;
}

const DISCOVERY_SECTIONS = [
  {
    key: "influence",
    eyebrow: "Money and influence",
    title: "The people financing political power",
    description: "Major donors, business leaders, and operators whose money or networks shape campaigns and policy.",
    types: new Set(["donor"]),
    limit: 8,
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

function influenceAreas(entity: Entity): string[] {
  const value = parseEntityMetadata(entity.metadata).influenceAreas;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 2)
    : [];
}

function DiscoveryCard({ entity, caseFile }: { entity: Entity; caseFile: boolean }) {
  const areas = influenceAreas(entity);
  return (
    <Link
      href={publicEntityPath(entity)}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-950/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-700"
    >
      <div className="flex items-start justify-between gap-4">
        {entity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imported public profile image
          <img src={entity.imageUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {initials(entity.name)}
          </span>
        )}
        <div className="flex flex-wrap justify-end gap-1.5">
          {caseFile ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-indigo-700 uppercase dark:bg-indigo-950 dark:text-indigo-300">
              Case file
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
            {entityRole(entity)}
          </span>
        </div>
      </div>
      <h3 className="mt-3 text-base font-bold tracking-tight text-slate-950 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
        {entity.name}
      </h3>
      {entity.description || entity.biography ? (
        <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {entity.description || entity.biography}
        </p>
      ) : null}
      {areas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
      <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
        {caseFile ? "Open case file" : "Open profile"} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function SectionHeader({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold tracking-[0.14em] text-indigo-600 uppercase dark:text-indigo-400">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>
      </div>
      {description ? <p className="max-w-xl text-sm leading-6 text-slate-500 sm:text-right">{description}</p> : null}
    </div>
  );
}

function CardGrid({ entities, dossierIds }: { entities: Entity[]; dossierIds: Set<string> }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entities.map((entity) => (
        <DiscoveryCard key={entity.id} entity={entity} caseFile={dossierIds.has(entity.id)} />
      ))}
    </div>
  );
}

function SubpoenaDiscovery({ caseFiles, entities }: { caseFiles: Entity[]; entities: Entity[] }) {
  const none = new Set<string>();
  return (
    <div className="space-y-12">
      {caseFiles.length > 0 ? (
        <section aria-labelledby="subpoena-case-files">
          <SectionHeader
            id="subpoena-case-files"
            eyebrow="Case files"
            title="Full dossiers"
            description="Sourced biographies with relationships, chronology, political money and quotes in one record."
          />
          <CardGrid entities={caseFiles} dossierIds={new Set(caseFiles.map((entity) => entity.id))} />
        </section>
      ) : null}

      {DISCOVERY_SECTIONS.map((section) => {
        const sectionEntities = entities.filter((entity) => section.types.has(entity.type)).slice(0, section.limit);
        if (sectionEntities.length === 0) return null;
        return (
          <section key={section.key} aria-labelledby={`subpoena-${section.key}`}>
            <SectionHeader
              id={`subpoena-${section.key}`}
              eyebrow={section.eyebrow}
              title={section.title}
              description={section.description}
            />
            <CardGrid entities={sectionEntities} dossierIds={none} />
          </section>
        );
      })}
    </div>
  );
}

export function SubpoenaWorkspace({ directory, initialQuery }: Props) {
  // Search lives in the Subpoena tool bar (a GET form to this page's ?q=).
  const { caseFiles, entities, dossierIds } = directory;
  if (!initialQuery) return <SubpoenaDiscovery caseFiles={caseFiles} entities={entities} />;

  if (entities.length === 0) {
    return (
      <Surface className="px-6 py-16 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
        <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">No profile found</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Nothing matched “{initialQuery}”. Try a different spelling, surname, organization, or political role.
        </p>
      </Surface>
    );
  }

  return (
    <section aria-labelledby="subpoena-results">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="subpoena-results" className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {entities.length === 1 ? "1 result" : `${entities.length} results`} for “{initialQuery}”
        </h2>
        <Link href="/subpoena" className="shrink-0 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Clear search
        </Link>
      </div>
      <CardGrid entities={entities} dossierIds={new Set(dossierIds)} />
    </section>
  );
}
