import type { Metadata } from "next";
import Link from "next/link";
import { SpecialistAssessmentRunner } from "@/components/atlas/specialist-assessment";
import { foreignPolicyAssessment } from "@/lib/atlas/specialists";
import { quizAxisSeed } from "@/lib/atlas/quiz-seed";

export const metadata: Metadata = { title: "Foreign Policy · Worldview Atlas", description: foreignPolicyAssessment.description };
export const dynamic = "force-dynamic";

export default async function ForeignPolicyPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const raw = (await searchParams).from;
  const { slug, axes } = await quizAxisSeed(typeof raw === "string" ? raw : undefined);
  const seed: Record<string, number> = {};
  if (axes.engagement !== undefined) { seed.engagement = -axes.engagement; seed.institutions = -axes.engagement; seed.alliances = -axes.engagement; seed.aid = -axes.engagement; }
  if (axes.force !== undefined) { seed.force = -axes.force; seed.defense = -axes.force; }
  if (axes.trade !== undefined) seed.trade = axes.trade;
  return <div className="mx-auto max-w-6xl pb-16"><header className="mx-auto mb-10 max-w-3xl"><Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← Atlas</Link><p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">{foreignPolicyAssessment.eyebrow}</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">{foreignPolicyAssessment.title}</h1><p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{foreignPolicyAssessment.description}</p>{Object.keys(seed).length > 0 && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">Reusing {Object.keys(seed).length} dimensions from your Political Atlas result; these questions will refine them.</p>}</header><SpecialistAssessmentRunner assessment={foreignPolicyAssessment} seed={seed} sourceQuizSlug={slug} /></div>;
}
