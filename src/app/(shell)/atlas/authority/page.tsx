import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityAssessment } from "@/components/atlas/authority-assessment";
import type { AuthorityModeId, AuthoritySeed } from "@/lib/atlas/authority";
import { quizAxisSeed } from "@/lib/atlas/quiz-seed";

export const metadata: Metadata = {
  title: "Power & Democracy · Worldview Atlas",
  description:
    "An adaptive deep dive into legitimacy, representation, constitutional power, rights, expertise, political change, and emergencies.",
};
export const dynamic = "force-dynamic";

export default async function AuthorityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; mode?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = query.from;
  const { slug, axes } = await quizAxisSeed(typeof raw === "string" ? raw : undefined);
  const seed: AuthoritySeed = {};
  if (axes.democracy !== undefined) seed.legitimacy = { value: axes.democracy, confidence: "low" };
  if (axes.executive !== undefined) {
    seed.executive = { value: axes.executive, confidence: "low" };
    seed.concentration = { value: axes.executive, confidence: "low" };
  }
  if (axes.voting !== undefined) {
    seed.participation = { value: axes.voting, confidence: "low" };
    seed.representation = { value: axes.voting * 0.6, confidence: "low" };
  }
  if (axes.federalism !== undefined) seed.federalism = { value: axes.federalism, confidence: "low" };
  if (axes.liberty !== undefined) seed.liberty = { value: axes.liberty, confidence: "low" };
  if (axes.violence !== undefined) seed.emergency = { value: axes.violence * 0.5, confidence: "low" };
  const requestedMode =
    typeof query.mode === "string" && ["snapshot", "profile", "deep"].includes(query.mode)
      ? (query.mode as AuthorityModeId)
      : undefined;
  return (
    <AssessmentPageHeader seeded={Object.keys(seed).length}>
      <AuthorityAssessment seed={seed} sourceQuizSlug={slug} initialMode={requestedMode} />
    </AssessmentPageHeader>
  );
}

function AssessmentPageHeader({ seeded, children }: { seeded: number; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mx-auto mb-10 max-w-3xl">
        <Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">
          ← Atlas
        </Link>
        <p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Specialist deep dive</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Power &amp; Democracy</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
          Build a governing constitution across twelve dimensions—from consent and representation to courts,
          administration, political change, and emergency power.
        </p>
        {seeded > 0 && (
          <p className="mt-3 text-sm font-medium text-violet-700 dark:text-violet-400">
            Using {seeded} weak priors from your Political Atlas result; direct answers will refine them.
          </p>
        )}
      </header>
      {children}
    </div>
  );
}
