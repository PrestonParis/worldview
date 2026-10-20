import type { Metadata } from "next";
import Link from "next/link";
import { SpecialistAssessmentRunner } from "@/components/atlas/specialist-assessment";
import { authorityAssessment } from "@/lib/atlas/specialists";
import { quizAxisSeed } from "@/lib/atlas/quiz-seed";

export const metadata: Metadata = { title: "Government & Authority · Worldview Atlas", description: authorityAssessment.description };
export const dynamic = "force-dynamic";

export default async function AuthorityPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const raw = (await searchParams).from;
  const { slug, axes } = await quizAxisSeed(typeof raw === "string" ? raw : undefined);
  const seed: Record<string, number> = {};
  if (axes.democracy !== undefined) seed.legitimacy = axes.democracy;
  if (axes.executive !== undefined) { seed.power = axes.executive; seed.constraint = axes.executive; }
  if (axes.voting !== undefined) seed.participation = axes.voting;
  if (axes.federalism !== undefined) seed.federalism = axes.federalism;
  if (axes.liberty !== undefined) seed.liberty = axes.liberty;
  return <AssessmentPageHeader seeded={Object.keys(seed).length}><SpecialistAssessmentRunner assessment={authorityAssessment} seed={seed} sourceQuizSlug={slug} /></AssessmentPageHeader>;
}

function AssessmentPageHeader({ seeded, children }: { seeded: number; children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl pb-16"><header className="mx-auto mb-10 max-w-3xl"><Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← Atlas</Link><p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">{authorityAssessment.eyebrow}</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">{authorityAssessment.title}</h1><p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{authorityAssessment.description}</p>{seeded > 0 && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">Reusing {seeded} dimensions from your Political Atlas result; these questions will refine them.</p>}</header>{children}</div>;
}
