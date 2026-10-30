import type { Metadata } from "next";
import Link from "next/link";
import { EconomicAssessment } from "@/components/atlas/economic-assessment";
import { getQuizSession } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import type { EconomicConfidence, EconomicDimensionId, EconomicModeId, EconomicSeed } from "@/lib/atlas/economics";

export const metadata: Metadata = {
  title: "Economic Foundations · Worldview Atlas",
  description:
    "Build an adaptive economic profile across ownership, firms, labor, markets, regulation, land, money, public finance, trade, and growth.",
};
export const dynamic = "force-dynamic";

async function atlasSeed(slug: string | undefined): Promise<EconomicSeed> {
  if (!slug || !SLUG_PATTERN.test(slug)) return {};
  const session = await getQuizSession(slug);
  if (!session || !(await quizAccess(session)).canView) return {};
  const result = computeResult(session.answers, session.refine, computeState(session.answers, session.refine));
  const axis = (id: string) => result.axes.find((x) => x.axis === id);
  const seed: EconomicSeed = {};
  const pairs: [EconomicDimensionId, string][] = [
    ["ownership", "ownership"],
    ["coordination", "regulation"],
    ["regulation", "regulation"],
    ["distribution", "redistribution"],
    ["trade", "trade"],
  ];
  for (const [economic, atlas] of pairs) {
    const reading = axis(atlas);
    if (reading && reading.confidence !== "low") {
      seed[economic] = { value: reading.mean, confidence: reading.confidence as EconomicConfidence };
    }
  }
  const environment = axis("environment");
  const technology = axis("technology");
  if (environment && technology && environment.confidence !== "low" && technology.confidence !== "low") {
    seed.growth = {
      value: (environment.mean + technology.mean) / 2,
      confidence: environment.confidence === "high" && technology.confidence === "high" ? "high" : "medium",
    };
  }
  return seed;
}

export default async function EconomicFoundationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.from;
  const from = typeof raw === "string" ? raw : undefined;
  const requestedMode =
    typeof params.mode === "string" && ["snapshot", "profile", "deep"].includes(params.mode)
      ? (params.mode as EconomicModeId)
      : undefined;
  const seed = await atlasSeed(from);
  const seeded = Object.keys(seed).length;
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mx-auto mb-10 max-w-3xl">
        <Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">
          ← Atlas
        </Link>
        <p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Specialist deep dive</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Economic Foundations</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
          An adaptive map of twelve economic dimensions—from ownership and work to money, public finance, trade, and
          growth. Stop at a useful checkpoint or keep going until every dimension is clarified.
        </p>
        {seeded > 0 && (
          <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Your Political Atlas supplies a light, confidence-aware prior on {seeded} dimensions. Direct economic
            answers replace it quickly.
          </p>
        )}
      </header>
      <EconomicAssessment seed={seed} sourceQuizSlug={from} initialMode={requestedMode} />
    </div>
  );
}
