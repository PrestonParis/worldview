import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked } from "lucide-react";
import { NotVerbatim, SectionHeading } from "@/components/people/profile/module-card";
import { atlasTraditionHref } from "@/lib/atlas/tradition-link";
import { getEntityByPublicSlug } from "@/lib/db/entities";
import { quoteDate, type StatementRecord } from "@/lib/people/profile-model";
import { loadProfileRoute } from "@/lib/people/profile-route";

export const revalidate = 604800;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entity = await getEntityByPublicSlug((await params).slug);
  return { title: entity ? `${entity.name}: quotes | Worldview` : "Profile not found | Worldview" };
}

// Verbatim quotations only, grouped by topic in date order, each with where
// and when it was said and the source it was checked against.
export default async function QuotesPage({ params }: Props) {
  const { slug } = await params;
  const { bundle } = await loadProfileRoute(slug, "quotes");
  const ideas = bundle.editorial?.ideas;
  const quotes = bundle.statements.filter((s) => s.quote);
  const groups = new Map<string, StatementRecord[]>();
  for (const q of [...quotes].sort((a, b) => a.date.localeCompare(b.date))) groups.set(q.issue, [...(groups.get(q.issue) ?? []), q]);

  return (
    <div className="space-y-12">
      <div>
        <SectionHeading tab="quotes" title="Notable quotes" />
        {ideas?.traditions.length ? (
          <p className="-mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Traditions:</span>
            {ideas.traditions.map((t) => {
              const href = atlasTraditionHref(t.atlasId);
              const chip = "rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200";
              return href ? (
                <Link key={t.label} href={href} title={t.context} className={`${chip} hover:bg-indigo-100 dark:hover:bg-indigo-900`}>
                  {t.label} <span className="font-normal text-indigo-600/80 dark:text-indigo-300/70">· {t.basis}</span>
                </Link>
              ) : (
                <span key={t.label} className={chip}>
                  {t.label}
                </span>
              );
            })}
          </p>
        ) : null}
      </div>

      {[...groups.entries()].map(([issue, list]) => (
        <section key={issue} aria-labelledby={`issue-${issue}`}>
          <h3 id={`issue-${issue}`} className="text-lg font-semibold text-slate-950 dark:text-white">
            {issue}
          </h3>
          <ol className="mt-4 max-w-[72ch] space-y-8">
            {list.map((q, i) => {
              const source = bundle.sources.get(q.sourceId);
              return (
                <li key={q.id} id={q.key || undefined} className="wv-rise scroll-mt-32" style={{ "--i": Math.min(i, 6) } as React.CSSProperties}>
                  {q.verbatim ? null : (
                    <p className="mb-1.5 pl-5">
                      <NotVerbatim />
                    </p>
                  )}
                  <blockquote
                    className={`border-l-[3px] pl-5 font-serif text-xl leading-8 text-slate-900 dark:text-slate-100 ${
                      q.verbatim ? "border-indigo-400 dark:border-indigo-500" : "border-dashed border-amber-400 dark:border-amber-500"
                    }`}
                  >
                    &ldquo;{q.quote}&rdquo;
                  </blockquote>
                  <div className="mt-2 pl-5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    <p>
                      {source?.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer" className="underline decoration-slate-300 underline-offset-2 hover:text-indigo-700 dark:decoration-slate-600 dark:hover:text-indigo-300">
                          {q.venue}
                        </a>
                      ) : (
                        q.venue
                      )}
                      , {quoteDate(q)}
                      {!source?.url && source ? ` · ${source.documentId || source.publisher}` : ""}
                    </p>
                    {q.summary ? <p className="mt-1 text-slate-700 dark:text-slate-300">{q.summary}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {ideas?.works.length ? (
        <section aria-labelledby="works-heading" className="max-w-[72ch] border-t border-slate-200 pt-8 dark:border-slate-800">
          <h3 id="works-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
            Writings
          </h3>
          <ol className="mt-4 space-y-3">
            {ideas.works.map((w) => {
              const sourceId = bundle.sourceIdByKey.get(w.source);
              const source = sourceId ? bundle.sources.get(sourceId) : undefined;
              return (
                <li key={w.title} className="flex gap-3">
                  <BookMarked aria-hidden className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    {source?.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-indigo-700 dark:text-slate-100">
                        {w.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-900 dark:text-slate-100">{w.title}</span>
                    )}
                    <p className="text-sm text-slate-500">
                      {w.kind} · {w.year}
                      {w.detail ? ` · ${w.detail}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
