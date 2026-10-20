"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSession } from "@/components/auth/can-edit";
import { saveSpecialistResultAction } from "@/lib/actions/atlas";
import { specialistDimensions, specialistMatches, type SpecialistAssessment } from "@/lib/atlas/specialists";
import type { SpecialistProfileResult } from "@/lib/atlas/profile";
import { writeStoredJson } from "@/lib/browser/storage";
import { SpecialistQuestion } from "./specialist-question";
import { SpecialistResults } from "./specialist-results";

export const specialistStorageKey = (id: SpecialistAssessment["id"]) => `worldview-atlas-${id}-result-v1`;

export function SpecialistAssessmentRunner({
  assessment,
  seed = {},
  sourceQuizSlug,
}: {
  assessment: SpecialistAssessment;
  seed?: Record<string, number>;
  sourceQuizSlug?: string;
}) {
  const session = useSession();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [synced, setSynced] = useState(false);
  const [, startTransition] = useTransition();
  const persisted = useRef(false);
  const dimensions = useMemo(() => specialistDimensions(assessment, answers, seed), [answers, assessment, seed]);
  const matches = useMemo(() => specialistMatches(assessment, dimensions), [assessment, dimensions]);
  const question = assessment.questions[step];

  useEffect(() => {
    if (!finished || persisted.current) return;
    persisted.current = true;
    const result: SpecialistProfileResult = {
      version: 1,
      assessment: assessment.id,
      completedAt: new Date().toISOString(),
      answers,
      dimensions,
      matches: matches.map((m) => ({ id: m.school.id, score: m.score })),
      ...(sourceQuizSlug ? { sourceQuizSlug } : {}),
    };
    writeStoredJson("local", specialistStorageKey(assessment.id), result);
    if (session.accountLabel) startTransition(async () => setSynced((await saveSpecialistResultAction(result)).ok));
  }, [answers, assessment.id, dimensions, finished, matches, session.accountLabel, sourceQuizSlug]);

  const pick = (value: number) => {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    if (step === assessment.questions.length - 1) setFinished(true);
    else setStep((current) => current + 1);
  };
  const retake = () => {
    persisted.current = false;
    setAnswers({});
    setStep(0);
    setFinished(false);
    setSynced(false);
  };

  if (finished) {
    return (
      <SpecialistResults
        assessment={assessment}
        dimensions={dimensions}
        matches={matches}
        accountLabel={session.accountLabel}
        synced={synced}
        onRetake={retake}
      />
    );
  }

  return (
    <SpecialistQuestion
      assessment={assessment}
      question={question}
      step={step}
      onBack={() => setStep((current) => current - 1)}
      onPick={pick}
    />
  );
}
