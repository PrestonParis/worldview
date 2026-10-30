"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useSession } from "@/components/auth/can-edit";
import { AgreeScale, SCALE } from "@/components/quiz/agree-scale";
import { ghostButton, primaryButton } from "@/components/quiz/styles";
import { Eyebrow, insetSurfaceClass, Surface } from "@/components/ui/surface";
import { saveSpecialistResultAction } from "@/lib/actions/atlas";
import {
  AUTHORITY_GROUPS,
  AUTHORITY_MODES,
  authorityAnswerCount,
  authorityDimensionValues,
  authorityDimensions,
  authorityMatches,
  authorityModeComplete,
  authorityQuestionById,
  authorityReadings,
  nextAuthorityMode,
  nextAuthorityQuestion,
  type AuthorityAnswers,
  type AuthorityDimension,
  type AuthorityDimensionReading,
  type AuthorityMatch,
  type AuthorityModeId,
  type AuthorityQuestion,
  type AuthoritySeed,
} from "@/lib/atlas/authority";
import type { SpecialistProfileResult } from "@/lib/atlas/profile";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";

const RESULT_KEY = "worldview-atlas-authority-result-v1";
const DRAFT_KEY = "worldview-atlas-authority-draft-v2";
type View = "intro" | "question" | "review" | "results";

interface AuthorityDraft {
  version: 2;
  mode: AuthorityModeId;
  answers: AuthorityAnswers;
  order: string[];
  view: Exclude<View, "intro">;
  sourceQuizSlug?: string;
  updatedAt: string;
}

function isDraft(value: unknown): value is AuthorityDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<AuthorityDraft>;
  return (
    draft.version === 2 &&
    (draft.mode === "snapshot" || draft.mode === "profile" || draft.mode === "deep") &&
    !!draft.answers &&
    Array.isArray(draft.order) &&
    (draft.view === "question" || draft.view === "review" || draft.view === "results")
  );
}

