import type { Metadata } from "next";
import Link from "next/link";
import { ModuleCard, NotVerbatim } from "@/components/people/profile/module-card";
import { AttributesPanel } from "@/components/people/profile/reference-panel";
import { getEntityByPublicSlug } from "@/lib/db/entities";
import { loadProfileBundle } from "@/lib/db/profile-records";
import { editorialProfile } from "@/lib/people/profile";
import { History, Users, Vote } from "lucide-react";
import { listCandidaciesForEntity } from "@/lib/db/candidacies";
import { profileEvents, tabHref } from "@/lib/people/profile-modules";
import { dateValue, formatUsd, formatUsdShort, givingEvents, quoteDate, spanLabel, summarizeGiving } from "@/lib/people/profile-model";
import { loadProfileRoute } from "@/lib/people/profile-route";
import { attributeGroups, directTies, nameOf, possessive } from "@/lib/people/profile-view";
import { publicEntityPath } from "@/lib/people/public";
import { recipientKindLabels } from "@/lib/money/recipient-kinds";

export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
}

type ProfilePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityByPublicSlug(slug);
  if (!entity) return { title: "Profile not found | Worldview" };
  const bundle = await loadProfileBundle(entity);
  return {
    title: `${entity.name} | Worldview`,
    description:
      bundle.editorial?.summary || editorialProfile(entity)?.dek || entity.description || `Profile and documented relationships for ${entity.name}.`,
    alternates: { canonical: publicEntityPath(entity) },
  };
}

