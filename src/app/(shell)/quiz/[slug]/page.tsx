import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuizSession, expiresAt } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState, type QuizAnswer } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import { runnerState, serializeItem, type AnsweredItem } from "@/lib/quiz/runner";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { QuizHero, QuizResults, QuizSidebar } from "@/components/quiz/quiz-results";
import { QuizClaimBanner, QuizOwnership } from "@/components/quiz/quiz-ownership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Political Quiz | Worldview",
  robots: { index: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// "?edit=statement:federalism.04" or "?edit=choice:abortion.limit"
function parseEdit(raw: string | string[] | undefined, answers: QuizAnswer[]): AnsweredItem | undefined {
  if (typeof raw !== "string") return undefined;
  const [kind, id] = raw.split(":");
  if (kind !== "statement" && kind !== "choice") return undefined;
  const item = serializeItem(kind, id);
  if (!item) return undefined;
  const existing = answers.find((a) => a.kind === kind && a.id === id);
  return { item, value: existing ? existing.value : null };
}

export default async function QuizSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!SLUG_PATTERN.test(slug)) notFound();
  const session = await getQuizSession(slug);
  if (!session) notFound();
  const access = await quizAccess(session);
  if (!access.canView) notFound();

  const state = computeState(session.answers, session.refine);
  const edit = access.canEdit ? parseEdit(sp.edit, session.answers) : undefined;
  const showRunner = access.canEdit && sp.view !== "results" && (!state.complete || sp.take === "1" || !!edit);

  if (showRunner) {
    return (
      <QuizRunner
        key={edit ? `edit:${edit.item.id}` : "run"}
        slug={slug}
        initial={runnerState(session.answers, session.refine, slug)}
        initialEdit={edit}
      />
    );
  }

  const result = computeResult(session.answers, session.refine, state);
  const reveal = access.canEdit && sp.reveal === "1";
  const unclaimedEditable = access.canEdit && !access.isOwner && !session.ownerId;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {unclaimedEditable && <QuizClaimBanner slug={slug} access={access} expires={expiresAt(session)} />}
      <QuizHero slug={slug} result={result} canEdit={access.canEdit} reveal={reveal} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-8">
          <QuizResults slug={slug} result={result} canEdit={access.canEdit} />
          {access.isOwner && (
            <QuizOwnership slug={slug} access={access} visibility={session.visibility} expires={null} />
          )}
        </div>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block">
            <QuizSidebar result={result} canEdit={access.canEdit} />
          </div>
          {!access.canEdit && (
            <QuizOwnership slug={slug} access={access} visibility={session.visibility} expires={null} />
          )}
        </div>
      </div>
    </div>
  );
}
