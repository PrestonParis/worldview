import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PeopleSearch } from "./people-search";
import { CongressAtlas } from "@/components/people/congress-atlas";
import { MovementLandscape, type LandscapeItem } from "@/components/people/movement-landscape";
import { FeaturedNetworks, type FeaturedNetwork } from "@/components/people/featured-networks";
import { roleGroups, publicEntityPath } from "@/lib/people/public";
import { familyOf, leanOf } from "@/lib/graph/lean";
import { degreeById, withoutStructuralEdges } from "@/lib/graph/scope";
import { buildEgoPreview } from "@/lib/people/ego-preview";
import { FAMILY_FILL, FAMILY_LABEL } from "@/lib/people/family-colors";
import { relationshipCategoryColors } from "@/lib/relationships";
import type { CongressAtlas as CongressAtlasData } from "@/lib/people/atlas";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

const LANDSCAPE_TYPES = new Set(["pundit", "journalist", "organization"]);
const PERSON_TYPES = new Set(["politician", "pundit", "journalist"]);

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">{eyebrow}</p>
      <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
      {children ? <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{children}</p> : null}
    </div>
  );
}

export function PeopleExplore({
  entities,
  edges,
  atlas,
}: {
  entities: Entity[];
  edges: Edge[];
  atlas: CongressAtlasData | null;
}) {
  const searchItems = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    href: publicEntityPath(entity),
  }));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  const landscape: LandscapeItem[] = entities
    .filter((entity) => LANDSCAPE_TYPES.has(entity.type))
    .map((entity): LandscapeItem => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      href: publicEntityPath(entity),
      side: leanOf(entity) ?? "unplaced",
      blurb: (entity.description ?? "").slice(0, 160),
    }))
    .filter((item) => item.type !== "organization" || item.side !== "unplaced");

  // Networks worth opening: people with the most direct (non-institutional)
  // ties, one strong example from each family plus the busiest overall.
  const directDegree = degreeById(withoutStructuralEdges(edges));
  const people = entities
    .filter((entity) => PERSON_TYPES.has(entity.type) && (directDegree[entity.id] ?? 0) >= 4)
    .sort((a, b) => (directDegree[b.id] ?? 0) - (directDegree[a.id] ?? 0));
  const networks: FeaturedNetwork[] = [
    ...people.slice(0, 1),
    ...people.filter((p) => familyOf(p) === "liberal").slice(0, 3),
    ...people.filter((p) => familyOf(p) === "conservative").slice(0, 3),
    ...entities
      .filter((e) => e.type === "organization" && (directDegree[e.id] ?? 0) >= 4)
      .sort((a, b) => (directDegree[b.id] ?? 0) - (directDegree[a.id] ?? 0))
      .slice(0, 2),
  ]
    .filter((entity, i, list) => list.findIndex((e) => e.id === entity.id) === i)
    .map((entity) => ({ id: entity.id, name: entity.name, fill: FAMILY_FILL[familyOf(entity)], preview: buildEgoPreview(entity, byId, edges) }))
    .filter((network) => network.preview.nodes.length > 0);

  return (
    <div className="space-y-16 pb-10">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-blue-700 uppercase dark:text-blue-300">People &amp; Power</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
          The people, institutions and networks of American politics
        </h1>
        <div className="mt-6 text-left">
          <PeopleSearch entities={searchItems} large />
        </div>
        <nav aria-label="Browse" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {roleGroups.map((group) => (
            <Link key={group.key} href={`/people/directory?group=${group.key}`} className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
              {group.label}
            </Link>
          ))}
          <Link href="/people/administration" className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
            The administration
          </Link>
        </nav>
      </header>

      {atlas ? (
        <section>
          <SectionHeading eyebrow={`${atlas.congress}th Congress`} title="Congress, by how members vote">
            Each dot is a member, placed by their Voteview DW-NOMINATE score: a left–right position computed from
            every roll-call vote they cast, not from their party label. Hover for a member, click for their profile.
          </SectionHeading>
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
            <CongressAtlas congress={atlas.congress} members={atlas.members} />
          </div>
        </section>
      ) : null}

      <FeaturedNetworks
        networks={networks}
        intro={
          <>
            <SectionHeading eyebrow="Networks" title="Follow the connections">
              Every line is a documented relationship: who hired, appointed, funded, hosts or founded whom. Open any
              network to inspect each tie and its source.
            </SectionHeading>
            <ul className="mt-5 space-y-2 text-sm">
              {(["liberal", "conservative", "unplaced", "institution"] as const).map((family) => (
                <li key={family} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="h-3 w-3 rounded-full" style={{ background: FAMILY_FILL[family] }} />
                  {FAMILY_LABEL[family]}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {Object.entries(relationshipCategoryColors)
                .filter(([cat]) => cat !== "institutional")
                .map(([cat, color]) => (
                  <span key={cat} className="inline-flex items-center gap-1.5 capitalize">
                    <span className="h-0.5 w-4 rounded" style={{ background: color }} />
                    {cat}
                  </span>
                ))}
            </p>
          </>
        }
      />

      <section>
        <SectionHeading eyebrow="Media and movement" title="Who shapes the conversation">
          Commentators, journalists and organizations, grouped by the side of politics they work on. People whose work
          doesn&rsquo;t sit on one side, such as straight-news reporters, stay unplaced.
        </SectionHeading>
        <div className="mt-6">
          <MovementLandscape items={landscape} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 px-6 py-6 text-white sm:px-8 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-semibold">Browse everyone</h2>
          <p className="mt-1 text-sm text-slate-300">Filter and sort all {entities.length.toLocaleString("en-US")} people and organizations.</p>
        </div>
        <Link href="/people/directory" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">
          Open the directory <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
