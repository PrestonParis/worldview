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
import { saveEconomicResultAction } from "@/lib/actions/atlas";
import {
  ECONOMIC_GROUPS,
  ECONOMIC_MODES,
  economicAnswerCount,
  economicDimensionValues,
  economicDimensions,
  economicMatches,
  economicModeComplete,
  economicReadings,
  nextEconomicMode,
  nextEconomicQuestion,
  questionById,
  type EconomicAnswers,
  type EconomicDimension,
  type EconomicDimensionReading,
  type EconomicMatch,
  type EconomicModeId,
  type EconomicQuestion,
  type EconomicSeed,
} from "@/lib/atlas/economics";
import type { EconomicProfileResult } from "@/lib/atlas/profile";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";

const RESULT_KEY = "worldview-atlas-economic-result-v1";
const DRAFT_KEY = "worldview-atlas-economic-draft-v2";

type View = "intro" | "question" | "review" | "results";

interface EconomicDraft {
  version: 2;
  mode: EconomicModeId;
  answers: EconomicAnswers;
  order: string[];
  view: Exclude<View, "intro">;
  sourceQuizSlug?: string;
  updatedAt: string;
}

function isDraft(value: unknown): value is EconomicDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<EconomicDraft>;
  return (
    draft.version === 2 &&
    (draft.mode === "snapshot" || draft.mode === "profile" || draft.mode === "deep") &&
    !!draft.answers &&
    Array.isArray(draft.order) &&
    (draft.view === "question" || draft.view === "review" || draft.view === "results")
  );
}