export default async function ProfileOverviewPage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const { bundle, base, tabs } = await loadProfileRoute(slug, "overview");
  const { entity, editorial, legacy } = bundle;
  const giving = summarizeGiving(bundle.given);
  const ties = directTies(bundle).slice(0, 8);
  const names = new Map([...bundle.entities.values()].map((e) => [e.id, e.name]));
  // Defining events, plus gifts of $5 million or more built from the FEC rows.
  const keyDates = [
    ...profileEvents(bundle).filter((e) => e.significance === 3 || e.derivedFrom === "highlights"),
    ...givingEvents(bundle.given, names, entity.id, { min: 5_000_000 }),
  ]
    .sort((a, b) => dateValue(a.dateStart) - dateValue(b.dateStart))
    .slice(0, 10);
  const quotes = bundle.statements.filter((s) => s.quote);
  const featured = editorial?.ideas.featuredQuotes ?? [];
  const previewQuotes = [
    ...featured.flatMap((k) => quotes.find((q) => q.key === k) ?? []),
    ...quotes.filter((q) => !featured.includes(q.key)),
  ].slice(0, 2);
  const candidacies = entity.type === "politician" ? await listCandidaciesForEntity(entity.id).catch(() => []) : [];
  const chapters = editorial?.chapters ?? [];
  const peakCycle = Math.max(1, ...giving.byCycle.map((c) => c.total));
  // Net worth already sits in the hero's key-facts strip.
  const facts = attributeGroups(bundle, ["net-worth"]);
  let card = 0;
  const empty = !tabs.has("biography") && !tabs.has("money") && !ties.length && !keyDates.length && !candidacies.length && !facts.length;

  return (
    <div className={`grid grid-cols-1 gap-6 ${facts.length ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
      <div className="grid min-w-0 grid-cols-1 content-start gap-6 md:grid-cols-2">
        {tabs.has("biography") ? (
          <ModuleCard tab="biography" title="Biography" href={tabHref(base, "biography")} cta="Read the biography" index={card++} className="md:col-span-2">
            {chapters.length ? (
              <ol className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {chapters.map((chapter, i) => (
                  <li key={chapter.key} className="flex gap-3">
                    <span className="w-5 shrink-0 pt-0.5 text-right text-sm font-semibold text-slate-400 tabular-nums">{i + 1}</span>
                    <Link href={`${tabHref(base, "biography")}#${chapter.key}`} className="group min-w-0">
                      <span className="font-medium text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">
                        {chapter.title}
                      </span>
                      {chapter.dek ? <span className="block text-sm leading-5 text-slate-500 dark:text-slate-400">{chapter.dek}</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="line-clamp-4 max-w-[68ch] leading-7 text-slate-700 dark:text-slate-300">
                {legacy?.sections[0]?.body ?? entity.biography}
              </p>
            )}
          </ModuleCard>
        ) : null}

        {giving.count ? (
          <ModuleCard tab="money" title="Political money" href={tabHref(base, "money")} cta="Analyze contributions" index={card++}>
            <p className="text-3xl font-semibold text-slate-950 tabular-nums dark:text-white">{formatUsd(giving.total)}</p>
            <p className="text-sm text-slate-500">
              {giving.count} itemized federal contributions, {giving.first.slice(0, 4)}–{giving.last.slice(0, 4)}
            </p>
            <div className="mt-4 flex h-16 items-end gap-0.5" role="img" aria-label="Contributions by election cycle">
              {giving.byCycle.map((c, i) => (
                <span
                  key={c.cycle}
                  title={`${c.cycle}: ${formatUsd(c.total, { compact: false })}`}
                  className="wv-grow-y min-w-0 flex-1 rounded-t-[3px] bg-(--viz-series-1)"
                  style={{ height: `${Math.max(3, (c.total / peakCycle) * 100)}%`, "--i": i } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
              <span>{giving.byCycle[0]?.cycle}</span>
              <span>{giving.byCycle.at(-1)?.cycle}</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {giving.byRecipient.slice(0, 3).map((r) => (
                <li key={r.entityId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                    {nameOf(bundle, r.entityId)}
                    <span className="text-slate-400"> · {recipientKindLabels[r.kind].replace(/s$/, "")}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatUsdShort(r.total)}</span>
                </li>
              ))}
            </ul>
          </ModuleCard>
        ) : tabs.has("money") ? (
          <ModuleCard tab="money" title="Political money" href={tabHref(base, "money")} cta="See contributions" index={card++}>
            <p className="text-slate-700 dark:text-slate-300">
              {bundle.received.raised.map((r) => `${formatUsd(r.total)} received in ${r.count} recorded contributions`).join("; ")}
            </p>
          </ModuleCard>
        ) : null}

        {ties.length ? (
          <ModuleCard icon={Users} title="Key relationships" index={card++}>
            <ul className="space-y-2.5">
              {ties.map((tie) => {
                const other = bundle.entities.get(tie.otherId);
                return (
                  <li key={tie.edge.id} className="text-sm leading-5">
                    <span className="text-slate-500 dark:text-slate-400">{tie.verb} </span>
                    {other ? (
                      <Link href={other.href} className="font-medium text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300">
                        {other.name}
                      </Link>
                    ) : null}
                    {spanLabel(tie.edge.validFrom, tie.edge.validTo) ? (
                      <span className="text-slate-400"> · {spanLabel(tie.edge.validFrom, tie.edge.validTo)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ModuleCard>
        ) : null}

        {previewQuotes.length ? (
          <ModuleCard tab="quotes" title={possessive(bundle) ? `In ${possessive(bundle)} words` : "Notable quotes"} href={tabHref(base, "quotes")} cta={`All ${quotes.length} quotes`} index={card++} className="md:col-span-2">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {previewQuotes.map((q) => (
                <figure key={q.id}>
                  <blockquote className="border-l-2 border-indigo-300 pl-3 font-serif text-lg leading-7 text-slate-800 dark:border-indigo-700 dark:text-slate-200">
                    &ldquo;{q.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-1.5 pl-3 text-sm text-slate-500">
                    {q.venue}, {quoteDate(q)}
                    {q.verbatim ? null : (
                      <>
                        {" "}
                        <NotVerbatim />
                      </>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </ModuleCard>
        ) : null}

        {keyDates.length ? (
          <ModuleCard icon={History} title="Key dates" index={card++} className="md:col-span-2">
            <ol className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {keyDates.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm leading-5">
                  <span className="w-10 shrink-0 font-semibold text-slate-900 tabular-nums dark:text-slate-100">{e.dateStart.slice(0, 4)}</span>
                  <span className="text-slate-700 dark:text-slate-300">{e.title}</span>
                </li>
              ))}
            </ol>
          </ModuleCard>
        ) : null}

        {candidacies.length || entity.bioguideId ? (
          <ModuleCard
            icon={Vote}
            title="Elections and legislative record"
            href={entity.bioguideId ? `/legislation/members/${entity.id}` : undefined}
            cta={entity.bioguideId ? "Bills, votes and committees" : undefined}
            index={card++}
          >
            {candidacies.length ? (
              <ol className="space-y-2 text-sm">
                {candidacies.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/elections/${c.election.id}`} className="min-w-0 font-medium hover:text-indigo-700 dark:hover:text-indigo-300">
                      {c.election.name}
                    </Link>
                    <span className={`shrink-0 font-semibold ${c.won ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
                      {c.won ? "Won" : c.withdrew ? "Withdrew" : c.election.status === "certified" ? "Lost" : "Ran"}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">Sponsored bills, roll-call votes and committee seats.</p>
            )}
          </ModuleCard>
        ) : null}

        {empty ? (
          <p className="text-slate-600 md:col-span-2 dark:text-slate-400">No biography, relationships or contribution records are on file yet.</p>
        ) : null}
      </div>

      {facts.length ? (
        <aside>
          <AttributesPanel groups={facts} updated={bundle.freshness.editorialReviewedAt} />
        </aside>
      ) : null}
    </div>
  );
}
