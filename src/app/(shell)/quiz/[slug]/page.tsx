import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuizSession } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState, modeComplete, type QuizAnswer } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import { modeRank } from "@/lib/quiz/modes";
import { priorityItems, runnerState, serializeItem, type AnsweredItem } from "@/lib/quiz/runner";
import { ideologies } from "@/lib/quiz/ideologies";
import type { SharpenOutcome } from "@/lib/quiz/refine";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { PrioritiesBoard } from "@/components/quiz/priorities-board";
import { QuizCheckpoint, QuizHero, QuizResults, QuizResultView, resultViews, shareTitle } from "@/components/quiz/quiz-results";
import { ResultsViewHeader } from "@/components/quiz/results-nav";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
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
  // A checkpoint once reached stays reached: new bank items (the race axis in
  // bank 5) never reopen a finished quiz; they're asked if the quiz continues.
  const reached =
    session.checkpointHistory.some((c) => c.mode === session.targetMode) ||
    (session.highestCompletedMode !== null && modeRank(session.highestCompletedMode) >= modeRank(session.targetMode));
  const targetComplete = reached || modeComplete(state, session.answers.length, session.targetMode);
  const edit = access.canEdit ? parseEdit(sp.edit, session.answers) : undefined;
  const round = parseRound(sp);
  // "?view=priorities": the importance board, at the end of a checkpoint or
  // from the results page. Continuing drops `view` and keeps the rest, so a
  // finished quiz still lands on its reveal.
  if (access.canEdit && sp.view === "priorities") {
    const rest = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (k !== "view" && typeof v === "string" ? [[k, v]] : [])),
    );
    if (!rest.has("reveal")) rest.set("view", "results");
    return <PrioritiesBoard slug={slug} items={priorityItems(session.answers)} continueHref={`/quiz/${slug}?${rest}`} />;
  }

  // "?view=traditions|map|axes|issues": one drill-down view of the result.
  // Like "?view=results", any view shows the result over the runner.
  const viewing = sp.view === "results" || sp.view === "traditions" || sp.view === "map" || sp.view === "axes" || sp.view === "issues";
  const showRunner = access.canEdit && !viewing && (!targetComplete || sp.take === "1" || !!edit);

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

  const top = result.ideologies[0];
  const snapshot = session.targetMode === "quick";
  const name = snapshot ? `${FAMILIES[top.ideology.family].label} neighborhood` : top.ideology.name;
  const views = resultViews(result, session.targetMode);
  const view = views.find((v) => v.id === sp.view);

  if (view) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <ResultsViewHeader
          slug={slug}
          views={views}
          current={view.id}
          name={name}
          match={snapshot ? null : top.match}
          color={familyColor(top.ideology.family)}
          shareTitle={shareTitle(result, access.canEdit, session.targetMode)}
        />
        <QuizResultView slug={slug} result={result} canEdit={access.canEdit} view={view.id} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {unclaimedEditable && <QuizClaimBanner slug={slug} access={access} />}
      <QuizHero
        slug={slug}
        result={result}
        canEdit={access.canEdit}
        reveal={reveal}
        sharpened={reveal ? round : undefined}
        mode={session.targetMode}
        checkpointComplete={targetComplete}
        footer={
          access.canEdit && (
            <QuizCheckpoint slug={slug} mode={session.targetMode} complete={targetComplete} deferredCount={session.deferred.length} />
          )
        }
      />

      <QuizResults
        slug={slug}
        result={result}
        canEdit={access.canEdit}
        mode={session.targetMode}
        ownership={(access.isOwner || !access.canEdit) && <QuizOwnership slug={slug} access={access} visibility={session.visibility} />}
      />
    </div>
  );
}
