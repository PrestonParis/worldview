import type { ReactNode } from "react";
import { Term } from "@/components/ui/term";
import { Sparkline } from "@/components/charts/stat-tile";
import type { ImmigrationFocus } from "@/components/immigration/green-card-views";
import { formatSigned, formatValue } from "@/lib/format";

// "How the system works" — the orientation diagram at the top of
// /immigration. Yearly flows on the left feed status changes in the middle;
// the population they add up to (a stock) sits on the right. Server-rendered;
// numbers come from the page's data so every figure matches the sections
// below. Flow bars share one linear scale; a flow far larger than the rest
// (temporary admissions) is clipped and labeled as such.

interface Figure {
  value: number | null | undefined;
  unit?: string;
  period?: string;
  // Recent history and the change against a named period, e.g. "vs FY 2023".
  spark?: number[];
  change?: number | null;
  compare?: string;
}

function Trend({ figure }: { figure: Figure }) {
  const { spark, change, compare } = figure;
  const hasChange = change !== null && change !== undefined && Number.isFinite(change);
  if (!hasChange && !(spark && spark.length > 1)) return null;
  return (
    <div className="mt-2 flex items-end justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
      {hasChange ? (
        <span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {change > 0 ? "▲" : change < 0 ? "▼" : ""} {formatSigned(change, "percent")}
          </span>{" "}
          {compare}
        </span>
      ) : (
        <span />
      )}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}

const fig = (f: Figure) => (f.value === null || f.value === undefined ? "—" : formatValue(f.value, f.unit, { compact: true }));
const has = (f: Figure): f is Figure & { value: number } => typeof f.value === "number" && f.value > 0;

function Bar({ value, scale, children }: { value: number | null | undefined; scale: number; children?: ReactNode }) {
  if (!value || !scale) return null;
  const clipped = value > scale * 1.5;
  const width = clipped ? 100 : Math.max(1.5, (value / scale) * 100);
  return (
    <div className="mt-2" aria-hidden>
      <div className="relative h-2 rounded-sm bg-slate-100 dark:bg-slate-800">
        <div className="h-2 rounded-sm" style={{ width: `${width}%`, background: "var(--viz-series-1)" }} />
        {clipped && <span className="absolute -top-0.75 right-6 h-3.5 w-1.5 -skew-x-12 bg-white dark:bg-slate-950" />}
      </div>
      {clipped && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Bar cut off — {Math.round(value / scale)}× the longest bar shown
        </p>
      )}
      {children}
    </div>
  );
}

function Node({
  label,
  figure,
  unit,
  href,
  selected,
  onSelect,
  scale,
  route,
  bar,
}: {
  label: string;
  figure: Figure;
  unit: string;
  href: string;
  selected?: boolean;
  onSelect?: () => void;
  scale?: number;
  route?: ReactNode;
  bar?: ReactNode;
}) {
  const labelClass = "text-xs font-medium text-slate-600 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:text-white";
  return (
    <div
      className={`rounded-xl border bg-white p-3 transition-all duration-500 dark:bg-slate-950 ${
        selected
          ? "relative z-10 scale-[1.025] border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/15 dark:border-blue-400"
          : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700"
      }`}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-expanded={selected}
          aria-controls="immigration-focus"
          className={`${labelClass} text-left`}
        >
          {label} {selected ? "↑" : "↓"}
        </button>
      ) : (
        <a href={href} className={labelClass}>
          {label} ↓
        </a>
      )}
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-xl font-semibold text-slate-950 tabular-nums dark:text-white">{fig(figure)}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {unit}
          {figure.period && ` · ${figure.period}`}
        </span>
      </p>
      {bar ?? (scale !== undefined && <Bar value={figure.value} scale={scale} />)}
      <Trend figure={figure} />
      {route && <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{route}</p>}
    </div>
  );
}

function Stage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">{title}</p>
      <div className="flex flex-1 flex-col justify-center gap-2">{children}</div>
    </div>
  );
}

function Arrow({ active = false }: { active?: boolean }) {
  return (
    <div aria-hidden className="flex items-center justify-center text-slate-400 lg:pt-6">
      <svg width="20" height="20" viewBox="0 0 20 20" className={`rotate-90 transition-all duration-500 lg:rotate-0 ${active ? "text-blue-500 motion-safe:animate-pulse" : ""}`}>
        <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Swatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  );
}