export function EconomicAssessment({
  seed = {},
  sourceQuizSlug,
  initialMode,
}: {
  seed?: EconomicSeed;
  sourceQuizSlug?: string;
  initialMode?: EconomicModeId;
}) {
  const session = useSession();
  const [mode, setMode] = useState<EconomicModeId>(initialMode ?? "snapshot");
  const [answers, setAnswers] = useState<EconomicAnswers>({});
  const [order, setOrder] = useState<string[]>([]);
  const [view, setView] = useState<View>(initialMode ? "question" : "intro");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [resume, setResume] = useState<EconomicDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [synced, setSynced] = useState(false);
  const [, startTransition] = useTransition();
  const persisted = useRef("");

  const readings = useMemo(() => economicReadings(answers, seed), [answers, seed]);
  const dimensions = useMemo(() => economicDimensionValues(answers, seed), [answers, seed]);
  const matches = useMemo(() => economicMatches(dimensions, readings), [dimensions, readings]);
  const next = useMemo(() => nextEconomicQuestion(answers, seed, mode), [answers, mode, seed]);
  const question = editingId ? (questionById.get(editingId) ?? next) : next;
  const target = ECONOMIC_MODES[mode].target;
  const asked = Object.keys(answers).length;
  const complete = economicModeComplete(answers, mode);

  useEffect(() => {
    const stored = readStoredJson("local", DRAFT_KEY);
    queueMicrotask(() => {
      if (isDraft(stored) && stored.order.some((id) => questionById.has(id))) setResume(stored);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || view === "intro" || order.length === 0) return;
    const draft: EconomicDraft = {
      version: 2,
      mode,
      answers,
      order,
      view,
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeStoredJson("local", DRAFT_KEY, draft);
  }, [answers, hydrated, mode, order, sourceQuizSlug, view]);

  useEffect(() => {
    if (view !== "results" || !complete) return;
    const key = `${mode}:${asked}`;
    if (persisted.current === key) return;
    persisted.current = key;
    const numericAnswers = Object.fromEntries(
      Object.entries(answers).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
    );
    const result: EconomicProfileResult = {
      version: 1,
      completedAt: new Date().toISOString(),
      answers: numericAnswers,
      dimensions,
      matches: matches.slice(0, 10).map((match) => ({ id: match.school.id, score: match.score })),
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
    };
    writeStoredJson("local", RESULT_KEY, result);
    if (session.accountLabel) startTransition(async () => setSynced((await saveEconomicResultAction(result)).ok));
  }, [answers, asked, complete, dimensions, matches, mode, session.accountLabel, sourceQuizSlug, view]);

  useEffect(() => {
    if (view !== "question" || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
      const number = Number(event.key);
      if (question.options && number >= 1 && number <= question.options.length) {
        event.preventDefault();
        pick(question.options[number - 1].value);
      } else if (!question.options && number >= 1 && number <= 7) {
        event.preventDefault();
        pick((SCALE[number - 1].value / 3) as number);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        pick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const begin = (selected: EconomicModeId) => {
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
    setOrder(resume.order.filter((id) => questionById.has(id)));
    setView(resume.view === "results" && !economicModeComplete(resume.answers, resume.mode) ? "question" : resume.view);
  };

  function pick(value: number | null) {
    if (!question) return;
    const nextAnswers = { ...answers, [question.id]: value };
    const nextOrder = order.includes(question.id) ? order : [...order, question.id];
    setAnswers(nextAnswers);
    setOrder(nextOrder);
    setEditingId(null);
    if (returnToReview) {
      setReturnToReview(false);
      setView("review");
      return;
    }
    if (economicModeComplete(nextAnswers, mode)) setView("results");
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

  const edit = (id: string) => {
    setEditingId(id);
    setReturnToReview(true);
    setView("question");
  };

  const continueTo = (selected: EconomicModeId) => {
    setMode(selected);
    setView("question");
    setEditingId(null);
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

  if (view === "intro") {
    return <EconomicIntro seed={seed} resume={hydrated ? resume : null} onBegin={begin} onResume={resumeDraft} />;
  }

  if (view === "review") {
    return (
      <EconomicReview
        order={order}
        answers={answers}
        onEdit={edit}
        onBack={() => setView(complete ? "results" : "question")}
      />
    );
  }

  if (view === "results") {
    return (
      <EconomicResults
        mode={mode}
        answers={answers}
        readings={readings}
        matches={matches}
        accountLabel={session.accountLabel}
        synced={synced}
        onReview={() => setView("review")}
        onContinue={continueTo}
        onRetake={retake}
      />
    );
  }

  if (!question) {
    return (
      <Surface className="mx-auto max-w-3xl p-8 text-center">
        <h2 className="text-2xl font-semibold">Your checkpoint is ready.</h2>
        <button type="button" onClick={() => setView("results")} className={`${primaryButton} mt-6`}>
          See your economic map
        </button>
      </Surface>
    );
  }

  return (
    <EconomicQuestionScreen
      question={question}
      value={answers[question.id]}
      asked={asked}
      target={target}
      mode={mode}
      seeded={readings.find((reading) => reading.id === question.dimension)?.seeded ?? false}
      canBack={order.length > 0}
      onPick={pick}
      onBack={back}
      onReview={() => setView("review")}
    />
  );
}

function EconomicIntro({
  seed,
  resume,
  onBegin,
  onResume,
}: {
  seed: EconomicSeed;
  resume: EconomicDraft | null;
  onBegin: (mode: EconomicModeId) => void;
  onResume: () => void;
}) {
  const seeded = Object.keys(seed).length;
  return (
    <div className="space-y-5">
      {resume && (
        <Surface className="flex flex-col justify-between gap-4 border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center dark:border-emerald-900 dark:bg-emerald-950/20">
          <div>
            <p className="font-semibold">Continue your {ECONOMIC_MODES[resume.mode].shortName.toLowerCase()}</p>
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
            <Eyebrow>Build your economic constitution</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start broad. Stop when the map is useful.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
              The assessment covers ownership, firms, work, markets, regulation, money, public finance, trade, and
              growth. It asks follow-ups where your answers are uncertain or where nearby schools disagree.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-emerald-600" /> Neutral and “not sure” are different signals.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-emerald-600" /> Every result shows the answers behind it.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-emerald-600" /> Your progress is saved in this browser.
              </li>
              <li className="flex gap-2">
                <Check size={17} className="mt-0.5 text-emerald-600" /> Continue from any checkpoint without restarting.
              </li>
            </ul>
            {seeded > 0 && (
              <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Sparkles size={15} className="mr-1.5 inline" /> Your Political Atlas supplies a light starting estimate
                on {seeded} dimensions. Direct answers replace it quickly.
              </p>
            )}
          </div>
          <div className="space-y-3">
            {(Object.keys(ECONOMIC_MODES) as EconomicModeId[]).map((id) => {
              const mode = ECONOMIC_MODES[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onBegin(id)}
                  className={`${insetSurfaceClass} group block w-full p-5 text-left ring-1 ring-transparent transition hover:ring-slate-300 dark:hover:ring-slate-700`}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-semibold">{mode.name}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 size={13} /> {mode.minutes}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {mode.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-slate-950 dark:group-hover:text-white">
                    About {mode.target} questions <ArrowRight size={13} />
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

function EconomicQuestionScreen({
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
  question: EconomicQuestion;
  value: number | null | undefined;
  asked: number;
  target: number;
  mode: EconomicModeId;
  seeded: boolean;
  canBack: boolean;
  onPick: (value: number | null) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  const dimension = economicDimensions.find((item) => item.id === question.dimension)!;
  const progress = Math.min(96, (asked / target) * 100);
  return (
    <Surface className="mx-auto max-w-3xl p-5 sm:p-9">
      <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
        <span>
          {dimension.name}
          {seeded && <span className="ml-2 text-emerald-700 dark:text-emerald-400">· Atlas prior</span>}
        </span>
        <span className="font-mono text-xs">
          {asked + 1} / about {target}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full bg-slate-900 transition-all dark:bg-white" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-slate-400 uppercase">
        {ECONOMIC_MODES[mode].shortName} · {dimension.prompt}
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
                className={`flex min-h-20 items-start gap-3 rounded-xl border px-4 py-4 text-left text-sm leading-6 transition-colors focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:outline-none dark:focus-visible:ring-white ${
                  value === option.value
                    ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 hover:border-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-900"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] ${
                    value === option.value ? "bg-white/15 dark:bg-slate-950/10" : "bg-slate-100 dark:bg-slate-800"
                  }`}
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
        <div className="order-3 flex gap-1">
          <button type="button" disabled={!canBack} onClick={onBack} className={ghostButton}>
            <ArrowLeft size={15} /> Back
          </button>
          {asked > 0 && (
            <button type="button" onClick={onReview} className={ghostButton}>
              <ListChecks size={15} /> Review
            </button>
          )}
        </div>
      </div>
    </Surface>
  );
}

function EconomicReview({
  order,
  answers,
  onEdit,
  onBack,
}: {
  order: string[];
  answers: EconomicAnswers;
  onEdit: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <Surface className="mx-auto max-w-4xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Answer review</Eyebrow>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Your economic evidence</h2>
        </div>
        <button type="button" onClick={onBack} className={ghostButton}>
          <ArrowLeft size={15} /> Return
        </button>
      </div>
      <ol className="mt-7 divide-y divide-slate-100 dark:divide-slate-800">
        {order.map((id, index) => {
          const question = questionById.get(id);
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
                  {index + 1} · {economicDimensions.find((item) => item.id === question.dimension)?.name}
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

function EconomicResults({
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
  mode: EconomicModeId;
  answers: EconomicAnswers;
  readings: EconomicDimensionReading[];
  matches: EconomicMatch[];
  accountLabel: string | null;
  synced: boolean;
  onReview: () => void;
  onContinue: (mode: EconomicModeId) => void;
  onRetake: () => void;
}) {
  const top = matches[0];
  const nextMode = nextEconomicMode(mode);
  const commitments = [...readings]
    .filter((reading) => reading.direct > 0)
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, 5);
  const differences = [...readings]
    .filter((reading) => reading.direct > 0)
    .map((reading) => ({ reading, gap: Math.abs(reading.mean - top.school.position[reading.id]) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
  const direct = economicAnswerCount(answers);
  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <Eyebrow>Your closest economic neighborhood · {top.fit} fit</Eyebrow>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">{top.school.name}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{top.school.summary}</p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This is a neighborhood, not an identity verdict. The result compares {direct} direct answers across twelve
              independent dimensions.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {nextMode && (
                <button type="button" onClick={() => onContinue(nextMode)} className={primaryButton}>
                  Continue to {ECONOMIC_MODES[nextMode].shortName.toLowerCase()} <ArrowRight size={16} />
                </button>
              )}
              {top.school.philosophyId && (
                <Link
                  href={`/atlas/philosophies/${top.school.philosophyId}`}
                  className={nextMode ? ghostButton : primaryButton}
                >
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
            <p className="text-sm font-semibold">Nearby schools</p>
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
          <Eyebrow>Defining commitments</Eyebrow>
          <h3 className="mt-2 text-2xl font-semibold">What most shaped the result</h3>
          <ul className="mt-5 space-y-4">
            {commitments.map((reading) => (
              <Commitment key={reading.id} reading={reading} />
            ))}
            {commitments.length === 0 && (
              <li className="text-sm leading-6 text-slate-500">
                You marked every measured question as uncertain, so the assessment does not yet have a defining
                commitment to report.
              </li>
            )}
          </ul>
        </Surface>
        <Surface className="p-6 sm:p-8">
          <Eyebrow>Your cross-pressures</Eyebrow>
          <h3 className="mt-2 text-2xl font-semibold">Where you differ from the label</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A useful result keeps the disagreements visible instead of forcing every answer to fit its headline.
          </p>
          <ul className="mt-5 space-y-4">
            {differences.map(({ reading, gap }) => {
              const dimension = economicDimensions.find((item) => item.id === reading.id)!;
              return (
                <li key={reading.id} className={`${insetSurfaceClass} p-4`}>
                  <p className="font-medium">{dimension.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Your position leans toward{" "}
                    <strong>{reading.mean < 0 ? dimension.negative : dimension.positive}</strong>,{" "}
                    {gap > 0.65 ? "a meaningful break" : "a modest difference"} from the typical{" "}
                    {top.school.name.toLowerCase()} position.
                  </p>
                </li>
              );
            })}
            {differences.length === 0 && (
              <li className="text-sm leading-6 text-slate-500">
                Answer more directly to reveal where your own combination departs from its closest school.
              </li>
            )}
          </ul>
        </Surface>
      </div>

      <Surface className="p-6 sm:p-8">
        <Eyebrow>Your economic constitution</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-2xl font-semibold">Twelve dimensions, with confidence</h3>
          <p className="text-xs text-slate-400">Direct answers determine confidence; an Atlas prior never does.</p>
        </div>
        <div className="mt-7 grid gap-8 lg:grid-cols-2">
          {ECONOMIC_GROUPS.map((group) => (
            <section key={group.id}>
              <h4 className="text-sm font-semibold text-slate-500">{group.label}</h4>
              <div className="mt-3 space-y-5">
                {economicDimensions
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
            Retaking starts a new local draft. Your last completed result remains available until the next checkpoint.
          </p>
        </div>
        <button type="button" onClick={onRetake} className={ghostButton}>
          <RotateCcw size={15} /> Start over
        </button>
      </Surface>
    </div>
  );
}

function Commitment({ reading }: { reading: EconomicDimensionReading }) {
  const dimension = economicDimensions.find((item) => item.id === reading.id)!;
  const label = reading.mean < 0 ? dimension.negative : dimension.positive;
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white dark:bg-white dark:text-slate-950">
        <Check size={13} />
      </span>
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {dimension.name} · {reading.confidence} confidence · {reading.direct} direct{" "}
          {reading.direct === 1 ? "answer" : "answers"}
        </p>
      </div>
    </li>
  );
}

function DimensionTrack({ dimension, reading }: { dimension: EconomicDimension; reading: EconomicDimensionReading }) {
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
      <div className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-sky-200 via-slate-100 to-amber-200 dark:from-sky-950 dark:via-slate-800 dark:to-amber-950">
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
