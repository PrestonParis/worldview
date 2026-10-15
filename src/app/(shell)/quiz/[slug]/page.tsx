import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuizSession, expiresAt } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState, modeComplete, type QuizAnswer } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import { runnerState, serializeItem, type AnsweredItem } from "@/lib/quiz/runner";
import { ideologies } from "@/lib/quiz/ideologies";
import type { SharpenOutcome } from "@/lib/quiz/refine";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { QuizCheckpoint, QuizHero, QuizResults, QuizSidebar } from "@/components/quiz/quiz-results";
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

// "?round=10&was=integralism&wasPct=66": the top match before a sharpen
// round, carried through the round so the reveal can show what changed.
function parseRound(sp: Awaited<SearchParams>): SharpenOutcome | undefined {
  const round = Number(sp.round);
  const pct = Number(sp.wasPct);
  const was = ideologies.find((i) => i.id === sp.was);
  if (!Number.isInteger(round) || round <= 0 || !Number.isFinite(pct) || !was) return undefined;
  return { round, was: { id: was.id, name: was.name, match: Math.round(pct) } };
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
  const targetComplete = modeComplete(state, session.answers.length, session.targetMode);
  const edit = access.canEdit ? parseEdit(sp.edit, session.answers) : undefined;
  const round = parseRound(sp);
  const showRunner = access.canEdit && sp.view !== "results" && (!targetComplete || sp.take === "1" || !!edit);

  if (showRunner) {
    return (
      <QuizRunner
        key={edit ? `edit:${edit.item.id}` : "run"}
        slug={slug}
        initial={runnerState(session.answers, session.refine, slug, session.targetMode, session.deferred, session.entryTopic)}
        initialEdit={edit}
        round={round}
      />
    );
  }

  const result = computeResult(session.answers, session.refine, state);
  const reveal = access.canEdit && sp.reveal === "1";
  const unclaimedEditable = access.canEdit && !access.isOwner && !session.ownerId;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {unclaimedEditable && <QuizClaimBanner slug={slug} access={access} expires={expiresAt(session)} />}
      <QuizHero
        slug={slug}
        result={result}
        canEdit={access.canEdit}
        reveal={reveal}
        sharpened={reveal ? round : undefined}
        mode={session.targetMode}
        checkpointComplete={targetComplete}
      />

      {access.canEdit && (
        <QuizCheckpoint
          slug={slug}
          mode={session.targetMode}
          complete={targetComplete}
          deferredCount={session.deferred.length}
        />
      )}

      <div className={`grid gap-8 ${session.targetMode === "quick" ? "" : "lg:grid-cols-[minmax(0,1fr)_16rem]"}`}>
        <div className="min-w-0 space-y-8">
          <QuizResults slug={slug} result={result} canEdit={access.canEdit} mode={session.targetMode} />
          {access.isOwner && (
            <QuizOwnership slug={slug} access={access} visibility={session.visibility} expires={null} />
          )}
        </div>
        {session.targetMode !== "quick" && <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block">
            <QuizSidebar slug={slug} result={result} canEdit={access.canEdit} mode={session.targetMode} />
          </div>
          {!access.canEdit && (
            <QuizOwnership slug={slug} access={access} visibility={session.visibility} expires={null} />
          )}
        </div>}
      </div>
    </div>
  );
}
