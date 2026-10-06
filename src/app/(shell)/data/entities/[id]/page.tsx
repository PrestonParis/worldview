import Link from "next/link";
import { ContributorOnly } from "@/components/auth/can-edit";
import { notFound } from "next/navigation";
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  ExternalLink,
  Globe2,
  MessageCircle,
  Pencil,
  Play,
  Users,
} from "lucide-react";
import { getEntity, listEntities } from "@/lib/neo4j/entities";
import { listEdgesForEntity } from "@/lib/neo4j/edges";
import { getEntityContributionSummary } from "@/lib/db/contributions";
import { listLobbyingForEntity } from "@/lib/db/lobbying";
import { parseHighlights } from "@/lib/validation/entity";
import { entityColorFor } from "@/lib/entity-colors";
import { isDonorEdge, individualEntityTypes } from "@/lib/money";
import { EntityMoneySummary } from "@/components/money/entity-money-summary";
import { EntityLobbying } from "@/components/money/entity-lobbying";
import { buttonVariants } from "@/components/ui/button";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";
}

function metadataOf(raw?: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export default async function EntityProfilePage({
  params,
}: PageProps<"/data/entities/[id]">) {
  const { id } = await params;
  const [entity, entities, connections, moneySummary, lobbying] = await Promise.all([
    getEntity(id),
    listEntities(),
    listEdgesForEntity(id),
    getEntityContributionSummary(id),
    listLobbyingForEntity(id),
  ]);
  if (!entity) notFound();

  const hasStructuredMoney =
    moneySummary.raised.length > 0 || moneySummary.given.length > 0;

  const colors = entityColorFor(entity.type);
  const highlights = parseHighlights(entity.highlights);
  const metadata = metadataOf(entity.metadata);
  const entitiesById = new Map(entities.map((item) => [item.id, item]));
  const donors = connections.filter((edge) => isDonorEdge(edge));
  const relationships = connections.filter((edge) => !isDonorEdge(edge));
  const isPerson = individualEntityTypes.has(entity.type);
  const socialLinks = [
    { label: "Website", href: entity.websiteUrl || String(metadata.website || ""), icon: Globe2 },
    { label: "X / Twitter", href: entity.xUrl, icon: AtSign },
    { label: "Facebook", href: entity.facebookUrl, icon: MessageCircle },
    { label: "Instagram", href: entity.instagramUrl, icon: Camera },
    { label: "YouTube", href: entity.youtubeUrl, icon: Play },
    { label: "LinkedIn", href: entity.linkedinUrl, icon: BriefcaseBusiness },
  ].filter((link) => link.href);
  const facts = [
    ["Office", metadata.office],
    ["Party", metadata.party],
    ["State", metadata.state],
    ["Country", metadata.country],
    ["Born", metadata.born],
    ["Died", metadata.died],
    ["Also known as", Array.isArray(metadata.aliases) ? metadata.aliases.join(", ") : undefined],
  ].filter((fact): fact is [string, string | number] =>
    (typeof fact[1] === "string" && fact[1] !== "") || typeof fact[1] === "number",
  );
  const sources = Array.isArray(metadata.sources)
    ? metadata.sources.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
    : [];

  function relatedEntity(edge: (typeof connections)[number]) {
    const otherId = edge.sourceEntityId === id
      ? edge.targetEntityId
      : edge.sourceEntityId;
    return entitiesById.get(otherId);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div
          className="h-28 opacity-80"
          style={{ background: `linear-gradient(115deg, ${colors.bg}, ${colors.border}55)` }}
        />
        <div className="px-6 pb-7 sm:px-9">
          <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end">
            {entity.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-supplied external profile image
              <img
                src={entity.imageUrl}
                alt={entity.name}
                className="h-28 w-28 shrink-0 rounded-2xl border-4 border-white bg-white object-cover shadow-md dark:border-slate-950 dark:bg-slate-950"
              />
            ) : (
              <div
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-white text-3xl font-semibold shadow-md dark:border-slate-950"
                style={{ background: colors.bg, color: colors.text }}
              >
                {initialsOf(entity.name)}
              </div>
            )}

            <div className="min-w-0 flex-1 pb-1">
              <span
                className="inline-block rounded-full border px-2.5 py-1 text-xs font-semibold capitalize"
                style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
              >
                {entity.type.replaceAll("_", " ")}
              </span>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {entity.name}
              </h1>
              {entity.description ? (
                <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-300">{entity.description}</p>
              ) : null}
            </div>

            <ContributorOnly>
              <Link href={`/data/entities/${entity.id}/edit`} className={buttonVariants.ghost}>
                <Pencil className="mr-2 h-4 w-4" /> Edit profile
              </Link>
            </ContributorOnly>
          </div>

          {socialLinks.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2" aria-label="Social media links">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          ) : isPerson ? (
            <p className="mt-6 text-sm text-slate-400">Social profiles have not been added yet.</p>
          ) : null}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {isPerson ? `About ${entity.name}` : "About"}
            </h2>
            {entity.biography ? (
              <div className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                {entity.biography}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No expanded biography yet.
                <ContributorOnly>
                  {" "}Add background, career history, political significance, and positions in Edit profile.
                </ContributorOnly>
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Donors & funding</h2>
            </div>
            <EntityMoneySummary summary={moneySummary} entitiesById={entitiesById} />

            {donors.length > 0 ? (
              <>
                <h3 className="mt-6 text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Other funding relationships (unverified)
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {donors.map((edge) => {
                    const other = relatedEntity(edge);
                    return (
                      <Link
                        key={edge.id}
                        href={other ? `/data/entities/${other.id}` : "#"}
                        className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-400 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-600"
                      >
                        <p className="font-medium text-slate-900 dark:text-slate-100">{other?.name ?? "Unknown entity"}</p>
                        <p className="mt-1 text-xs capitalize text-slate-500">{edge.label}</p>
                        {edge.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{edge.notes}</p> : null}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}

            {!hasStructuredMoney && donors.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No donor or funding relationships recorded.
              </p>
            ) : null}
          </section>

          <EntityLobbying
            registrations={lobbying}
            entityId={id}
            entitiesById={entitiesById}
          />
        </div>

        <aside className="space-y-6">
          {facts.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">At a glance</h2>
              <dl className="mt-4 space-y-3">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {highlights.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Highlights</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {highlights.map((highlight) => <li key={highlight}>• {highlight}</li>)}
              </ul>
            </section>
          ) : null}

          {sources.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sources</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="break-all text-slate-600 hover:underline dark:text-slate-300">
                      {new URL(url).hostname.replace(/^www\./, "")}
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {relationships.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connections</h2>
              <ul className="mt-3 space-y-3">
                {relationships.slice(0, 8).map((edge) => {
                  const other = relatedEntity(edge);
                  return (
                    <li key={edge.id}>
                      <Link href={other ? `/data/entities/${other.id}` : "#"} className="group text-sm">
                        <span className="font-medium text-slate-800 group-hover:underline dark:text-slate-200">{other?.name ?? "Unknown entity"}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          {edge.label} <ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
