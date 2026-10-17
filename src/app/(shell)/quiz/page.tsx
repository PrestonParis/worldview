import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { startQuizAction } from "@/lib/actions/quiz";
import { currentUserId } from "@/lib/quiz/access";
import { currentUserIsOwner } from "@/lib/auth/guard";
import { listQuizSessions, UNCLAIMED_TTL_DAYS } from "@/lib/db/quizSessions";
import { statements, issues } from "@/lib/quiz/bank";
import { AXIS_GROUPS, axes } from "@/lib/quiz/axes";
import { ideologies } from "@/lib/quiz/ideologies";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { ISSUE_HUBS } from "@/lib/quiz/hubs";
import { type IdeologyFamily, type IssueId } from "@/lib/quiz/types";
import { QUIZ_MODES, validQuizMode, type QuizModeId } from "@/lib/quiz/modes";
import { QuizHero } from "@/components/quiz/quiz-hero";
import { UnderTheHood } from "@/components/quiz/under-the-hood";
import { AgreeScalePreview } from "@/components/quiz/agree-scale";
import { card, primaryButton } from "@/components/quiz/styles";

export const metadata: Metadata = {
  title: "Worldview Atlas: Find your place on the map | Worldview",
  description: "An adaptive political quiz across 18 dimensions and 28 issues that places you among 80 political traditions.",
};

export const dynamic = "force-dynamic";

const FAMILY_ORDER: IdeologyFamily[] = ["left", "liberal", "center", "conservative", "right", "libertarian", "populist", "religious", "other"];

type SearchParams = Promise<{ mode?: string | string[]; topic?: string | string[] }>;

export default async function QuizPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const requestedMode = validQuizMode(typeof sp.mode === "string" ? sp.mode : undefined);
  const requestedTopic = typeof sp.topic === "string" && issues.some((issue) => issue.id === sp.topic) ? (sp.topic as IssueId) : null;
  const userId = await currentUserId();
  const [mine, isOwner] = await Promise.all([userId ? listQuizSessions(userId) : [], currentUserIsOwner()]);
  const inProgress = mine.find((q) => q.status !== "complete");
  const issueQuestions = issues.reduce((n, m) => n + 1 + m.followUps.length, 0);

  return (
    <div className="mx-auto max-w-6xl pt-2 pb-10 lg:pt-6">
      {isOwner && (
        <p className="mb-3 text-right text-sm">
          <Link href="/quiz/stats" className="text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
            Quiz stats
          </Link>
        </p>
      )}
      <QuizHero
        mode={requestedMode}
        topic={requestedTopic}
        topicName={requestedTopic ? issues.find((i) => i.id === requestedTopic)!.name : null}
      />

      {(inProgress || mine.length > 0) && (
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-950/6 pt-5 text-sm dark:border-white/6">
          {inProgress && (
            <Link href={`/quiz/${inProgress.slug}`} className="font-medium text-slate-950 underline-offset-4 hover:underline dark:text-white">
              Continue where you left off →
            </Link>
          )}
          {mine.slice(0, 3).map((q) => (
            <Link key={q.id} href={`/quiz/${q.slug}`} className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
              {q.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {QUIZ_MODES[q.targetMode].shortName} ·{" "}
              {q.status === "complete" ? "Complete" : `${q.answers.length} answers`}
            </Link>
          ))}
        </div>
      )}

      {/* ── Under the hood ── */}
      <section className="mt-20 lg:mt-28">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-12 gap-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">See how it works</h2>
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            The dimensions, issues, traditions, scoring, and privacy choices behind every result.
          </p>
        </div>
        <UnderTheHood
          tabs={[
            {
              id: "how",
              label: "How it works",
              title: "Fewer questions. More signal.",
              description: "The next question is chosen from what the model still doesn't know, not from a fixed script.",
              panel: <HowItWorks />,
            },
            {
              id: "dimensions",
              label: "Dimensions",
              count: String(axes.length),
              title: `${axes.length} independent dimensions`,
              description: "Beliefs are measured separately, so one answer can't quietly decide an unrelated position.",
              panel: <DimensionsPanel />,
            },
            {
              id: "issues",
              label: "Issues",
              count: String(issues.length),
              title: `${issues.length} issues, broken into decisions`,
              description: "Broad preferences branch into the concrete rules, exceptions, and institutions that make policy real.",
              panel: <IssuesPanel />,
            },
            {
              id: "traditions",
              label: "Traditions",
              count: String(ideologies.length),
              title: `${ideologies.length} traditions, not one forced label`,
              description: "Results are ranked against the whole field, with the disagreements kept visible. Pick any to read about it.",
              panel: <TraditionsPanel />,
            },
            {
              id: "scoring",
              label: "Scoring",
              title: "Position and uncertainty travel together",
              description: "The Atlas reports what the evidence supports, and says so when your answers are sparse or genuinely mixed.",
              panel: <ScoringPanel />,
            },
            {
              id: "privacy",
              label: "Privacy",
              title: "Start anonymously. Keep control.",
              description: "A random private key keeps the quiz yours; an account is only needed to keep it permanently.",
              panel: <PrivacyPanel />,
            },
          ]}
        />
      </section>

      {/* ── Closing ── */}
      <section className={`${card} mt-6 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8`}>
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Find your place on the map</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {statements.length} statements and {issueQuestions} issue questions in the bank. The quiz asks the ones that tell it the most
            about you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <a href="#traditions" className="text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
            Browse all {ideologies.length} traditions
          </a>
          <StartButton label={`Start the ${QUIZ_MODES[requestedMode].shortName.toLowerCase()}`} mode={requestedMode} topic={requestedTopic} />
        </div>
      </section>
    </div>
  );
}