export function AuthorityAssessment({
  seed = {},
  sourceQuizSlug,
  initialMode,
}: {
  seed?: AuthoritySeed;
  sourceQuizSlug?: string;
  initialMode?: AuthorityModeId;
}) {
  const session = useSession();
  const [mode, setMode] = useState<AuthorityModeId>(initialMode ?? "snapshot");
  const [answers, setAnswers] = useState<AuthorityAnswers>({});
  const [order, setOrder] = useState<string[]>([]);
  const [view, setView] = useState<View>(initialMode ? "question" : "intro");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [resume, setResume] = useState<AuthorityDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [synced, setSynced] = useState(false);
  const [, startTransition] = useTransition();
  const persisted = useRef("");
  const readings = useMemo(() => authorityReadings(answers, seed), [answers, seed]);
  const dimensions = useMemo(() => authorityDimensionValues(answers, seed), [answers, seed]);
  const matches = useMemo(() => authorityMatches(dimensions, readings), [dimensions, readings]);
  const next = useMemo(() => nextAuthorityQuestion(answers, seed, mode), [answers, mode, seed]);
  const question = editingId ? (authorityQuestionById.get(editingId) ?? next) : next;
  const complete = authorityModeComplete(answers, mode);
  const asked = Object.keys(answers).length;

  useEffect(() => {
    const stored = readStoredJson("local", DRAFT_KEY);
    queueMicrotask(() => {
      if (isDraft(stored) && stored.order.some((id) => authorityQuestionById.has(id))) setResume(stored);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || view === "intro" || order.length === 0) return;
    writeStoredJson("local", DRAFT_KEY, {
      version: 2,
      mode,
      answers,
      order,
      view,
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
      updatedAt: new Date().toISOString(),
    } satisfies AuthorityDraft);
  }, [answers, hydrated, mode, order, sourceQuizSlug, view]);

  useEffect(() => {
    if (view !== "results" || !complete) return;
    const key = `${mode}:${asked}`;
    if (persisted.current === key) return;
    persisted.current = key;
    const result: SpecialistProfileResult = {
      version: 1,
      assessment: "authority",
      completedAt: new Date().toISOString(),
      answers: Object.fromEntries(
        Object.entries(answers).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
      ),
      dimensions,
      matches: matches.slice(0, 10).map((match) => ({ id: match.school.id, score: match.score })),
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
    };
    writeStoredJson("local", RESULT_KEY, result);
    if (session.accountLabel) startTransition(async () => setSynced((await saveSpecialistResultAction(result)).ok));
  }, [answers, asked, complete, dimensions, matches, mode, session.accountLabel, sourceQuizSlug, view]);

  useEffect(() => {
    if (view !== "question" || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
      const number = Number(event.key);
      if (question.options && number >= 1 && number <= question.options.length)
        pick(question.options[number - 1].value);
      else if (!question.options && number >= 1 && number <= 7) pick(SCALE[number - 1].value / 3);
      else if (event.key.toLowerCase() === "n") pick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const begin = (selected: AuthorityModeId) => {
    persisted.current = "";
    writeStoredJson("local", DRAFT_KEY, null);
    setMode(selected);
    setAnswers({});
    setOrder([]);
    setEditingId(null);
    setSynced(false);
    setView("question");
  };
  const resumeDraft = () => {
    if (!resume) return;
    setMode(resume.mode);
    setAnswers(resume.answers);
    setOrder(resume.order.filter((id) => authorityQuestionById.has(id)));
    setView(
      resume.view === "results" && !authorityModeComplete(resume.answers, resume.mode) ? "question" : resume.view,
    );
  };
  function pick(value: number | null) {
    if (!question) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    setOrder((current) => (current.includes(question.id) ? current : [...current, question.id]));
    setEditingId(null);
    if (returnToReview) {
      setReturnToReview(false);
      setView("review");
      return;
    }
    if (authorityModeComplete(nextAnswers, mode)) setView("results");
  }
  const back = () => {
    const previous = order.at(-1);
    if (!previous) return;
    setOrder((current) => current.slice(0, -1));
    setAnswers((current) => {
      const nextAnswers = { ...current };
      delete nextAnswers[previous];
      return nextAnswers;
    });
    setEditingId(previous);
  };
  const retake = () => {
    persisted.current = "";
    writeStoredJson("local", DRAFT_KEY, null);
    setAnswers({});
    setOrder([]);
    setEditingId(null);
    setResume(null);
    setSynced(false);
    setView("intro");
  };

  if (view === "intro")
    return <AuthorityIntro seed={seed} resume={hydrated ? resume : null} onBegin={begin} onResume={resumeDraft} />;
  if (view === "review")
    return (
      <AuthorityReview
        order={order}
        answers={answers}
        onEdit={(id) => {
          setEditingId(id);
          setReturnToReview(true);
          setView("question");
        }}
        onBack={() => setView(complete ? "results" : "question")}
      />
    );
  if (view === "results")
    return (
      <AuthorityResults
        mode={mode}
        answers={answers}
        readings={readings}
        matches={matches}
        accountLabel={session.accountLabel}
        synced={synced}
        onReview={() => setView("review")}
        onContinue={(selected) => {
          setMode(selected);
          setEditingId(null);
          setView("question");
        }}
        onRetake={retake}
      />
    );
  if (!question)
    return (
      <Surface className="mx-auto max-w-3xl p-8 text-center">
        <h2 className="text-2xl font-semibold">Your checkpoint is ready.</h2>
        <button type="button" onClick={() => setView("results")} className={`${primaryButton} mt-6`}>
          See your power map
        </button>
      </Surface>
    );
  return (
    <AuthorityQuestionScreen
      question={question}
      value={answers[question.id]}
      asked={asked}
      target={AUTHORITY_MODES[mode].target}
      mode={mode}
      seeded={readings.find((reading) => reading.id === question.dimension)?.seeded ?? false}
      canBack={order.length > 0}
      onPick={pick}
      onBack={back}
      onReview={() => setView("review")}
    />
  );
}

function AuthorityIntro({
  seed,
  resume,
  onBegin,
  onResume,
}: {
  seed: AuthoritySeed;
  resume: AuthorityDraft | null;
  onBegin: (mode: AuthorityModeId) => void;
  onResume: () => void;
}) {
  const seeded = Object.keys(seed).length;
  return (
    <div className="space-y-5">
      {resume && (
        <Surface className="flex flex-col justify-between gap-4 border-violet-200 bg-violet-50/70 p-5 sm:flex-row sm:items-center dark:border-violet-900 dark:bg-violet-950/20">
          <div>
            <p className="font-semibold">Continue your {AUTHORITY_MODES[resume.mode].shortName.toLowerCase()}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {resume.order.length} responses saved in this browser · updated{" "}
              {new Date(resume.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <button type="button" onClick={onResume} className={primaryButton}>
            Resume <ArrowRight size={16} />
          </button>
        </Surface>
      )}
      <Surface className="overflow-hidden p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <div>
            <Eyebrow>Design your governing constitution</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Principles meet institutions.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
              This assessment asks not only what authority you trust, but how your preferred system behaves under
              disagreement, deadlock, rights conflicts, and emergencies.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-violet-600" /> Neutral and “not sure” are different signals.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-violet-600" /> Scenarios reveal institutional tradeoffs.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-violet-600" /> Progress is saved in this browser.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-violet-600" /> Continue deeper without restarting.
              </li>
            </ul>
            {seeded > 0 && (
              <p className="mt-6 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                <Sparkles size={15} className="mr-1.5 inline" /> Your Political Atlas supplies a light starting estimate
                on {seeded} dimensions. Direct answers replace it quickly.
              </p>
            )}
          </div>
          <div className="space-y-3">
            {(Object.keys(AUTHORITY_MODES) as AuthorityModeId[]).map((id) => {
              const item = AUTHORITY_MODES[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onBegin(id)}
                  className={`${insetSurfaceClass} group block w-full p-5 text-left ring-1 ring-transparent transition hover:ring-slate-300 dark:hover:ring-slate-700`}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-semibold">{item.name}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 size={13} /> {item.minutes}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                    About {item.target} questions <ArrowRight size={13} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Surface>
    </div>
  );
}

function AuthorityQuestionScreen({
  question,
  value,
  asked,
  target,
  mode,
  seeded,
  canBack,
  onPick,
  onBack,
  onReview,
}: {
  question: AuthorityQuestion;
  value?: number | null;
  asked: number;
  target: number;
  mode: AuthorityModeId;
  seeded: boolean;
  canBack: boolean;
  onPick: (value: number | null) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  const dimension = authorityDimensions.find((item) => item.id === question.dimension)!;
  return (
    <Surface className="mx-auto max-w-3xl p-5 sm:p-9">
      <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
        <span>
          {dimension.name}
          {seeded && <span className="ml-2 text-violet-700 dark:text-violet-400">· Atlas prior</span>}
        </span>
        <span className="font-mono text-xs">
          {asked + 1} / about {target}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-violet-600 transition-all"
          style={{ width: `${Math.min(96, (asked / target) * 100)}%` }}
        />
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-slate-400 uppercase">
        {AUTHORITY_MODES[mode].shortName} · {dimension.prompt}
      </p>
      <h2 className="mt-6 min-h-28 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {question.text}
      </h2>
      <div className="mt-8">
        {question.options ? (
          <div
            role="radiogroup"
            aria-label="Choose the approach closest to yours"
            className="grid gap-2 sm:grid-cols-2"
          >
            {question.options.map((option, index) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={value === option.value}
                onClick={() => onPick(option.value)}
                className={`flex min-h-20 items-start gap-3 rounded-xl border px-4 py-4 text-left text-sm leading-6 transition-colors focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:outline-none ${value === option.value ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 dark:border-slate-800 dark:hover:bg-violet-950/20"}`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] ${value === option.value ? "bg-white/15" : "bg-slate-100 dark:bg-slate-800"}`}
                >
                  {index + 1}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <AgreeScale
            value={typeof value === "number" ? Math.round(value * 3) : undefined}
            onPick={(picked) => onPick(picked / 3)}
          />
        )}
      </div>
      <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row dark:border-slate-800">
        <button type="button" onClick={() => onPick(null)} className={`${ghostButton} order-2 sm:order-1`}>
          <CircleHelp size={15} /> Not sure <span className="font-mono text-[10px]">N</span>
        </button>
        <details className="order-1 text-center text-xs text-slate-500 sm:order-2">
          <summary className="cursor-pointer list-none font-medium">
            Why this question? <ChevronDown size={12} className="inline" />
          </summary>
          <p className="mt-2 max-w-md leading-5">{question.why}</p>
        </details>
        <div className="order-3 flex gap-2">
          {canBack && (
            <button type="button" onClick={onBack} className={ghostButton}>
              <ArrowLeft size={15} /> Back
            </button>
          )}
          <button type="button" onClick={onReview} className={ghostButton}>
            <ListChecks size={15} /> Review
          </button>
        </div>
      </div>
    </Surface>
  );
}

function AuthorityReview({
  order,
  answers,
  onEdit,
  onBack,
}: {
  order: string[];
  answers: AuthorityAnswers;
  onEdit: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <Surface className="mx-auto max-w-4xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Answer review</Eyebrow>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Your constitutional evidence</h2>
        </div>
        <button type="button" onClick={onBack} className={ghostButton}>
          <ArrowLeft size={15} /> Return
        </button>
      </div>
      <ol className="mt-7 divide-y divide-slate-100 dark:divide-slate-800">
        {order.map((id, index) => {
          const question = authorityQuestionById.get(id);
          if (!question) return null;
          const value = answers[id];
          const label =
            value === null
              ? "Not sure"
              : (question.options?.find((option) => option.value === value)?.label ??
                SCALE.find((item) => item.value === Math.round((value ?? 0) * 3))?.label ??
                "Answered");
          return (
            <li key={id} className="flex items-start justify-between gap-5 py-4">
              <div>
                <p className="text-xs text-slate-400">
                  {index + 1} · {authorityDimensions.find((item) => item.id === question.dimension)?.name}
                </p>
                <p className="mt-1 text-sm leading-6">{question.text}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
              </div>
              <button type="button" onClick={() => onEdit(id)} className={`${ghostButton} shrink-0`}>
                Change
              </button>
            </li>
          );
        })}
      </ol>
    </Surface>
  );
}

const scenarioText = (readings: AuthorityDimensionReading[]) => {
  const value = (id: AuthorityDimension["id"]) => readings.find((reading) => reading.id === id)?.mean ?? 0;
  return [
    {
      title: "When government deadlocks",
      text:
        value("concentration") > 0.2 || value("executive") > 0.25
          ? "You prefer a visible governing mandate with enough authority to act, then face electoral judgment."
          : "You would preserve divided authority and force negotiation, accepting delay as the cost of preventing arbitrary action.",
    },
    {
      title: "When a majority threatens a right",
      text:
        value("courts") > 0.2
          ? "You give independent courts a strong role in protecting constitutional rights from temporary majorities."
          : "You keep final responsibility closer to elected institutions, relying on public contest and legislative correction.",
    },
    {
      title: "When crisis arrives",
      text:
        value("emergency") > 0.2
          ? "You permit temporary exceptional discretion, with legitimacy depending on a genuine threat and eventual review."
          : "You keep emergency authority narrow and time-limited because crisis is when ordinary safeguards matter most.",
    },
  ];
};

function AuthorityResults({
  mode,
  answers,
  readings,
  matches,
  accountLabel,
  synced,
  onReview,
  onContinue,
  onRetake,
}: {
  mode: AuthorityModeId;
  answers: AuthorityAnswers;
  readings: AuthorityDimensionReading[];
  matches: AuthorityMatch[];
  accountLabel: string | null;
  synced: boolean;
  onReview: () => void;
  onContinue: (mode: AuthorityModeId) => void;
  onRetake: () => void;
}) {
  const top = matches[0];
  const nextMode = nextAuthorityMode(mode);
  const direct = authorityAnswerCount(answers);
  const commitments = [...readings]
    .filter((reading) => reading.direct > 0)
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, 5);
  const differences = [...readings]
    .filter((reading) => reading.direct > 0)
    .map((reading) => ({ reading, gap: Math.abs(reading.mean - top.school.position[reading.id]) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <Eyebrow>Your closest governing tradition · {top.fit} fit</Eyebrow>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">{top.school.name}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{top.school.summary}</p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This is a constitutional neighborhood, not a verdict. It compares {direct} direct answers and keeps your
              disagreements visible.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {nextMode && (
                <button type="button" onClick={() => onContinue(nextMode)} className={primaryButton}>
                  Continue to {AUTHORITY_MODES[nextMode].shortName.toLowerCase()} <ArrowRight size={16} />
                </button>
              )}
              {top.school.philosophyId && (
                <Link href={`/atlas/philosophies/${top.school.philosophyId}`} className={ghostButton}>
                  Explore this philosophy
                </Link>
              )}
              <button type="button" onClick={onReview} className={ghostButton}>
                <ListChecks size={15} /> Review answers
              </button>
            </div>
            {accountLabel && (
              <p className="mt-3 text-xs text-slate-400">
                {synced ? "Saved to your account." : "Saved in this browser; account sync is finishing."}
              </p>
            )}
          </div>
          <div className={`${insetSurfaceClass} p-5`}>
            <p className="text-sm font-semibold">Nearby traditions</p>
            <ol className="mt-4 space-y-4">
              {matches.slice(0, 4).map((match, index) => (
                <li key={match.school.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {index + 1}. {match.school.name}
                    </span>
                    <span className="text-xs text-slate-400">{match.fit} fit</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{match.school.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-2">
        <Surface className="p-6 sm:p-8">
          <Eyebrow>Your governing constitution</Eyebrow>
          <h3 className="mt-2 text-2xl font-semibold">Defining commitments</h3>
          <ul className="mt-5 space-y-4">
            {commitments.map((reading) => (
              <Commitment key={reading.id} reading={reading} />
            ))}
          </ul>
        </Surface>
        <Surface className="p-6 sm:p-8">
          <Eyebrow>Your cross-pressures</Eyebrow>
          <h3 className="mt-2 text-2xl font-semibold">Where you differ from the label</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A useful tradition keeps the disagreements visible instead of making every answer fit its headline.
          </p>
          <ul className="mt-5 space-y-4">
            {differences.map(({ reading, gap }) => {
              const dimension = authorityDimensions.find((item) => item.id === reading.id)!;
              return (
                <li key={reading.id} className={`${insetSurfaceClass} p-4`}>
                  <p className="font-medium">{dimension.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    You lean toward <strong>{reading.mean < 0 ? dimension.negative : dimension.positive}</strong>,{" "}
                    {gap > 0.65 ? "a meaningful break" : "a modest difference"} from typical{" "}
                    {top.school.name.toLowerCase()} institutions.
                  </p>
                </li>
              );
            })}
          </ul>
        </Surface>
      </div>

      <Surface className="p-6 sm:p-8">
        <Eyebrow>How your system would govern</Eyebrow>
        <h3 className="mt-2 text-2xl font-semibold">Three institutional stress tests</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {scenarioText(readings).map((scenario) => (
            <div key={scenario.title} className={`${insetSurfaceClass} p-5`}>
              <p className="font-semibold">{scenario.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{scenario.text}</p>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-6 sm:p-8">
        <Eyebrow>Your constitutional map</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-2xl font-semibold">Twelve dimensions, with confidence</h3>
          <p className="text-xs text-slate-500">Direct answers outweigh Atlas priors.</p>
        </div>
        <div className="mt-7 grid gap-8 lg:grid-cols-2">
          {AUTHORITY_GROUPS.map((group) => (
            <section key={group.id}>
              <h4 className="mb-5 text-xs font-semibold tracking-[.14em] text-slate-400 uppercase">{group.label}</h4>
              <div className="space-y-6">
                {authorityDimensions
                  .filter((dimension) => dimension.group === group.id)
                  .map((dimension) => (
                    <DimensionTrack
                      key={dimension.id}
                      dimension={dimension}
                      reading={readings.find((item) => item.id === dimension.id)!}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </Surface>

      <Surface className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="font-semibold">Want a clean slate?</p>
          <p className="mt-1 text-sm text-slate-500">
            Retaking starts a new local draft. Your completed checkpoint stays in Your Atlas until replaced.
          </p>
        </div>
        <button type="button" onClick={onRetake} className={ghostButton}>
          <RotateCcw size={15} /> Start over
        </button>
      </Surface>
    </div>
  );
}

function Commitment({ reading }: { reading: AuthorityDimensionReading }) {
  const dimension = authorityDimensions.find((item) => item.id === reading.id)!;
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs text-white">
        <Check size={13} />
      </span>
      <div>
        <p className="font-medium">{reading.mean < 0 ? dimension.negative : dimension.positive}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {dimension.name} · {reading.confidence} confidence · {reading.direct} direct{" "}
          {reading.direct === 1 ? "answer" : "answers"}
        </p>
      </div>
    </li>
  );
}

function DimensionTrack({ dimension, reading }: { dimension: AuthorityDimension; reading: AuthorityDimensionReading }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{dimension.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {reading.direct} direct · {reading.confidence} confidence{reading.seeded ? " · Atlas prior" : ""}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-900">
          {reading.mean < -0.18 ? dimension.negative : reading.mean > 0.18 ? dimension.positive : "Balanced"}
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-sky-200 via-slate-100 to-violet-200 dark:from-sky-950 dark:via-slate-800 dark:to-violet-950">
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 ring-2 ring-white dark:bg-white dark:ring-slate-950"
          style={{ left: `${Math.max(0, Math.min(100, (reading.mean + 1) * 50))}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{dimension.negative}</span>
        <span>{dimension.positive}</span>
      </div>
    </div>
  );
}
