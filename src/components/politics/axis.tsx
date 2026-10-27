// Political axes, drawn one way everywhere: the track runs from the
// negative pole (0) to the positive pole (100) with a marked "Balanced"
// midpoint, both poles are always labelled, and every marker carries a
// shape as well as a colour so traditions in the same family stay apart.
// No hooks, so server and client components both use these.

import type { ReactNode } from "react";
import { axisById } from "@/lib/quiz/axes";
import type { AxisId } from "@/lib/quiz/types";
import { AXIS_ICON } from "@/lib/politics/icons";
import {
  directionFrom,
  GAP_LABEL,
  gapSize,
  pointsApart,
  positionLabel,
  value100,
  type GapSize,
} from "@/lib/politics/axis-language";
import { ExpandableAnalysis } from "./expandable";
import { chartLabel, labelText, metaText } from "./type";

export type MarkerShape = "ring" | "diamond" | "square" | "triangle";

export interface AxisMarker {
  value: number;
  label: string; // "You", "Groyper movement"
  shape: MarkerShape;
  color?: string; // unset: neutral slate
}

// -1…+1 to a percentage along a track, rounded so server and client match.
export const trackPct = (x: number) => Number((((Math.max(-1, Math.min(1, x)) + 1) / 2) * 100).toFixed(2));

const GAP_TINT: Record<GapSize, string> = {
  close: "bg-slate-400/70 dark:bg-slate-500/70",
  moderate: "bg-amber-500/70",
  clear: "bg-disagree-500/70",
  wide: "bg-disagree-600/80",
};

// One marker glyph, also used in legends.
export function MarkerGlyph({ shape, color, size = 14 }: { shape: MarkerShape; color?: string; size?: number }) {
  const fill = color ?? "currentColor";
  const neutral = color ? "" : "text-slate-700 dark:text-slate-200";
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className={`shrink-0 overflow-visible ${neutral}`}>
      {shape === "ring" ? (
        <circle cx="8" cy="8" r="5.5" strokeWidth="3" stroke={fill} className="fill-white dark:fill-slate-950" />
      ) : shape === "diamond" ? (
        <rect
          x="3"
          y="3"
          width="10"
          height="10"
          transform="rotate(45 8 8)"
          fill={fill}
          strokeWidth="2"
          className="stroke-white dark:stroke-slate-950"
        />
      ) : shape === "square" ? (
        <rect
          x="2.5"
          y="2.5"
          width="11"
          height="11"
          rx="1.5"
          fill={fill}
          strokeWidth="2"
          className="stroke-white dark:stroke-slate-950"
        />
      ) : (
        <polygon
          points="8,1.5 15,14 1,14"
          fill={fill}
          strokeWidth="2"
          strokeLinejoin="round"
          className="stroke-white dark:stroke-slate-950"
        />
      )}
    </svg>
  );
}

export function MarkerLegend({
  markers,
  className = "",
}: {
  markers: Pick<AxisMarker, "label" | "shape" | "color">[];
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${chartLabel} ${className}`}>
      {markers.map((m) => (
        <li key={m.label} className="inline-flex items-center gap-1.5">
          <MarkerGlyph shape={m.shape} color={m.color} />
          <span className="text-slate-800 dark:text-slate-200">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

// A sentence a screen reader can use in place of the drawing.
export function axisSentence(axis: AxisId, markers: AxisMarker[]): string {
  const def = axisById[axis];
  const parts = markers.map((m) => `${m.label}: ${positionLabel(axis, m.value)} (${value100(m.value)})`);
  return `${def.name}, from ${def.negative.label} (0) to ${def.positive.label} (100). ${parts.join("; ")}.`;
}

// The bare track: midpoint tick, optional range band, optional fill from
// the centre to the first marker, an optional segment joining the first
// two markers (tinted by how far apart they are), then the markers.
export function AxisTrack({
  axis,
  markers,
  band,
  fill,
  connect = false,
  size = "md",
  animate = false,
  delay = 0,
}: {
  axis: AxisId;
  markers: AxisMarker[];
  band?: [number, number];
  fill?: string;
  connect?: boolean;
  size?: "sm" | "md";
  animate?: boolean;
  delay?: number;
}) {
  const md = size === "md";
  const first = markers[0];
  const second = markers[1];
  const glyph = md ? 16 : 14;
  return (
    <div role="img" aria-label={axisSentence(axis, markers)} className={`relative ${md ? "h-6" : "h-5"}`}>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200/80 dark:bg-slate-800" />
      <div className="absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 dark:bg-slate-500" />
      {band && (
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full"
          style={{
            left: `${trackPct(band[0])}%`,
            width: `${trackPct(band[1]) - trackPct(band[0])}%`,
            backgroundColor: `${fill ?? "#64748b"}2e`,
          }}
        />
      )}
      {fill && first && (
        <div
          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${animate ? "wv-grow" : ""}`}
          style={{
            left: `${Math.min(50, trackPct(first.value))}%`,
            width: `${Math.abs(trackPct(first.value) - 50)}%`,
            backgroundColor: fill,
            transformOrigin: first.value < 0 ? "right center" : "left center",
            ["--d" as string]: `${delay}ms`,
          }}
        />
      )}
      {connect && first && second && (
        <div
          className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${GAP_TINT[gapSize(second.value - first.value)]}`}
          style={{
            left: `${Math.min(trackPct(first.value), trackPct(second.value))}%`,
            width: `${Math.abs(trackPct(first.value) - trackPct(second.value))}%`,
          }}
        />
      )}
      {/* Later markers draw first so the first (usually "You") stays on top. */}
      {[...markers].reverse().map((m, i) => (
        <span
          key={m.label}
          title={`${m.label}: ${positionLabel(axis, m.value)} (${value100(m.value)})`}
          className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 ${animate ? "wv-marker" : ""}`}
          style={{
            left: `${trackPct(m.value)}%`,
            ["--i" as string]: markers.length - i,
            ["--d" as string]: `${delay}ms`,
          }}
        >
          <MarkerGlyph shape={m.shape} color={m.color} size={glyph} />
        </span>
      ))}
    </div>
  );
}