// ── Actions ──

function StartButton({ label, mode, topic = null }: { label: string; mode: QuizModeId; topic?: IssueId | null }) {
  return (
    <form action={startQuizAction}>
      <input type="hidden" name="mode" value={mode} />
      {topic && <input type="hidden" name="topic" value={topic} />}
      <button type="submit" className={primaryButton}>
        {label}
        <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}

// ── Under-the-hood panels ──

function HowItWorks() {
  return (
    <div className="space-y-8">
      <ol className="grid gap-6 sm:grid-cols-3">
        <Step n={1} title="Read the signal">
          Values and concrete policy choices set a first position on each dimension they bear on.
        </Step>
        <Step n={2} title="Follow the branch">
          Settled ground is skipped; mixed or uncertain views get better questions.
        </Step>
        <Step n={3} title="Map the result">
          Positions, confidence, issue stances, and closest traditions are recomputed after every answer.
        </Step>
      </ol>
      <div className="grid gap-6 border-t border-slate-950/6 pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 dark:border-white/8">
        <div className="max-w-md">
          <AgreeScalePreview />
        </div>
        <div className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-medium text-slate-950 dark:text-white">Strength is evidence.</span> A strong answer moves a dimension further
            than a mild one.
          </p>
          <p>
            <span className="font-medium text-slate-950 dark:text-white">Neutral is a position.</span> &ldquo;Not sure&rdquo; carries no weight,
            so uncertainty is never mistaken for moderation.
          </p>
          <p>
            <span className="font-medium text-slate-950 dark:text-white">Nothing is final.</span> Pause, change an answer, or go deeper at any
            point.
          </p>
        </div>
      </div>
    </div>
  );
}

function DimensionsPanel() {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
      {AXIS_GROUPS.map((g) => (
        <div key={g.id}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{g.label}</p>
          <ul className="mt-1 divide-y divide-slate-950/6 dark:divide-white/6">
            {axes
              .filter((x) => x.group === g.id)
              .map((x) => (
                <Expander key={x.id} title={x.name} meta={`${x.negative.label} ↔ ${x.positive.label}`}>
                  <p>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{x.negative.label}:</span> {x.negative.description}
                  </p>
                  <p className="mt-1.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{x.positive.label}:</span> {x.positive.description}
                  </p>
                </Expander>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function IssuesPanel() {
  return (
    <ul className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
      {issues.map((module) => {
        const parts = [module.screener, ...module.followUps].map((question) => question.attribute);
        const hub = ISSUE_HUBS[module.id];
        return (
          <Expander key={module.id} title={module.name} meta={`${parts.length} ${parts.length === 1 ? "decision" : "decisions"}`} bordered>
            <ul className="flex flex-wrap gap-1.5">
              {parts.map((part) => (
                <li key={part} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {part}
                </li>
              ))}
            </ul>
            {hub && (
              <a href={hub.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-950 hover:underline dark:text-white">
                The data on {hub.label.toLowerCase()}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </Expander>
        );
      })}
    </ul>
  );
}

// Every tradition links to its panel on the map (#tradition=<id>).
function TraditionsPanel() {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
      {FAMILY_ORDER.map((f) => {
        const members = ideologies.filter((i) => i.family === f);
        if (members.length === 0) return null;
        return (
          <div key={f}>
            <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: familyColor(f) }} />
              {FAMILIES[f].label}
              <span className="tabular-nums">{members.length}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {members.map((i) => (
                <li key={i.id}>
                  <a
                    href={`#tradition=${i.id}`}
                    title={i.description}
                    className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[13px] text-slate-800 transition-colors hover:bg-slate-950 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white dark:hover:text-slate-950"
                  >
                    {i.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ScoringPanel() {
  return (
    <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      <Point title="Each dimension is measured separately">
        An answer only updates dimensions it actually bears on. Correlations can choose a useful next question, but never fill in a belief for you.
      </Point>
      <Point title="Uncertainty stays attached">
        Sparse or conflicting evidence widens the range around a position. The result says &ldquo;mixed&rdquo; instead of manufacturing confidence.
      </Point>
      <Point title="Policy stays in your words">
        Issue profiles report the options you chose. They also inform the underlying dimensions without replacing the policy record.
      </Point>
      <Point title="Traditions are reference points">
        Traditions are ranked across all {axes.length} dimensions. Their defining dimensions count most, and your best-measured dimensions carry
        more weight.
      </Point>
      <Point title="A non-answer is not the center">
        Skipped and &ldquo;not sure&rdquo; responses carry zero information. Neutral is an actual position and is scored as one.
      </Point>
    </dl>
  );
}

function PrivacyPanel() {
  return (
    <dl className="grid gap-x-10 gap-y-6 md:grid-cols-3">
      <Point title="Start without an identity">
        No name or email is required. A random editing key stays in the browser that created the quiz.
      </Point>
      <Point title="Resume, then expire">
        Answers are saved so the link can resume. Unclaimed quizzes are deleted after {UNCLAIMED_TTL_DAYS} days; their answers are kept anonymously, without the link, to improve the quiz.
      </Point>
      <Point title="Claim on your terms">
        Sign in only if you want to keep it. Then choose public or private, or delete the result entirely.
      </Point>
    </dl>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li>
      <p className="text-sm text-slate-400 tabular-nums dark:text-slate-500">{n}</p>
      <p className="mt-1 text-[15px] font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</p>
    </li>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[15px] font-semibold text-slate-950 dark:text-white">{title}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</dd>
    </div>
  );
}

function Expander({ title, meta, bordered, children }: { title: string; meta?: string; bordered?: boolean; children: ReactNode }) {
  return (
    <li className={bordered ? "border-b border-slate-950/6 dark:border-white/6" : undefined}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-slate-400">
          <span className="font-medium text-slate-900 group-hover:text-slate-600 dark:text-slate-100 dark:group-hover:text-slate-300">{title}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
            {meta && <span className="hidden sm:inline">{meta}</span>}
            <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="pb-3 text-[13px] leading-5 text-slate-600 dark:text-slate-400">{children}</div>
      </details>
    </li>
  );
}
