import type { Metadata } from "next";
import Link from "next/link";
import { EconomicAssessment } from "@/components/atlas/economic-assessment";
import { getQuizSession } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import type { EconomicDimensionId } from "@/lib/atlas/economics";

export const metadata: Metadata = { title: "Economic Foundations · Worldview Atlas", description: "Explore your economic philosophy across ownership, coordination, firms, labor, land, money, trade, and growth." };
export const dynamic = "force-dynamic";

async function atlasSeed(slug: string | undefined): Promise<Partial<Record<EconomicDimensionId, number>>> {
  if (!slug || !SLUG_PATTERN.test(slug)) return {};
  const session = await getQuizSession(slug);
  if (!session || !(await quizAccess(session)).canView) return {};
  const result = computeResult(session.answers, session.refine, computeState(session.answers, session.refine));
  const value = (id: string) => result.axes.find((x) => x.axis === id)?.mean;
  const seed: Partial<Record<EconomicDimensionId, number>> = {};
  const pairs: [EconomicDimensionId, string][] = [["ownership", "ownership"], ["coordination", "regulation"], ["distribution", "redistribution"], ["trade", "trade"]];
  for (const [economic, atlas] of pairs) { const x = value(atlas); if (x !== undefined) seed[economic] = x; }
  const environment = value("environment");
  const technology = value("technology");
  if (environment !== undefined && technology !== undefined) seed.growth = (environment + technology) / 2;
  return seed;
}

export default async function EconomicFoundationsPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const raw = (await searchParams).from;
  const from = typeof raw === "string" ? raw : undefined;
  const seed = await atlasSeed(from);
  const seeded = Object.keys(seed).length;
  return <div className="mx-auto max-w-6xl pb-16"><header className="mx-auto mb-10 max-w-3xl"><Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← Atlas</Link><p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Specialist assessment</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Economic Foundations</h1><p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Twenty decisions across ten dimensions. The result shows nearby schools of political economy—not a left/right score and not a declaration of identity.</p>{seeded > 0 && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">Reusing {seeded} dimensions from your Political Atlas result; these questions will refine them.</p>}</header><EconomicAssessment seed={seed} sourceQuizSlug={from} /></div>;
}
