"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { AgreeScale, SCALE } from "@/components/quiz/agree-scale";
import { AxisTrack } from "@/components/politics/axis";
import { FamilyDot } from "@/components/politics/tradition";
import { AXIS_GROUPS, axisById } from "@/lib/quiz/axes";
import { pointsApart, positionLabel, value100 } from "@/lib/politics/axis-language";
import type { AtlasSample, AtlasShowcase as AtlasData } from "@/lib/home/showcase";
import type { AxisGroup } from "@/lib/quiz/types";
import { CardHeading, CtaLink, ShowcaseCard, Tabs, focusRing, metaLine, secondaryCta, stage } from "./showcase-ui";

type View = "try" | "sample";

// The engine's posterior on one axis (lib/quiz/engine.ts posteriors()): the
// log prior plus each answer's log likelihood, normalized on the grid.
function posterior(prior: number[], rows: number[][]) {
  const log = prior.map((p, g) => rows.reduce((sum, row) => sum + row[g], p));
  const max = Math.max(...log);
  const raw = log.map((l) => Math.exp(l - max));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / total);
}

function moments(grid: number[], p: number[]) {
  const mean = p.reduce((sum, w, g) => sum + w * grid[g], 0);
  const sd = Math.sqrt(p.reduce((sum, w, g) => sum + w * (grid[g] - mean) ** 2, 0));
  return { mean, sd };
}

const pts = (sd: number) => Math.round(sd * 50);

