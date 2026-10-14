import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isStructuralEdge } from "@/lib/graph/scope";
import { publicEntityPath } from "@/lib/people/public";
import { relationshipCategoryColors, relationshipCategoryOf, relationshipTypeBySlug } from "@/lib/relationships";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

// A profile's relationships, grouped by what the tie is and read from the
// subject's side ("Appointed · 23", "Appointed by"). Real ties come first;
// seats, committees and party cards follow under their own heading.

export interface EdgeSource {
  title: string;
  url?: string;
}

interface Group {
  key: string;
  heading: string;
  color: string;
  structural: boolean;
  rows: { edge: Edge; other: Entity }[];
}

const VISIBLE_ROWS = 8;
const today = () => new Date().toISOString().slice(0, 10);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function groupEdges(subjectId: string, edges: Edge[], byId: Map<string, Entity>): Group[] {
  const groups = new Map<string, Group>();
  for (const edge of edges) {
    const outgoing = edge.sourceEntityId === subjectId;
    const other = byId.get(outgoing ? edge.targetEntityId : edge.sourceEntityId);
    if (!other || other.id === subjectId) continue;
    const type = relationshipTypeBySlug[edge.relType ?? ""];
    const phrase = type ? (outgoing || !type.directed ? type.verb : type.inverse) : edge.label;
    const key = type ? `${type.slug}:${outgoing || !type.directed ? "out" : "in"}` : `label:${edge.label}`;
    const category = relationshipCategoryOf(edge.relType ?? "");
    const group = groups.get(key) ?? {
      key,
      heading: capitalize(phrase || "Related to"),
      color: category ? relationshipCategoryColors[category] : "#94A3B8",
      structural: isStructuralEdge(edge),
      rows: [],
    };
    group.rows.push({ edge, other });
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    // Current ties before former ones, then alphabetical.
    group.rows.sort(
      (a, b) =>
        Number(isFormer(a.edge)) - Number(isFormer(b.edge)) || a.other.name.localeCompare(b.other.name),
    );
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.heading.localeCompare(b.heading));
}

function isFormer(edge: Edge): boolean {
  return Boolean(edge.validTo && edge.validTo < today());
}

function Row({ edge, other, source }: { edge: Edge; other: Entity; source?: EdgeSource }) {
  const dates = edge.validFrom || edge.validTo ? `${edge.validFrom || "?"} – ${edge.validTo || "present"}` : null;
  return (
    <li className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <Link href={publicEntityPath(other)} className="font-medium hover:underline">
          {other.name}
        </Link>
        {edge.role && edge.role !== other.name ? <span className="text-sm text-slate-500"> · {edge.role}</span> : null}
        {isFormer(edge) ? <span className="text-sm text-slate-400"> · former</span> : null}
      </div>
      <div className="flex shrink-0 gap-3 text-xs text-slate-400">
        {dates ? <span className="tabular-nums">{dates}</span> : null}
        {source?.url ? (
          <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-slate-700 hover:underline dark:hover:text-slate-200">
            {source.title || "Source"} <ExternalLink className="h-3 w-3" />
          </a>
        ) : source ? (
          <span>{source.title}</span>
        ) : null}
      </div>
    </li>
  );
}

function GroupBlock({ group, sources }: { group: Group; sources: Map<string, EdgeSource> }) {
  const sourceOf = (edge: Edge) => (edge.sourceRecordId ? sources.get(edge.sourceRecordId) : undefined);
  const shown = group.rows.slice(0, VISIBLE_ROWS);
  const rest = group.rows.slice(VISIBLE_ROWS);
  return (
    <div className="py-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: group.color }} />
        {group.heading}
        <span className="font-normal text-slate-400 tabular-nums">{group.rows.length.toLocaleString("en-US")}</span>
      </h3>
      <ul className="mt-1 divide-y divide-slate-100 pl-4 dark:divide-slate-800/70">
        {shown.map(({ edge, other }) => (
          <Row key={edge.id} edge={edge} other={other} source={sourceOf(edge)} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="group pl-4">
          <summary className="cursor-pointer list-none py-2 text-sm font-medium text-slate-500 hover:text-slate-900 group-open:hidden dark:hover:text-white">
            Show {rest.length.toLocaleString("en-US")} more
          </summary>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {rest.map(({ edge, other }) => (
              <Row key={edge.id} edge={edge} other={other} source={sourceOf(edge)} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function RelationshipGroups({
  subjectId,
  edges,
  entitiesById,
  sources,
}: {
  subjectId: string;
  edges: Edge[];
  entitiesById: Map<string, Entity>;
  sources: Map<string, EdgeSource>;
}) {
  const groups = groupEdges(subjectId, edges, entitiesById);
  const ties = groups.filter((g) => !g.structural);
  const seats = groups.filter((g) => g.structural);

  return (
    <div className="space-y-6">
      {ties.length > 0 ? (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-5 dark:divide-slate-800 dark:border-slate-800">
          {ties.map((group) => (
            <GroupBlock key={group.key} group={group} sources={sources} />
          ))}
        </div>
      ) : null}
      {seats.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Seats, committees and party</h3>
          <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-5 dark:divide-slate-800 dark:border-slate-800">
            {seats.map((group) => (
              <GroupBlock key={group.key} group={group} sources={sources} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
