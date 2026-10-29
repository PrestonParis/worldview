import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { ChapterToc } from "@/components/people/profile/chapter-toc";
import { SectionHeading } from "@/components/people/profile/module-card";
import { SourceLine } from "@/components/people/profile/source-line";
import { getEntityByPublicSlug } from "@/lib/db/entities";
import { chapterCitations, formatPartialDate, parseChapterBody, type Block, type SourceRecord } from "@/lib/people/profile-model";
import { loadProfileRoute } from "@/lib/people/profile-route";
import { sourcesByKey } from "@/lib/people/profile-view";

export const revalidate = 604800;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entity = await getEntityByPublicSlug((await params).slug);
  return { title: entity ? `${entity.name}: biography | Worldview` : "Profile not found | Worldview" };
}

// Chapter text without its citation markers; the sources follow the chapter.
function plainText(block: Block): string {
  return block.segments
    .map((seg) => ("text" in seg ? seg.text : ""))
    .join("")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export default async function BiographyPage({ params }: Props) {
  const { slug } = await params;
  const { bundle } = await loadProfileRoute(slug, "biography");
  const chapters = bundle.editorial?.chapters ?? [];
  if (!chapters.length) return <LegacyBiography bundle={bundle} />;

  const byKey = sourcesByKey(bundle);
  const repeatsOf = (s: SourceRecord) => (s.repeatsKey ? (byKey.get(s.repeatsKey) ?? null) : null);
  const all = [...bundle.sources.values()].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] xl:gap-14">
      <div className="min-w-0">
        <SectionHeading tab="biography" title="Biography" />
        <div className="max-w-[68ch] space-y-14">
          {chapters.map((chapter, i) => {
            const sources = chapterCitations(chapter.body).flatMap((k) => byKey.get(k) ?? []);
            return (
              <section key={chapter.key} id={chapter.key} className="scroll-mt-32">
                <p className="text-sm font-semibold text-indigo-700 tabular-nums dark:text-indigo-300">Chapter {i + 1}</p>
                <h3 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{chapter.title}</h3>
                {chapter.dek ? <p className="mt-1 text-lg leading-7 text-slate-500 dark:text-slate-400">{chapter.dek}</p> : null}
                <div className="mt-5 space-y-5 text-[1.075rem] leading-8 text-slate-800 dark:text-slate-200">
                  {parseChapterBody(chapter.body).map((block, b) =>
                    block.kind === "quote" ? (
                      <blockquote
                        key={b}
                        className="border-l-[3px] border-indigo-400 py-1 pl-5 font-serif text-xl leading-8 text-slate-900 dark:border-indigo-500 dark:text-slate-100"
                      >
                        {plainText(block)}
                      </blockquote>
                    ) : (
                      <p key={b}>{plainText(block)}</p>
                    ),
                  )}
                </div>
                {sources.length ? (
                  <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Sources</h4>
                    <ul className="mt-2 space-y-2 text-sm">
                      {sources.map((source) => (
                        <li key={source.id}>
                          <SourceLine source={source} repeats={repeatsOf(source)} compact />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <details className="wv-expand group mt-16 max-w-[68ch] border-t border-slate-200 pt-6 dark:border-slate-800">
          <summary className="cursor-pointer list-none text-lg font-semibold text-slate-950 dark:text-white">
            All sources ({all.length}) <span aria-hidden className="inline-block text-slate-400 transition group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-4 space-y-3 text-sm">
            {all.map((source) => (
              <li key={source.id}>
                <SourceLine source={source} repeats={repeatsOf(source)} />
              </li>
            ))}
          </ul>
          {bundle.freshness.editorialReviewedAt ? (
            <p className="mt-6 text-sm text-slate-500">Reviewed {formatPartialDate(bundle.freshness.editorialReviewedAt)}.</p>
          ) : null}
        </details>
      </div>
      <ChapterToc chapters={chapters.map((c) => ({ key: c.key, title: c.title }))} />
    </div>
  );
}

// Profiles that predate dossiers: their sectioned copy with per-section
// source links, or the single biography field.
function LegacyBiography({ bundle }: { bundle: Awaited<ReturnType<typeof loadProfileRoute>>["bundle"] }) {
  const sections = bundle.legacy?.sections ?? [];
  return (
    <div className="max-w-[68ch]">
      <SectionHeading tab="biography" title="Biography" />
      {sections.length ? (
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-serif text-xl font-bold text-slate-950 dark:text-white">{section.heading}</h3>
              <p className="mt-3 text-[1.075rem] leading-8 whitespace-pre-line text-slate-800 dark:text-slate-200">{section.body}</p>
              {section.sources.length ? (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {section.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-700 dark:hover:text-indigo-300">
                        {s.label} <ExternalLink aria-hidden className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-[1.075rem] leading-8 whitespace-pre-line text-slate-800 dark:text-slate-200">{bundle.entity.biography}</p>
      )}
    </div>
  );
}
