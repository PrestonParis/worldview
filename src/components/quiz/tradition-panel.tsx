"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { ideologies } from "@/lib/quiz/ideologies";
import { axisById } from "@/lib/quiz/axes";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { AXIS_HUBS, type Hub } from "@/lib/quiz/hubs";
import { LENS_VALUE_LABELS } from "@/lib/quiz/lenses";
import { axisIds, type AxisId, type Ideology } from "@/lib/quiz/types";

const LENS_LABELS: Record<string, string> = {
  // authority
  elected: "Elected government",
  assemblies: "Citizen assemblies",
  party: "One ruling party",
  leader: "A strong leader",
  monarch: "A monarch",
  clergy: "Religious authority",
  experts: "Experts",
  military: "The military",
  owners: "Property owners",
  "no-state": "No state",
  // nation
  civic: "Shared citizenship",
  ethnic: "Shared ancestry",
  religious: "Shared religion",
  civilizational: "Shared culture",
  class: "Class over nation",
  // tradition
  none: "Secular law",
  pluralist: "No favored faith",
};
const lensLabel = (v: string) => LENS_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);

const pct = (x: number) => `${Number((((Math.max(-1, Math.min(1, x)) + 1) / 2) * 100).toFixed(2))}%`;

// Closest traditions by RMS distance over every dimension (as scripts/quiz-audit.ts).
function nearest(of: Ideology, n: number): Ideology[] {
  const d = (b: Ideology) => Math.sqrt(axisIds.reduce((s, a) => s + (of.position[a] - b.position[a]) ** 2, 0) / axisIds.length);
  return ideologies.filter((i) => i.id !== of.id).sort((x, y) => d(x) - d(y)).slice(0, n);
}

// Detail for one tradition, over the map on desktop and as a bottom sheet on
// small screens. Closes on Esc, the close button, or a click outside.
export function TraditionPanel({
  id,
  onClose,
  onSelect,
  cta,
}: {
  id: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  cta: (label: string) => React.ReactNode;
}) {
  const ideology = ideologies.find((i) => i.id === id);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Large screens: over the map, positioned in its card. Small screens: a
  // bottom sheet rendered at the document root, so no transformed ancestor
  // can capture its fixed positioning.
  const [desktop] = useState(() => window.matchMedia("(min-width: 64rem)").matches);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [onClose]);

  if (!ideology) return null;
  const core = ideology.core ?? axisIds;
  const others = axisIds.filter((a) => !core.includes(a));
  const hubs = [...new Map(core.flatMap((a) => (AXIS_HUBS[a] ? [[AXIS_HUBS[a]!.href, AXIS_HUBS[a]!] as [string, Hub]] : []))).values()];
  const lenses = (
    [
      ["Governed by", ideology.authority],
      ["Nation defined by", ideology.nation],
      ["Law shaped by", ideology.tradition],
      ["Existing order", ideology.change?.map((v) => LENS_VALUE_LABELS.change[v])],
      ["Communist states", ideology.legacy?.map((v) => LENS_VALUE_LABELS.legacy[v])],
    ] as const
  ).filter(([, v]) => v && v.length);
  const people = ideology.people?.filter((v) => v !== "none").map((v) => LENS_VALUE_LABELS.people[v]);

  const panel = (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="quiz-fade fixed inset-0 z-[60] bg-slate-950/40 lg:absolute lg:z-40 lg:rounded-xl lg:bg-white/40 dark:lg:bg-slate-950/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tradition-panel-title"
        className="quiz-panel fixed inset-x-0 bottom-0 z-[61] flex max-h-[78dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-950/8 lg:absolute lg:z-50 lg:inset-y-2 lg:right-2 lg:bottom-auto lg:left-auto lg:max-h-none lg:w-[22rem] lg:rounded-xl dark:bg-slate-900 dark:ring-white/10"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${familyColor(ideology.family)}1f`, color: familyColor(ideology.family) }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: familyColor(ideology.family) }} />
              {FAMILIES[ideology.family].label}
            </span>
            <h3 id="tradition-panel-title" className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              {ideology.name}
            </h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div key={ideology.id} className="quiz-step min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{ideology.description}</p>

          <Link
            href={`/atlas/philosophies/${ideology.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 dark:text-white dark:decoration-slate-600"
          >
            Open full philosophy page →
          </Link>

          <p className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">Defined by</p>
          <div className="mt-2 space-y-3">
            {core.map((a) => (
              <AxisBar key={a} axis={a} at={ideology.position[a]} color={familyColor(ideology.family)} />
            ))}
          </div>
          {others.length > 0 && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
                <span className="group-open:hidden">Show the other {others.length} dimensions</span>
                <span className="hidden group-open:inline">Hide the other dimensions</span>
              </summary>
              <div className="mt-3 space-y-3 opacity-80">
                {others.map((a) => (
                  <AxisBar key={a} axis={a} at={ideology.position[a]} color={familyColor(ideology.family)} muted />
                ))}
              </div>
            </details>
          )}

          {(lenses.length > 0 || !!people?.length) && (
            <dl className="mt-5 space-y-1.5 text-sm">
              {lenses.map(([label, values]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{values!.map(lensLabel).join(", ")}</dd>
                </div>
              ))}
              {!!people?.length && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0 text-slate-500 dark:text-slate-400">People first</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{people.join(", ")}</dd>
                </div>
              )}
            </dl>
          )}

          <p className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">Nearest traditions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nearest(ideology, 3).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: familyColor(n.family) }} />
                {n.name}
              </button>
            ))}
          </div>

          {hubs.length > 0 && (
            <>
              <p className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">Go deeper on Worldview</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {hubs.map((h) => (
                  <li key={h.href}>
                    <a href={h.href} className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-950 dark:text-white dark:decoration-slate-600 dark:hover:decoration-white">
                      {h.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="border-t border-slate-950/6 px-5 py-4 dark:border-white/8">{cta("See how close you are")}</div>
      </div>
    </>
  );
  return desktop ? panel : createPortal(panel, document.body);
}

function AxisBar({ axis, at, color, muted }: { axis: AxisId; at: number; color: string; muted?: boolean }) {
  const def = axisById[axis];
  return (
    <div>
      <div className="flex justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate">{def.negative.label}</span>
        <span className={`truncate ${muted ? "" : "font-medium text-slate-800 dark:text-slate-200"}`}>{def.name}</span>
        <span className="truncate text-right">{def.positive.label}</span>
      </div>
      <div className="relative mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-800">
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-900"
          style={{ left: pct(at), backgroundColor: color }}
        />
      </div>
    </div>
  );
}
