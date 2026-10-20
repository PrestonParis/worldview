import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Eyebrow, insetSurfaceClass, Surface } from "@/components/ui/surface";
import type { SpecialistAssessment, SpecialistMatch } from "@/lib/atlas/specialists";

export function SpecialistResults({
  assessment,
  dimensions,
  matches,
  accountLabel,
  synced,
  onRetake,
}: {
  assessment: SpecialistAssessment;
  dimensions: Record<string, number>;
  matches: SpecialistMatch[];
  accountLabel: string | null;
  synced: boolean;
  onRetake: () => void;
}) {
  const top = matches[0];

  if (!top) return null;

  return (
    <div className="space-y-8">
      <Surface className="p-6 sm:p-10">
        <Eyebrow>Your closest approach</Eyebrow>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">{top.school.name}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{top.school.summary}</p>
        <p className="mt-4 text-sm text-slate-500">
          This result describes an approach to one domain. It does not override your broader Atlas profile.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {top.school.philosophyId && (
            <Link
              href={`/atlas/philosophies/${top.school.philosophyId}`}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            >
              Explore related philosophy
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
            onClick={onRetake}
            className="inline-flex items-center gap-2 px-3 text-sm text-slate-500"
          >
            <RotateCcw size={14} /> Retake
          </button>
        </div>
        {accountLabel && (
          <p className="mt-3 text-xs text-slate-400">
            {synced ? "Saved to your account." : "Saved in this browser; account sync is still finishing."}
          </p>
        )}
      </Surface>

      <Surface className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Closest approaches</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {matches.slice(0, 3).map((match, index) => (
            <li key={match.school.id} className={`${insetSurfaceClass} p-5`}>
              <p className="text-xs text-slate-400">
                #{index + 1} · {match.score}% similarity
              </p>
              <p className="mt-1 font-semibold">{match.school.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{match.school.summary}</p>
            </li>
          ))}
        </ol>
      </Surface>

      <Surface className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Your dimensions</h2>
        <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {assessment.dimensions.map((dimension) => (
            <DimensionTrack
              key={dimension.id}
              name={dimension.name}
              negative={dimension.negative}
              positive={dimension.positive}
              value={dimensions[dimension.id] ?? 0}
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

function DimensionTrack({
  name,
  negative,
  positive,
  value,
}: {
  name: string;
  negative: string;
  positive: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-[11px] text-slate-500">
        <span>{negative}</span>
        <strong className="text-slate-800 dark:text-slate-200">{name}</strong>
        <span>{positive}</span>
      </div>
      <div className="relative mt-2 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 ring-2 ring-white dark:bg-white dark:ring-slate-950"
          style={{ left: `${(value + 1) * 50}%` }}
        />
      </div>
    </div>
  );
}
