import { ArrowLeft, ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import type { SpecialistAssessment, SpecialistQuestion as Question } from "@/lib/atlas/specialists";

const choices = [
  { value: -1, label: "Strongly disagree" },
  { value: -0.66, label: "Disagree" },
  { value: -0.33, label: "Somewhat disagree" },
  { value: 0, label: "Neutral" },
  { value: 0.33, label: "Somewhat agree" },
  { value: 0.66, label: "Agree" },
  { value: 1, label: "Strongly agree" },
] as const;

export function SpecialistQuestion({
  assessment,
  question,
  step,
  onBack,
  onPick,
}: {
  assessment: SpecialistAssessment;
  question: Question;
  step: number;
  onBack: () => void;
  onPick: (value: number) => void;
}) {
  const progress = (step / assessment.questions.length) * 100;
  const dimension = assessment.dimensions.find((item) => item.id === question.dimension);

  return (
    <Surface className="mx-auto max-w-3xl p-5 sm:p-10">
      <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
        <span>{dimension?.name}</span>
        <span className="font-mono text-xs">
          {step + 1}/{assessment.questions.length}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full bg-slate-900 transition-all dark:bg-white" style={{ width: `${progress}%` }} />
      </div>
      <h1 className="mt-10 min-h-32 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {question.text}
      </h1>
      <div className="mt-8 grid gap-2 sm:grid-cols-7">
        {choices.map((choice, index) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onPick(choice.value)}
            className="group flex min-h-20 flex-col items-center justify-center rounded-xl border border-slate-200 px-2 py-3 text-center text-xs leading-4 text-slate-600 hover:border-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900"
          >
            <span className="mb-2 flex size-6 items-center justify-center rounded-full border border-slate-300 font-mono text-[10px] dark:border-slate-700">
              {index + 1}
            </span>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={step === 0}
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 disabled:opacity-30"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-center text-xs text-slate-400">
          Existing Atlas answers prefill related dimensions when available.
        </p>
        <span className="whitespace-nowrap text-sm text-slate-400">
          Next <ArrowRight size={14} className="inline" />
        </span>
      </div>
    </Surface>
  );
}
