"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { startQuizAction, startQuizWithAnswersAction } from "@/lib/actions/quiz";
import { computeResult } from "@/lib/quiz/results";
import { statementById, type QuizAnswer } from "@/lib/quiz/engine";
import { ideologies } from "@/lib/quiz/ideologies";
import { CELL, FAMILY_ORDER, familyLayout, type Spot } from "@/lib/quiz/family-layout";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { QUIZ_MODES, quizModeIds, type QuizModeId } from "@/lib/quiz/modes";
import { axisIds, type IdeologyFamily, type IssueId } from "@/lib/quiz/types";
import { AgreeScale } from "./agree-scale";
import { AtlasMark } from "./atlas-mark";
import { TraditionPanel } from "./tradition-panel";
import { card, ghostButton, primaryButton } from "./styles";

// The opening questions: one economic, one social, one on how a country should
// be governed, so each answer moves the map in a different direction. They're
// real bank statements and carry over into the quiz. Chosen to hook: concrete,
// genuinely contested, and something people have a gut reaction to, with the
// most arresting one first.
const OPENERS = ["redistribution.02", "social.13", "democracy.12"];

// How sharply traditions fade as answers rule them out (squared distance on
// the answered axes).
const FIT_WIDTH = 0.08;

// "54 questions · 10–12 min", from the mode's own settings. The deep map is
// adaptive, so its count is approximate.
const length = (m: QuizModeId) =>
  `${m === "deep" ? "~" : ""}${QUIZ_MODES[m].targetScreens} questions · ${QUIZ_MODES[m].minutes.replace(/^about /, "").replace(/minutes$/, "min")}`;

// Inline-style numbers are rounded so server-rendered styles match the client
// exactly: browsers store long floats at lower precision, which React reports
// as a hydration mismatch. Layout positions arrive already rounded.
const round = (v: number, places: number) => Number(v.toFixed(places));
const pct = (v: number) => `${v}%`;

// Halo diameter, as a share of the plot's width. A tradition defined on every
// dimension sits tightly; one defined by only a few core dimensions is a broad
// tent whose adherents spread further, so its halo is wider.
const haloSize = (coreAxes: number) => round(4 + 6 * (1 - (Math.min(Math.max(coreAxes, 2), axisIds.length) - 2) / (axisIds.length - 2)), 2);

// "#tradition=<id>" opens that tradition's panel, so it can be linked to.
const HASH = /^#tradition=([\w-]+)$/;
const fromHash = () => {
  const id = HASH.exec(window.location.hash)?.[1];
  return id && ideologies.some((i) => i.id === id) ? id : null;
};