// Pole labels under a track: "← Open", "Balanced", "Restrictive →".
export function AxisPoles({ axis, className = "" }: { axis: AxisId; className?: string }) {
  const def = axisById[axis];
  return (
    <div className={`mt-1 grid grid-cols-[1fr_auto_1fr] gap-2 ${chartLabel} ${className}`}>
      <span className="truncate" title={def.negative.description}>
        <span aria-hidden>← </span>
        {def.negative.label}
      </span>
      <span className="text-slate-500 dark:text-slate-500">Balanced</span>
      <span className="truncate text-right" title={def.positive.description}>
        {def.positive.label}
        <span aria-hidden> →</span>
      </span>
    </div>
  );
}

export function AxisName({ axis, className = "" }: { axis: AxisId; className?: string }) {
  const def = axisById[axis];
  const Icon = AXIS_ICON[axis];
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${labelText} ${className}`}>
      <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="truncate">{def.name}</span>
    </span>
  );
}

// A full axis: name, the position in words (and as a 0–100 figure), the
// track with both poles, and optional analysis behind a toggle. A
// non-defining axis is shown as modeled; an unmeasured one says so.
export function PoliticalAxis({
  axis,
  markers,
  band,
  fill,
  defining = true,
  showValue = true,
  extra,
  detail,
  detailLabel = "How this is placed",
  id,
  animate = false,
  delay = 0,
  className = "",
}: {
  axis: AxisId;
  markers: AxisMarker[]; // the first is the subject whose position is named
  band?: [number, number];
  fill?: string;
  defining?: boolean;
  showValue?: boolean;
  extra?: ReactNode; // beside the position, e.g. a confidence meter
  detail?: ReactNode;
  detailLabel?: string;
  id?: string;
  animate?: boolean;
  delay?: number;
  className?: string;
}) {
  const subject = markers[0];
  return (
    <div id={id} className={`scroll-mt-36 ${defining ? "" : "opacity-80"} ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <AxisName axis={axis} />
        <span className="flex items-center gap-2 text-sm">
          {!defining && (
            <span
              className="rounded-full border border-dashed border-slate-300 px-2 py-px text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400"
              title="Not one of this tradition's defining axes: its position here is modeled from related positions"
            >
              Modeled
            </span>
          )}
          {subject ? (
            <span className="font-semibold text-slate-950 dark:text-white">
              {positionLabel(axis, subject.value)}
              {showValue && (
                <span className="ml-1.5 font-normal text-slate-600 tabular-nums dark:text-slate-400">
                  {value100(subject.value)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-600 dark:text-slate-400">Not measured</span>
          )}
          {extra}
        </span>
      </div>
      <div className="mt-1.5">
        {subject ? (
          <AxisTrack axis={axis} markers={markers} band={band} fill={fill} animate={animate} delay={delay} />
        ) : (
          <div className="h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
        )}
        <AxisPoles axis={axis} />
      </div>
      {detail && (
        <ExpandableAnalysis
          summary={<span className={metaText}>{detailLabel}</span>}
          chevron="start"
          className="mt-1.5"
          summaryClassName="py-1"
        >
          <div className="mt-1 pl-6 text-sm leading-6 text-slate-700 dark:text-slate-300">{detail}</div>
        </ExpandableAnalysis>
      )}
    </div>
  );
}

// A compact comparison row: the axis, both positions on one track joined by
// a segment tinted by the gap, and the distance in points. Opens to
// `detail` when given.
export function AxisComparisonRow({
  axis,
  you,
  them,
  detail,
  animate = false,
  index = 0,
}: {
  axis: AxisId;
  you: AxisMarker;
  them: AxisMarker;
  detail?: ReactNode;
  animate?: boolean;
  index?: number;
}) {
  const gap = them.value - you.value;
  const dir = directionFrom(axis, you.value, them.value);
  const row = (
    <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[12rem_minmax(0,1fr)_10rem]">
      <AxisName axis={axis} />
      <span className="text-right md:order-3">
        <span className="block text-sm font-semibold text-slate-950 tabular-nums dark:text-white">
          {pointsApart(gap)} pts apart
        </span>
        <span className={`line-clamp-2 block max-w-40 ${chartLabel}`}>
          {dir ? `${them.label}: ${dir}` : GAP_LABEL[gapSize(gap)]}
        </span>
      </span>
      <span className="col-span-2 md:order-2 md:col-span-1">
        <AxisTrack axis={axis} markers={[you, them]} connect size="sm" animate={animate} delay={index * 70} />
      </span>
    </span>
  );
  if (!detail) return <div className="py-2.5">{row}</div>;
  return (
    <ExpandableAnalysis summary={row} summaryClassName="px-2 py-2.5 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <div className="mb-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <AxisPoles axis={axis} className="mb-3" />
        {detail}
      </div>
    </ExpandableAnalysis>
  );
}
