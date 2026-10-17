import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { ContributorOnly } from "@/components/auth/can-edit";
import { EntityMoneySummary } from "@/components/money/entity-money-summary";
import { EntityLobbying } from "@/components/money/entity-lobbying";
import { NetworkPreview } from "@/components/people/network-preview";
import { RelationshipGroups } from "@/components/people/relationship-groups";
import { buttonVariants } from "@/components/ui/button";
import { getEntityContributionSummary } from "@/lib/db/contributions";
import { getSourcesByIds } from "@/lib/db/sources";
import { listLobbyingForEntity } from "@/lib/db/lobbying";
import { entityColorFor } from "@/lib/entity-colors";
import { leanLabels, leanOf } from "@/lib/graph/lean";
import { isDonorEdge } from "@/lib/money";
import { listEdgesForEntity } from "@/lib/db/edges";
import { getEntitiesByIds, getEntityByPublicSlug, getMergedInto } from "@/lib/db/entities";
import { buildEgoPreview } from "@/lib/people/ego-preview";
import { entityPartyAndPlace, parseEntityMetadata, publicEntitySlug, typeLabels } from "@/lib/people/public";
import { parseHighlights } from "@/lib/validation/entity";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

// Nothing prebuilt; each page is rendered on first request, then cached.
export async function generateStaticParams() {
  return [];
}

type ProfilePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityByPublicSlug(slug);
  return entity
    ? { title: `${entity.name} | Worldview`, description: entity.description || `Profile and documented relationships for ${entity.name}.` }
    : { title: "Profile not found | Worldview" };
}

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default async function PublicEntityPage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const entity = await getEntityByPublicSlug(slug);
  if (!entity) {
    const merged = await getMergedInto(slug.match(/-([0-9a-f]{8})$/i)?.[1] ?? "");
    if (merged) permanentRedirect(`/people/${publicEntitySlug(merged)}`);
    notFound();
  }
  const canonical = publicEntitySlug(entity);
  if (slug !== canonical) permanentRedirect(`/people/${canonical}`);

  const [connections, moneySummary, lobbying] = await Promise.all([
    listEdgesForEntity(entity.id), getEntityContributionSummary(entity.id), listLobbyingForEntity(entity.id),
  ]);
  const related = await getEntitiesByIds([
    entity.id,
    ...connections.flatMap((edge) => [edge.sourceEntityId, edge.targetEntityId]),
    ...[...moneySummary.topDonors, ...moneySummary.topRecipients].map((row) => row.entityId),
    ...lobbying.flatMap((row) => [row.clientEntityId, row.registrantEntityId]),
  ]);
  const byId = new Map(related.map((item) => [item.id, item]));
  const metadata = parseEntityMetadata(entity.metadata);
  const { party, place } = entityPartyAndPlace(entity);
  const lean = leanOf(entity);
  const colors = entityColorFor(entity.type);
  const highlights = parseHighlights(entity.highlights);
  const donors = connections.filter(isDonorEdge);
  const relationships = connections.filter((edge) => !isDonorEdge(edge));
  const edgeSources = new Map(
    (await getSourcesByIds(relationships.map((edge) => edge.sourceRecordId ?? "")).catch(() => []))
      .map((source) => [source.id, { title: source.title, url: source.url || undefined }]),
  );
  const preview = buildEgoPreview(entity, byId, relationships);
  const sources = Array.isArray(metadata.sources)
    ? metadata.sources.filter((value): value is string => typeof value === "string" && /^https?:\/\//.test(value))
    : [];
  const facts = [
    ["Role", typeLabels[entity.type] ?? entity.type], ["Office", metadata.office], ["Party", party], ["Place", place],
    ["Broad political family", lean ? leanLabels[lean] : "Not classified"],
  ].filter((item): item is [string, string] => typeof item[1] === "string" && item[1].length > 0);

  return (
    <article className="mx-auto max-w-6xl pb-12">
      <Link href="/people" className="text-sm font-medium text-slate-500 hover:text-slate-950 dark:hover:text-white">← People &amp; Power</Link>
      <header className="mt-5 border-b border-slate-200 pb-9 dark:border-slate-800">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          {entity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imported public profile image
            <img src={entity.imageUrl} alt={entity.name} className="h-32 w-32 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-2xl text-3xl font-semibold" style={{ background: colors.bg, color: colors.text }}>{initials(entity.name)}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: colors.text }}>{typeLabels[entity.type] ?? entity.type}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{entity.name}</h1>
            <p className="mt-3 max-w-3xl text-lg leading-7 text-slate-600 dark:text-slate-300">{entity.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">{lean ? `Broad family: ${leanLabels[lean]}` : "Ideology not classified"}</span>
              {party ? <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">{party}</span> : null}
              {place ? <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">{place}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <ContributorOnly><Link href={`/data/entities/${entity.id}/edit`} className={buttonVariants.ghost}><Pencil className="mr-2 h-4 w-4" />Edit</Link></ContributorOnly>
          </div>
        </div>
      </header>

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold">Background</h2>
            {entity.biography ? <p className="mt-4 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-300">{entity.biography}</p> : <p className="mt-4 text-sm text-slate-500">A sourced long-form biography has not been added yet.</p>}
          </section>

          {relationships.length > 0 ? (
            <section id="relationships" className="scroll-mt-24">
              <h2 className="text-xl font-semibold">Organizations and relationships</h2>
              {preview.nodes.length >= 3 ? <div className="mt-4"><NetworkPreview preview={preview} /></div> : null}
              <div className="mt-4">
                <RelationshipGroups subjectId={entity.id} edges={relationships} entitiesById={byId} sources={edgeSources} />
              </div>
            </section>
          ) : null}

          <section><h2 className="text-xl font-semibold">Money and political activity</h2><div className="mt-4"><EntityMoneySummary summary={moneySummary} entitiesById={byId} /></div>{donors.length === 0 && moneySummary.raised.length === 0 && moneySummary.given.length === 0 ? <p className="mt-3 text-sm text-slate-500">No campaign-finance relationship is attached to this profile.</p> : null}</section>
          <EntityLobbying registrations={lobbying} entityId={entity.id} entitiesById={byId} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><h2 className="text-sm font-semibold">At a glance</h2><dl className="mt-4 space-y-3">{facts.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl></section>
          {highlights.length > 0 ? <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><h2 className="text-sm font-semibold">Highlights</h2><ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">{highlights.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Sources and method</h2>
            <p className="mt-3 text-xs leading-5 text-slate-500">Relationship dates and sources appear where Worldview has them recorded; nothing is inferred.</p>
            {sources.length > 0 ? <ul className="mt-4 space-y-2 text-sm">{sources.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="break-all hover:underline">{new URL(url).hostname.replace(/^www\./, "")} <ExternalLink className="inline h-3 w-3" /></a></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No profile-level sources attached.</p>}
          </section>
        </aside>
      </div>
    </article>
  );
}