// Page-load entrance: each block rises in turn (.quiz-enter, globals.css).
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function QuizHero({ mode, topic, topicName }: { mode: QuizModeId; topic: IssueId | null; topicName: string | null }) {
  const [values, setValues] = useState<number[]>([]);
  const step = values.length;
  const done = step >= OPENERS.length;
  const answers: QuizAnswer[] = useMemo(() => values.map((value, i) => ({ kind: "statement", id: OPENERS[i], value })), [values]);

  // Fit of each tradition on the axes answered so far (1 = best).
  const fit = useMemo(() => {
    const answered = computeResult(answers).axes.filter((a) => a.answered > 0);
    const raw = ideologies.map((i) =>
      answered.length === 0 ? 1 : Math.exp(-answered.reduce((s, a) => s + (i.position[a.axis] - a.mean) ** 2, 0) / answered.length / FIT_WIDTH),
    );
    const max = Math.max(...raw);
    return raw.map((w) => w / max);
  }, [answers]);

  // Traditions grouped by family (lib/quiz/family-layout.ts). Once you've
  // answered, the best fits in each family move to its cluster's centre.
  const ranked = useMemo(
    () => (step === 0 ? null : ideologies.map((i, n) => ({ i, w: fit[n] })).sort((a, b) => b.w - a.w)),
    [fit, step],
  );
  const positions = useMemo(() => familyLayout(ranked ? ranked.map(({ i }) => i.id) : null), [ranked]);
  const closest = ranked ? ranked.slice(0, 3) : [];

  // The open tradition panel, kept in step with the URL hash.
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => {
      const id = fromHash();
      setSelected(id);
      if (id) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        mapRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
    };
    if (window.location.hash) sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const openTradition = useCallback((id: string) => {
    setSelected(id);
    history.replaceState(null, "", `#tradition=${id}`);
  }, []);
  const closeTradition = useCallback(() => {
    setSelected(null);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Starting the quiz from anywhere on the page keeps any opener answers.
  const start = (m: QuizModeId) => () => (answers.length ? startQuizWithAnswersAction(m, topic, answers) : startQuizAction(m, topic));

  return (
    <section>
      <header style={delay(0)} className="quiz-enter flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3.5">
          <AtlasMark size={44} animated className="text-slate-950 dark:text-white" />
          <h1 className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl dark:text-white">
            Worldview Atlas. <span className="text-slate-400 dark:text-slate-500">Find your place on the map.</span>
          </h1>
        </div>
      </header>
      <p style={delay(60)} className="quiz-enter mt-3 max-w-2xl text-[15px] leading-6 text-slate-600 dark:text-slate-300">
        {topicName ? `Start with three quick reactions, then the quiz picks up with ${topicName}.` : "Three quick reactions put you on the map. They count toward the full quiz."}{" "}
        <span className="text-slate-500 dark:text-slate-400">
          {QUIZ_MODES[mode].shortName}: {length(mode)}, saved as you go.
        </span>
      </p>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16">
        <div style={delay(120)} className="quiz-enter">
          {done ? (
            <div key="done" className="quiz-step">
              <p className="text-sm text-slate-500 dark:text-slate-400">Your closest traditions so far</p>
              <h2 className="mt-2 text-3xl leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-slate-950 sm:text-4xl dark:text-white">
                {closest.map(({ i }, n) => (
                  <span key={i.id}>
                    {n > 0 && <span className="text-slate-300 dark:text-slate-600">{n === closest.length - 1 ? " & " : ", "}</span>}
                    <button type="button" onClick={() => openTradition(i.id)} className="whitespace-nowrap underline decoration-slate-200 decoration-2 underline-offset-[6px] transition-colors hover:decoration-current dark:decoration-slate-700">
                      <span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ backgroundColor: familyColor(i.family) }} />
                      {i.name}
                    </button>
                  </span>
                ))}
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-6 text-slate-600 dark:text-slate-300">
                That&rsquo;s three answers on three of {axisIds.length} dimensions. Keep going to place yourself on all of them, issue by issue.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <form action={start(mode)}>
                  <Submit className={primaryButton} pendingLabel="Starting…">
                    Continue with the {QUIZ_MODES[mode].shortName.toLowerCase()}
                    <span className="font-normal opacity-60">· {length(mode)}</span>
                    <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </Submit>
                </form>
                <button type="button" onClick={() => setValues([])} className={ghostButton}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Start over
                </button>
              </div>
              <ModeLinks label="Or go" current={mode} render={start} />
            </div>
          ) : (
            <div key={step} className="quiz-step">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  {OPENERS.map((_, i) => (
                    <span key={i} className={`h-1 w-8 rounded-full transition-colors duration-300 ${i < step ? "bg-slate-950 dark:bg-white" : i === step ? "bg-slate-400 dark:bg-slate-500" : "bg-slate-200 dark:bg-slate-800"}`} />
                  ))}
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {step + 1} of {OPENERS.length}
                </span>
              </div>
              <h2 className="mt-5 min-h-30 text-3xl leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-slate-950 sm:min-h-35 sm:text-4xl dark:text-white">
                {statementById.get(OPENERS[step])!.text}
              </h2>
              <div className="mt-7 max-w-xl">
                <AgreeScale value={null} onPick={(v) => setValues((xs) => [...xs, v])} />
              </div>
              <ModeLinks label="Or skip ahead to" current={null} render={start} />
            </div>
          )}
        </div>

        <div ref={mapRef} style={delay(200)} className="quiz-enter scroll-mt-24">
          <IdeologyMap
            positions={positions}
            fit={fit}
            closest={closest.map(({ i }) => i.id)}
            leading={closest[0]?.i.family ?? null}
            selected={selected}
            onSelect={openTradition}
            panel={
              selected && (
                <TraditionPanel
                  id={selected}
                  onClose={closeTradition}
                  onSelect={openTradition}
                  cta={(label) => (
                    <form action={start(mode)}>
                      <Submit className={`${primaryButton} w-full`} pendingLabel="Starting…">
                        {label}
                        <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                      </Submit>
                    </form>
                  )}
                />
              )
            }
          />
        </div>
      </div>
    </section>
  );
}

function ModeLinks({ label, current, render }: { label: string; current: QuizModeId | null; render: (m: QuizModeId) => () => Promise<void> }) {
  return (
    <div className="mt-8 text-sm text-slate-500 dark:text-slate-400">
      <p>{label}</p>
      <div className="mt-1 -ml-2 flex flex-wrap gap-x-2 gap-y-0.5">
        {quizModeIds
          .filter((m) => m !== current)
          .map((m) => (
            <form key={m} action={render(m)} title={`${QUIZ_MODES[m].name}, ${QUIZ_MODES[m].minutes}`}>
              <Submit className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-950/5 hover:text-slate-950 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white" pendingLabel="Starting…">
                {QUIZ_MODES[m].shortName} <span className="font-normal text-slate-400 dark:text-slate-500">{length(m)}</span>
              </Submit>
            </form>
          ))}
      </div>
    </div>
  );
}

