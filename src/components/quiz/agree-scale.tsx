"use client";

import { useState } from "react";

// Disagree on the left, agree on the right, matching keys 1–7.
export const SCALE: { value: number; label: string }[] = [
  { value: -3, label: "Strongly disagree" },
  { value: -2, label: "Disagree" },
  { value: -1, label: "Somewhat disagree" },
  { value: 0, label: "Neutral" },
  { value: 1, label: "Somewhat agree" },
  { value: 2, label: "Agree" },
  { value: 3, label: "Strongly agree" },
];

// Segment colours by state. At rest the tint deepens toward each end, so the
// track reads as one gradient; "lit" segments run from the centre out to the
// hovered or chosen point, so strength reads as how far you went.
const TONES = {
  disagree: {
    rest: { 1: "bg-disagree-500/12 text-disagree-600/70 dark:text-disagree-300/70", 2: "bg-disagree-500/20 text-disagree-600/70 dark:text-disagree-300/70", 3: "bg-disagree-500/28 text-disagree-600/80 dark:text-disagree-300/70" },
    lit: "bg-disagree-500/45 text-disagree-700 dark:text-disagree-200",
    hot: "bg-disagree-500 text-white",
    chosen: "bg-disagree-600 text-white dark:bg-disagree-500",
  },
  agree: {
    rest: { 1: "bg-agree-500/12 text-agree-600/70 dark:text-agree-300/70", 2: "bg-agree-500/20 text-agree-600/70 dark:text-agree-300/70", 3: "bg-agree-500/28 text-agree-600/80 dark:text-agree-300/70" },
    lit: "bg-agree-500/45 text-agree-700 dark:text-agree-200",
    hot: "bg-agree-500 text-white",
    chosen: "bg-agree-600 text-white dark:bg-agree-500",
  },
  neutral: {
    rest: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    hot: "bg-slate-400 text-white dark:bg-slate-500",
    chosen: "bg-slate-500 text-white dark:bg-slate-400 dark:text-slate-950",
  },
} as const;

function segmentClass(v: number, active: number | null, chosen: boolean): string {
  if (v === 0) {
    const t = TONES.neutral;
    return chosen ? t.chosen : active === 0 ? t.hot : t.rest;
  }
  const t = v < 0 ? TONES.disagree : TONES.agree;
  if (chosen) return t.chosen;
  if (active === v) return t.hot;
  const lit = active !== null && Math.sign(active) === Math.sign(v) && Math.abs(v) <= Math.abs(active);
  return lit ? t.lit : t.rest[Math.abs(v) as 1 | 2 | 3];
}

// The seven-point agreement scale as one segmented track: a live label for
// the hovered or chosen point above, the end labels below.
export function AgreeScale({
  value,
  onPick,
  disabled,
  size = "lg",
}: {
  value: number | null | undefined;
  onPick: (value: number) => void;
  disabled?: boolean;
  size?: "lg" | "md";
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const chosen = typeof value === "number" ? value : null;
  const active = hovered ?? chosen;
  const activeLabel = SCALE.find((s) => s.value === active)?.label;

  return (
    <div>
      <p
        className={`h-6 text-[15px] font-semibold transition-colors ${size === "lg" ? "mb-3" : "mb-2"} ${
          active === null
            ? "text-slate-500 dark:text-slate-400"
            : active > 0
              ? "text-agree-600 dark:text-agree-400"
              : active < 0
                ? "text-disagree-600 dark:text-disagree-400"
                : "text-slate-700 dark:text-slate-200"
        }`}
        aria-live="polite"
      >
        {activeLabel ?? "How much do you agree?"}
      </p>
      <div
        role="radiogroup"
        aria-label="How much do you agree?"
        className={`flex gap-1 ${size === "lg" ? "h-14 sm:h-16" : "h-12"}`}
        onMouseLeave={() => setHovered(null)}
      >
        {SCALE.map((s, i) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={chosen === s.value}
            aria-label={`${s.label} (key ${i + 1})`}
            title={s.label}
            disabled={disabled}
            onClick={() => onPick(s.value)}
            onMouseEnter={() => setHovered(s.value)}
            onFocus={() => setHovered(s.value)}
            onBlur={() => setHovered(null)}
            className={`flex min-w-0 items-end justify-center pb-1.5 font-mono text-[11px] font-medium transition-colors duration-150 first:rounded-l-xl last:rounded-r-xl focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:cursor-wait dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-950 ${
              s.value === 0 ? "flex-[0.8] rounded-md" : "flex-1 rounded-md"
            } ${segmentClass(s.value, active, chosen === s.value)}`}
          >
            <span aria-hidden="true" className="opacity-70">
              {i + 1}
            </span>
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-3 items-start text-xs font-medium ${size === "lg" ? "mt-2.5 sm:text-sm" : "mt-2"}`}>
        <span className="text-disagree-600 dark:text-disagree-400">Strongly disagree</span>
        <span className="text-center text-slate-500 dark:text-slate-400">Neutral</span>
        <span className="text-right text-agree-600 dark:text-agree-400">Strongly agree</span>
      </div>
    </div>
  );
}

// A display copy for explanations: hover works, clicks do nothing.
export function AgreeScalePreview() {
  return <AgreeScale value={2} onPick={() => {}} size="md" />;
}
