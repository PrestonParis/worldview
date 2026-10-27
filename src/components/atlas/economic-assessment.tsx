"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useSession } from "@/components/auth/can-edit";
import { saveEconomicResultAction } from "@/lib/actions/atlas";
import {
  economicDimensions,
  economicMatches,
  economicQuestions,
  type EconomicDimensionId,
} from "@/lib/atlas/economics";
import type { EconomicProfileResult } from "@/lib/atlas/profile";
import { writeStoredJson } from "@/lib/browser/storage";

const STORAGE_KEY = "worldview-atlas-economic-result-v1";
const choices = [
  { value: -1, label: "Strongly disagree" },
  { value: -0.66, label: "Disagree" },
  { value: -0.33, label: "Somewhat disagree" },
  { value: 0, label: "Neutral" },
  { value: 0.33, label: "Somewhat agree" },
  { value: 0.66, label: "Agree" },
  { value: 1, label: "Strongly agree" },
];

export function EconomicAssessment({
  seed = {},
  sourceQuizSlug,
}: {
  seed?: Partial<Record<EconomicDimensionId, number>>;
  sourceQuizSlug?: string;
}) {
  const session = useSession();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [synced, setSynced] = useState(false);
  const [, startTransition] = useTransition();
  const persisted = useRef(false);

  const dimensions = useMemo(() => {
    const out: Record<string, number> = { ...seed };
    for (const dimension of economicDimensions) {
      const qs = economicQuestions.filter((q) => q.dimension === dimension.id && answers[q.id] !== undefined);
      if (!qs.length) continue;
      const measured = qs.reduce((sum, q) => sum + answers[q.id] * q.direction, 0) / qs.length;
      out[dimension.id] = seed[dimension.id] === undefined ? measured : seed[dimension.id]! * 0.35 + measured * 0.65;
    }
    return out;
  }, [answers, seed]);
  const matches = useMemo(() => economicMatches(dimensions), [dimensions]);
  const question = economicQuestions[step];

  useEffect(() => {
    if (!finished || persisted.current) return;
    persisted.current = true;
    const result: EconomicProfileResult = {
      version: 1,
      completedAt: new Date().toISOString(),
      answers,
      dimensions,
      matches: matches.slice(0, 10).map((m) => ({ id: m.school.id, score: m.score })),
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
    };
    writeStoredJson("local", STORAGE_KEY, result);
    if (session.accountLabel) startTransition(async () => setSynced((await saveEconomicResultAction(result)).ok));
  }, [answers, dimensions, finished, matches, session.accountLabel, sourceQuizSlug]);

  const answer = (value: number) => {
    setAnswers((x) => ({ ...x, [question.id]: value }));
    if (step === economicQuestions.length - 1) setFinished(true);
    else setStep((x) => x + 1);
  };

  if (finished) {
    return (
      <div className="space-y-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Your economic neighborhood</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl dark:text-white">
            {matches[0].school.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            {matches[0].school.summary}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            This is a neighborhood, not an identity verdict. Your closest three schools differ on important
            institutional questions.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {matches[0].school.philosophyId && (
              <Link
                href={`/atlas/philosophies/${matches[0].school.philosophyId}`}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                Explore this philosophy
              </Link>
            )}
            <Link
              href="/atlas/me"
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold dark:border-slate-700"
            >
              Open Your Atlas
            </Link>
            <button
              type="button"
              onClick={() => {
                persisted.current = false;
                setAnswers({});
                setStep(0);
                setFinished(false);
                setSynced(false);
              }}
              className="inline-flex items-center gap-2 px-3 text-sm text-slate-500"
            >
              <RotateCcw size={14} /> Retake
            </button>
          </div>
          {session.accountLabel && (
            <p className="mt-3 text-xs text-slate-400">
              {synced ? "Saved to your account." : "Saved in this browser; account sync is still finishing."}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-2xl font-semibold tracking-tight">Closest schools</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {matches.slice(0, 3).map((match, i) => (
              <li key={match.school.id} className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900">
                <p className="text-xs text-slate-400">
                  #{i + 1} · {match.score}% similarity
                </p>
                <p className="mt-1 font-semibold">{match.school.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{match.school.summary}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-2xl font-semibold tracking-tight">Your ten dimensions</h2>
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {economicDimensions.map((d) => {
              const value = dimensions[d.id] ?? 0;
              return (
                <div key={d.id}>
                  <div className="flex justify-between gap-3 text-xs">
                    <span>{d.negative}</span>
                    <strong>{d.name}</strong>
                    <span>{d.positive}</span>
                  </div>
                  <div className="relative mt-2 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
                    <span
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 ring-2 ring-white dark:bg-white dark:ring-slate-950"
                      style={{ left: `${(value + 1) * 50}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
        <span>{economicDimensions.find((d) => d.id === question.dimension)?.name}</span>
        <span className="font-mono text-xs">
          {step + 1}/{economicQuestions.length}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-slate-900 transition-all dark:bg-white"
          style={{ width: `${(step / economicQuestions.length) * 100}%` }}
        />
      </div>
      <h1 className="mt-10 min-h-32 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {question.text}
      </h1>
      <div className="mt-8 grid gap-2 sm:grid-cols-7">
        {choices.map((choice, i) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => answer(choice.value)}
            className="group flex min-h-20 flex-col items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-xs leading-4 text-slate-600 hover:border-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900"
          >
            <span className="mb-2 flex size-6 items-center justify-center rounded-full border border-slate-300 font-mono text-[10px] group-hover:border-slate-600 dark:border-slate-700">
              {i + 1}
            </span>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((x) => x - 1)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 disabled:opacity-30"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-xs text-slate-400">Your Atlas answers prefill four dimensions when available.</p>
        <span className="text-sm text-slate-400">
          Next <ArrowRight size={14} className="inline" />
        </span>
      </div>
    </section>
  );
}