function Submit({ className, pendingLabel, children }: { className: string; pendingLabel: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

// Every tradition, clustered by family. Traditions that fit your answers stay
// bright, the rest fade, and the family of your closest match is tinted.
// Click a tradition to open its panel.
function IdeologyMap({
  positions,
  fit,
  closest,
  leading,
  selected,
  onSelect,
  panel,
}: {
  positions: Record<string, Spot>;
  fit: number[];
  closest: string[];
  leading: IdeologyFamily | null;
  selected: string | null;
  onSelect: (id: string) => void;
  panel: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredIdeology = !selected ? ideologies.find((i) => i.id === hovered) : undefined;
  return (
    <div className={`${card} relative p-3 sm:p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 pb-3">
        <p className="text-sm font-medium text-slate-950 dark:text-white">{ideologies.length} political traditions, grouped by family</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Click any dot to read about it</p>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-950/60">
        {/* Family cells: a label, and a soft tint on the family you're closest to. */}
        {FAMILY_ORDER.map((family, n) => {
          const isLeading = leading === family;
          const count = ideologies.filter((i) => i.family === family).length;
          return (
            <div
              key={family}
              className="absolute p-1"
              style={{ left: pct(round((n % 3) * CELL, 2)), top: pct(round(Math.floor(n / 3) * CELL, 2)), width: pct(round(CELL, 2)), height: pct(round(CELL, 2)) }}
            >
              <div
                className="h-full w-full rounded-xl transition-colors duration-500"
                style={{ backgroundColor: isLeading ? `${familyColor(family)}14` : "transparent" }}
              >
                <p
                  className={`flex items-center gap-1.5 px-2 pt-1.5 text-[11px] font-medium transition-colors sm:text-xs ${
                    isLeading ? "text-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: familyColor(family) }} />
                  <span className="truncate">{FAMILIES[family].label}</span>
                  <span className="text-slate-400 tabular-nums dark:text-slate-500">{count}</span>
                </p>
              </div>
            </div>
          );
        })}

        {/* Halos first, so every solid dot sits above every halo. Only the
            hovered or selected tradition's halo shows. */}
        {ideologies.map((i) => {
          const p = positions[i.id];
          const d = haloSize(i.core?.length ?? axisIds.length);
          const on = hovered === i.id || selected === i.id;
          return (
            <span
              key={`halo:${i.id}`}
              aria-hidden="true"
              // Width and height set separately (the plot is square) rather
              // than via aspect-ratio, which some browsers ignore on absolutely
              // positioned elements.
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-200 ease-out"
              style={{ left: pct(p.x), top: pct(p.y), width: `${d}%`, height: `${d}%`, backgroundColor: familyColor(i.family), opacity: on ? 0.22 : 0 }}
            />
          );
        })}

        {ideologies.map((i, n) => {
          const p = positions[i.id];
          const w = fit[n];
          // A share of the plot's width, so dots keep their proportions on
          // small screens: about 7–16px at the desktop map's size.
          const size = pct(round(1.3 + 1.7 * w, 2));
          return (
            <button
              key={i.id}
              type="button"
              aria-label={`${i.name}: read more`}
              aria-pressed={selected === i.id}
              onClick={() => onSelect(i.id)}
              onMouseEnter={() => setHovered(i.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i.id)}
              onBlur={() => setHovered(null)}
              className="quiz-map-dot absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ring-2 ring-white transition-all duration-700 ease-out hover:scale-125 focus-visible:outline-2 focus-visible:outline-slate-950 dark:ring-slate-950 dark:focus-visible:outline-white"
              style={{ left: pct(p.x), top: pct(p.y), width: size, height: size, backgroundColor: familyColor(i.family), opacity: round(0.16 + 0.84 * w, 2), animationDelay: `${Math.min(n * 6, 420)}ms` }}
            />
          );
        })}

        {[...new Set([...closest, ...(selected ? [selected] : [])])].map((id) => {
          const p = positions[id];
          const i = ideologies.find((x) => x.id === id)!;
          return (
            <span
              key={`ring:${id}`}
              aria-hidden="true"
              // quiz-fade, not quiz-step: a transform animation would override
              // the centring translate.
              className="quiz-fade pointer-events-none absolute size-[5.2%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-700 ease-out"
              style={{ left: pct(p.x), top: pct(p.y), borderColor: familyColor(i.family) }}
            />
          );
        })}

        {hoveredIdeology && (
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-lg bg-white/95 p-3 text-xs shadow-lg ring-1 ring-slate-950/8 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10">
            <p className="font-semibold text-slate-950 dark:text-white">{hoveredIdeology.name}</p>
            <p className="mt-0.5 line-clamp-2 leading-5 text-slate-600 dark:text-slate-300">{hoveredIdeology.description}</p>
          </div>
        )}
      </div>
      <p className="mt-3 px-1 text-xs text-slate-500 dark:text-slate-400">
        Hover a tradition to see its spread: a wider glow means it&rsquo;s defined by fewer core issues, so its adherents vary more.
      </p>
      {panel}
    </div>
  );
}