export function AtlasShowcase({ data, axisCount, traditionCount }: { data: AtlasData; axisCount: number; traditionCount: number }) {
  const [view, setView] = useState<View>("try");
  const showSample = () => {
    setView("sample");
    document.getElementById("atlas-showcase-tab-sample")?.focus();
  };
  return (
    <ShowcaseCard className="lg:col-span-3">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-10">
        <div className="flex flex-col">
          <CardHeading tool="atlas" title="Pin down exactly where you stand.">
            Not a label and not a two-axis chart. The assessment measures you on each of {axisCount} dimensions separately, tracks how
            certain each reading is, and keeps asking until it is precise. Then it measures the distance from your full profile to{" "}
            {traditionCount} political traditions.
          </CardHeading>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-slate-200 py-4 dark:border-slate-800">
            {[
              [String(axisCount), "dimensions, each scored on its own 0–100 scale"],
              [`±${pts(data.sdTarget)}`, `points: the Deep map's precision target per dimension`],
              [String(traditionCount), "traditions ranked by distance"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{value}</dd>
                <p className="mt-0.5 text-xs leading-4 text-slate-600 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">Your report shows</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {[
                "Your position on every dimension, with its margin of error",
                "The answers that moved each position the most",
                "Every tradition ranked by distance, with where you agree and where you split",
                "Your stance on each issue, policy by policy",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check size={16} className="mt-1 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            <CtaLink href="/atlas" primary>Take the Assessment</CtaLink>
            <button type="button" onClick={showSample} className={secondaryCta}>
              Explore a Sample Report <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <Tabs
            label="Atlas preview"
            idPrefix="atlas-showcase"
            value={view}
            onChange={setView}
            tabs={[{ id: "try", label: "Try a question" }, { id: "sample", label: "Sample report" }]}
          />
          <div className={`mt-3 p-4 sm:p-5 ${stage}`}>
            <div role="tabpanel" id="atlas-showcase-panel-try" aria-labelledby="atlas-showcase-tab-try" hidden={view !== "try"}>
              <TryQuestions data={data} axisCount={axisCount} onSample={showSample} />
            </div>
            <div role="tabpanel" id="atlas-showcase-panel-sample" aria-labelledby="atlas-showcase-tab-sample" hidden={view !== "sample"}>
              <SampleReport sample={data.sample} />
            </div>
          </div>
        </div>
      </div>
    </ShowcaseCard>
  );
}

function TryQuestions({ data, axisCount, onSample }: { data: AtlasData; axisCount: number; onSample: () => void }) {
  const [values, setValues] = useState<(number | null)[]>(() => data.statements.map(() => null));
  const [step, setStep] = useState(0);
  const axis = axisById[data.axis];
  const answered = values.filter((v) => v !== null).length;
  const done = answered === data.statements.length;

  const prior = useMemo(() => posterior(data.prior, []), [data.prior]);
  const current = useMemo(
    () => posterior(data.prior, values.flatMap((v, i) => (v === null ? [] : [data.statements[i].likelihood[v + 3]]))),
    [data, values],
  );
  const start = moments(data.grid, prior);
  const now = moments(data.grid, current);

  const pick = (value: number) => {
    setValues((xs) => xs.map((x, i) => (i === step ? value : x)));
    const next = values.findIndex((v, i) => v === null && i !== step);
    if (next !== -1) setStep(next);
  };
  const reset = () => {
    setValues(data.statements.map(() => null));
    setStep(0);
  };
  const statement = data.statements[step];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {axis.name} · from the real assessment
        </p>
        <ol className="flex gap-1" aria-label="Statements">
          {data.statements.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Statement ${i + 1}${values[i] !== null ? `, answered ${SCALE.find((x) => x.value === values[i])?.label}` : ""}`}
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${focusRing} ${
                  i === step
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : values[i] !== null
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                }`}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 min-h-14 text-lg leading-snug font-semibold text-balance text-slate-950 sm:text-xl dark:text-white">“{statement.text}”</p>
      <div className="mt-3">
        <AgreeScale value={values[step]} onPick={pick} size="md" />
      </div>

      <PosteriorChart grid={data.grid} prior={prior} current={answered ? current : null} axisId={data.axis} />

      <div className="mt-3 min-h-16" aria-live="polite">
        {answered === 0 ? (
          <p className={metaLine}>
            Before any answers, your position on {axis.name.toLowerCase()} could be anywhere: the estimate is ±{pts(start.sd)} points. Answer to
            see how each response narrows it.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              <span className="font-semibold text-slate-950 tabular-nums dark:text-white">
                {value100(now.mean)} · {positionLabel(data.axis, now.mean)}
              </span>
              <span className="text-slate-600 dark:text-slate-400"> ±{pts(now.sd)} points, down from ±{pts(start.sd)}</span>
            </p>
            <p className={`mt-1 ${metaLine}`}>
              {done
                ? `${now.sd > start.sd * 0.8 ? `These answers pull in different directions, so the reading is still wide.` : `Three answers narrowed one dimension to ±${pts(now.sd)} points.`} The Deep map keeps asking, ${data.perAxis[0]}–${data.perAxis[1]} statements per dimension, until each of the ${axisCount} is within ±${pts(data.sdTarget)}.`
                : `${axis.negative.label}: ${axis.negative.description.replace(/\.$/, "")}. ${axis.positive.label}: ${axis.positive.description}`}
            </p>
          </>
        )}
      </div>
      {done ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onSample} className={secondaryCta}>
            See a full sample report <ArrowRight size={15} aria-hidden />
          </button>
          <button type="button" onClick={reset} className={`${secondaryCta} text-slate-600 dark:text-slate-300`}>
            <RotateCcw size={14} aria-hidden /> Start over
          </button>
        </div>
      ) : null}
    </div>
  );
}

// The probability of each position on the axis, before answering (dashed)
// and after (filled), with the estimate's ±1 SD band underneath.
function PosteriorChart({ grid, prior, current, axisId }: { grid: number[]; prior: number[]; current: number[] | null; axisId: AtlasData["axis"] }) {
  const width = 560;
  const height = 96;
  const top = 6;
  const base = height - 4;
  const peak = Math.max(...prior, ...(current ?? []));
  const x = (g: number) => ((g + 1) / 2) * width;
  const y = (p: number) => base - (p / peak) * (base - top);
  const line = (p: number[]) => p.map((v, g) => `${g ? "L" : "M"}${x(grid[g]).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const axis = axisById[axisId];
  const now = current ? moments(grid, current) : null;
  return (
    <figure className="mt-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label={
          now
            ? `Estimated position on ${axis.name}: ${value100(now.mean)} of 100, plus or minus ${pts(now.sd)} points.`
            : `No answers yet: every position on ${axis.name} is still plausible.`
        }
      >
        <line x1={0} x2={width} y1={base} y2={base} className="stroke-slate-300 dark:stroke-slate-700" />
        <line x1={width / 2} x2={width / 2} y1={top} y2={base} strokeDasharray="2 3" className="stroke-slate-300 dark:stroke-slate-700" />
        <path d={line(prior)} fill="none" strokeWidth={1.5} strokeDasharray="4 4" className="stroke-slate-400 dark:stroke-slate-500" />
        {current && now ? (
          <>
            <rect
              x={x(Math.max(-1, now.mean - now.sd))}
              width={x(Math.min(1, now.mean + now.sd)) - x(Math.max(-1, now.mean - now.sd))}
              y={base - 3}
              height={6}
              rx={3}
              className="fill-blue-600/25 transition-all duration-500 dark:fill-blue-400/30"
            />
            <path d={`${line(current)}L${width},${base}L0,${base}Z`} className="fill-blue-600/15 dark:fill-blue-400/15" />
            <path d={line(current)} fill="none" strokeWidth={2.25} className="stroke-blue-600 dark:stroke-blue-400" />
            <circle cx={x(now.mean)} cy={base} r={4.5} strokeWidth={2} className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-slate-900" />
          </>
        ) : null}
      </svg>
      <figcaption className="mt-1 grid grid-cols-[1fr_auto_1fr] gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
        <span>← {axis.negative.label} (0)</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="h-0 w-4 border-t-[1.5px] border-dashed border-slate-400" aria-hidden />before</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-blue-600 dark:bg-blue-400" aria-hidden />now</span>
        </span>
        <span className="text-right">{axis.positive.label} (100) →</span>
      </figcaption>
    </figure>
  );
}

const VERDICT_TEXT = { clear: "A clear closest match", lean: "Leans toward one tradition", torn: "Torn between traditions" } as const;

function SampleReport({ sample }: { sample: AtlasSample }) {
  const [group, setGroup] = useState<AxisGroup>("governance");
  const [selected, setSelected] = useState(0);
  const rows = sample.axes.filter((a) => axisById[a.axis].group === group);
  const match = sample.matches[selected];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Sample report · simulated respondent
        </span>
        <span className={metaLine}>{sample.answered} answers, Profile checkpoint</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-800 dark:text-slate-200">
        A respondent with a known position answered the real assessment. On every one of the {sample.axes.length} dimensions, the estimate
        landed within <strong className="font-semibold text-slate-950 dark:text-white">{sample.maxMiss} points</strong> of where they actually stand.
      </p>

      <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Dimension group">
        {AXIS_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${focusRing} ${
              group === g.id
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            {g.label} <span className="opacity-60">{sample.axes.filter((a) => axisById[a.axis].group === g.id).length}</span>
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => {
          const def = axisById[row.axis];
          return (
            <li key={row.axis} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{def.name}</span>
                  <span className="truncate text-slate-500 dark:text-slate-400">{def.negative.label} ↔ {def.positive.label}</span>
                </div>
                <AxisTrack
                  axis={row.axis}
                  size="sm"
                  band={[Math.max(-1, row.mean - row.sd), Math.min(1, row.mean + row.sd)]}
                  markers={[
                    { value: row.mean, label: "Estimate", shape: "ring", color: "#2563eb" },
                    { value: row.truth, label: "True position", shape: "diamond" },
                  ]}
                />
              </div>
              <span className="w-16 text-right text-xs text-slate-600 tabular-nums dark:text-slate-400">
                <strong className="text-sm font-semibold text-slate-950 dark:text-white">{value100(row.mean)}</strong> ±{pts(row.sd)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span><span className="mr-1 inline-block size-2 rounded-full border-2 border-blue-600" aria-hidden />Estimate, with ±1 SD band</span>
        <span><span className="mr-1 inline-block size-2 rotate-45 bg-slate-700 dark:bg-slate-200" aria-hidden />True position</span>
      </p>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{VERDICT_TEXT[sample.verdict]}</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {sample.matches.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${focusRing} ${
                  selected === i
                    ? "border-slate-950 bg-white dark:border-white dark:bg-slate-900"
                    : "border-slate-200 bg-white/60 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-950 dark:text-white">
                  <FamilyDot family={m.family} className="size-2" />
                  <span className="truncate">{m.name}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800">
                    <span className="block h-full rounded-full bg-slate-900 dark:bg-slate-100" style={{ width: `${m.match}%` }} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">{m.match}%</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {match ? (
          <p className="mt-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <Link href={`/atlas/philosophies/${match.id}`} className={`font-semibold text-blue-700 hover:underline dark:text-blue-300 ${focusRing}`}>
              {match.name}
            </Link>{" "}
            sits closest on {match.closest.map((c) => axisById[c.axis].name.toLowerCase()).join(" and ")}, and furthest on{" "}
            {match.furthest.map((c) => `${axisById[c.axis].name.toLowerCase()} (${pointsApart(c.gap)} pts apart)`).join(" and ")}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