// A part-of-whole bar: segments with a 2px surface gap between them.
// `width` (percent of the track) puts it on the flow scale.
function SplitBar({ parts, width = 100 }: { parts: { value: number; color: string }[]; width?: number }) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  if (!total) return null;
  return (
    <span className="mt-2 block h-2 rounded-sm bg-slate-100 dark:bg-slate-800" aria-hidden>
      <span className="flex h-2 gap-0.5 overflow-hidden rounded-sm" style={{ width: `${width}%` }}>
        {parts.map((p, i) => (
          <span key={i} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </span>
    </span>
  );
}

export function ImmigrationFlow({
  encounters,
  temporary,
  humanitarian,
  greenCards,
  adjustmentShare,
  naturalizations,
  netMigration,
  naturalized,
  noncitizen,
  foreignBorn,
  unauthorized,
  selectedFocus,
  onFocusSelect,
}: {
  encounters: Figure;
  temporary: Figure;
  humanitarian: Figure;
  greenCards: Figure;
  adjustmentShare: number | null | undefined;
  naturalizations: Figure;
  netMigration: Figure;
  naturalized: number | null | undefined;
  noncitizen: number | null | undefined;
  foreignBorn: Figure;
  unauthorized: Figure;
  selectedFocus?: ImmigrationFocus | null;
  onFocusSelect?: (focus: ImmigrationFocus) => void;
}) {
  // One scale for the yearly flows, set by the largest that isn't
  // temporary admissions (which would flatten everything else).
  const scale = Math.max(...[encounters, humanitarian, greenCards, naturalizations].filter(has).map((f) => f.value), 0);
  const total = (naturalized ?? 0) + (noncitizen ?? 0);
  const adjusted = has(greenCards) && adjustmentShare ? (greenCards.value * adjustmentShare) / 100 : null;

  return (
    <div className="rounded-2xl bg-slate-50 p-4 sm:p-6 dark:bg-slate-900/60">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1fr)_auto_minmax(0,0.85fr)_auto_minmax(0,1.25fr)]">
        <Stage title="Arrive or are stopped · yearly">
          <Node
            label="Stopped at the border"
            figure={encounters}
            unit="encounters"
            href="#border"
            selected={selectedFocus === "border"}
            onSelect={onFocusSelect ? () => onFocusSelect("border") : undefined}
            scale={scale}
            route={
              <>
                Then <Term id="removal">removal</Term>, <Term id="return">return</Term>, detention, or release with a court date
              </>
            }
          />
          <Node
            label="Visiting, studying, working"
            figure={temporary}
            unit="admissions"
            href="#temporary"
            selected={selectedFocus === "temporary"}
            onSelect={onFocusSelect ? () => onFocusSelect("temporary") : undefined}
            scale={scale}
            route={
              <>
                <Term id="nonimmigrant">Nonimmigrant</Term> entries, not people. Some later get a green card; some{" "}
                <Term id="overstay">overstay</Term>
              </>
            }
          />
          <Node
            label="Humanitarian protection"
            figure={humanitarian}
            unit="people"
            href="#humanitarian"
            selected={selectedFocus === "humanitarian"}
            onSelect={onFocusSelect ? () => onFocusSelect("humanitarian") : undefined}
            scale={scale}
            route={
              <>
                <Term id="refugee">Refugee</Term> arrivals + <Term id="asylum">asylum</Term> grants; eligible for a green card after a year
              </>
            }
          />
        </Stage>
        <Arrow active={Boolean(selectedFocus)} />
        <Stage title="Become permanent residents">
          <Node
            label="Green cards"
            figure={greenCards}
            unit="people"
            href="#legal"
            selected={selectedFocus === "green-cards"}
            onSelect={onFocusSelect ? () => onFocusSelect("green-cards") : undefined}
            bar={
              adjusted !== null && has(greenCards) ? (
                <>
                  <SplitBar
                    width={(greenCards.value / scale) * 100}
                    parts={[
                      { value: adjusted, color: "var(--viz-series-1)" },
                      {
                        value: greenCards.value - adjusted,
                        color: "var(--viz-series-2)",
                      },
                    ]}
                  />
                  <span className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <Swatch color="var(--viz-series-1)">
                      {Math.round(adjustmentShare!)}% <Term id="adjustment-of-status">already lived here</Term>
                    </Swatch>
                    <Swatch color="var(--viz-series-2)">{100 - Math.round(adjustmentShare!)}% arrived from abroad</Swatch>
                  </span>
                </>
              ) : undefined
            }
            scale={scale}
            route={
              <>
                A <Term id="green-card">green card</Term> through family, employment, the diversity lottery, or humanitarian status
              </>
            }
          />
        </Stage>
        <Arrow active={Boolean(selectedFocus)} />
        <Stage title="Become citizens">
          <Node
            label="Naturalizations"
            figure={naturalizations}
            unit="people"
            href="#legal"
            selected={selectedFocus === "naturalizations"}
            onSelect={onFocusSelect ? () => onFocusSelect("naturalizations") : undefined}
            scale={scale}
            route={
              <>
                <Term id="naturalization">Naturalization</Term>, usually five years after the green card
              </>
            }
          />
        </Stage>
        <Arrow active={Boolean(selectedFocus)} />
        <Stage title="Live here · population">
          <Node
            label="Foreign-born residents"
            figure={{ ...foreignBorn, value: total || foreignBorn.value }}
            unit="people"
            href="#population"
            selected={selectedFocus === "population"}
            onSelect={onFocusSelect ? () => onFocusSelect("population") : undefined}
            bar={
              total > 0 ? (
                <>
                  <SplitBar
                    parts={[
                      { value: naturalized ?? 0, color: "var(--viz-series-1)" },
                      { value: noncitizen ?? 0, color: "var(--viz-series-2)" },
                    ]}
                  />
                  <span className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <Swatch color="var(--viz-series-1)">Naturalized citizens {formatValue(naturalized, "people", { compact: true })}</Swatch>
                    <Swatch color="var(--viz-series-2)">Not citizens {formatValue(noncitizen, "people", { compact: true })}</Swatch>
                  </span>
                </>
              ) : undefined
            }
            route={
              <>
                <Term id="foreign-born">Not U.S. citizens at birth</Term>, any status. Of whom <Term id="unauthorized">unauthorized</Term>:{" "}
                {fig(unauthorized)}
                {unauthorized.period && ` (${unauthorized.period})`} ·{" "}
                <a href="#unauthorized" className="hover:text-slate-900 hover:underline dark:hover:text-white">More ↓</a>
              </>
            }
          />
          <Node
            label="Net international migration"
            figure={netMigration}
            unit="people"
            href="#population"
            selected={selectedFocus === "net-migration"}
            onSelect={onFocusSelect ? () => onFocusSelect("net-migration") : undefined}
            route={
              <>
                <Term id="nim">Everyone in minus everyone out</Term>, citizens included
              </>
            }
          />
        </Stage>
      </div>
    </div>
  );
}
