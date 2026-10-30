import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Baby, Church, Crosshair, Globe2, GraduationCap, Handshake, HeartPulse, House, Map as MapIcon, PersonStanding, Receipt, ShieldAlert, Stethoscope, TrendingUp, Users, Zap } from "lucide-react";
import { formatNumber, formatSigned, formatValue } from "@/lib/format";

// Observed figures draw solid; survey estimates add a dot on each point;
// projections draw dashed (lines) or hatched (bars).
export type DataKind = "observed" | "estimate" | "projected";
export interface TrendPoint { x: number; value: number; label: string }
export interface TrendSeries { id: string; label: string; kind: DataKind; color: string; points: TrendPoint[] }
export interface TrendMarker { x: number; label: string }
export interface Column { key: string; label: string; projected?: boolean; segments: { value: number; color: string; label: string }[] }
export interface CompositionRow { year: number; projected?: boolean; segments: { id: string; label: string; value: number; color: string }[] }
// "hatch" keys a projected bar or composition row.
export interface LegendItem { label: string; color: string; kind: DataKind | "bar" | "hatch" }

export interface Headline {
  label: string;
  value: number;
  unit: string;
  // Spelled-out unit after the value, e.g. "per 100,000 residents".
  unitLabel?: string;
  change?: number | null;
  compareLabel?: string;
}

export interface IssueFeatures {
  immigration: {
    headline: Headline;
    trend: TrendSeries[];
    markers: TrendMarker[];
    // Net international migration by year, a projected year last if any.
    migration: { headline: Headline; columns: Column[]; legend: LegendItem[]; source: string; coverage: string } | null;
    source: string;
    coverage: string;
  } | null;
  crime: { headline: Headline; trend: TrendSeries[]; source: string; coverage: string } | null;
  demographics: { headline: Headline; rows: CompositionRow[]; legend: LegendItem[]; source: string; coverage: string } | null;
  israel: { headline: Headline; columns: Column[]; legend: LegendItem[]; source: string; coverage: string } | null;
  abortion: { headline: Headline; trend: TrendSeries[]; source: string; coverage: string } | null;
}

interface Topic { label: string; href: string; icon: LucideIcon }

const ISSUES: Record<keyof IssueFeatures, Topic> = {
  immigration: { label: "Immigration", href: "/immigration", icon: PersonStanding },
  crime: { label: "Crime", href: "/crime", icon: ShieldAlert },
  demographics: { label: "Demographics", href: "/demographics", icon: Users },
  israel: { label: "U.S.–Israel", href: "/israel", icon: Handshake },
  abortion: { label: "Abortion", href: "/abortion", icon: Stethoscope },
};

// Every other issue page, in the order the compact grid lists them.
const MORE_ISSUES: Topic[] = [
  { label: "Guns", href: "/guns", icon: Crosshair },
  { label: "Economy", href: "/economy", icon: TrendingUp },
  { label: "Spending", href: "/spending", icon: Receipt },
  { label: "Housing", href: "/housing", icon: House },
  { label: "Healthcare", href: "/healthcare", icon: HeartPulse },
  { label: "Energy & climate", href: "/energy", icon: Zap },
  { label: "Education", href: "/education", icon: GraduationCap },
  { label: "Religion", href: "/religion", icon: Church },
  { label: "Family", href: "/family", icon: Baby },
  { label: "Foreign policy", href: "/foreign-policy", icon: Globe2 },
  { label: "States", href: "/states", icon: MapIcon },
];

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950";

export function ExploreAmerica({ features }: { features: IssueFeatures }) {
  const { immigration, ...rest } = features;
  const secondary = (Object.keys(rest) as (keyof typeof rest)[]).filter((key) => rest[key]);
  // An issue without data drops into the compact grid instead of showing an empty card.
  const missing = (Object.keys(ISSUES) as (keyof IssueFeatures)[]).filter((key) => !features[key]).map((key) => ISSUES[key]);
  const more = [...missing, ...MORE_ISSUES];
  // A card left alone in its row spans it: beside the lead card on wide
  // screens (two rows of two), and in the two-column layout below that.
  const lgWide = (index: number) => secondary.length === 2 || (secondary.length === 3 && index === 2);
  const mdWide = (index: number) => secondary.length % 2 === 1 && index === secondary.length - 1;

  return (
    <section id="issues" aria-labelledby="explore-heading" className="mt-10 scroll-mt-24 pb-12">
      <h2 id="explore-heading" className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl dark:text-white">
        Understand America through data.
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
        Explore the issues shaping the nation, backed by trends, figures, and original sources.
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {immigration ? (
          <li className={`flex md:col-span-2 ${secondary.length ? "lg:row-span-2" : "lg:col-span-4"}`}>
            <FeatureCard topic={ISSUES.immigration} headline={immigration.headline} source={immigration.source} coverage={immigration.coverage} lead>
              <TrendChart series={immigration.trend} unit={immigration.headline.unit} markers={immigration.markers} height={200} fill />
              {immigration.migration ? (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <StatLine headline={immigration.migration.headline} />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{immigration.migration.coverage} · {immigration.migration.source}</p>
                  </div>
                  <div className="mt-3"><ColumnChart columns={immigration.migration.columns} unit={immigration.migration.headline.unit} height={80} /></div>
                  <Legend items={immigration.migration.legend} />
                </div>
              ) : null}
            </FeatureCard>
          </li>
        ) : null}
        {secondary.map((key, index) => (
          <li key={key} className={`flex ${mdWide(index) ? "md:col-span-2" : ""} ${lgWide(index) ? "lg:col-span-2" : mdWide(index) ? "lg:col-span-1" : ""}`}>
            {secondaryCard(key, features)}
          </li>
        ))}
      </ul>

      <h3 id="more-issues-heading" className="mt-8 text-sm font-semibold text-slate-900 dark:text-white">More issues</h3>
      <ul aria-labelledby="more-issues-heading" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {more.map(({ label, href, icon: Icon }) => (
          <li key={href} className="flex">
            <Link href={href} className={`group flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900 ${focusRing}`}>
              <Icon size={16} aria-hidden className="shrink-0 text-slate-400 transition-colors group-hover:text-blue-700 dark:text-slate-500 dark:group-hover:text-blue-300" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </Link>
          </li>
        ))}
        <li className="flex">
          <Link href="/issueview" className={`group flex w-full items-center gap-2.5 rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 ${focusRing}`}>
            <span className="min-w-0 flex-1">Browse every issue</span>
            <ArrowRight size={14} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

function secondaryCard(key: Exclude<keyof IssueFeatures, "immigration">, features: IssueFeatures) {
  const topic = ISSUES[key];
  switch (key) {
    case "crime": {
      const crime = features.crime!;
      return (
        <FeatureCard topic={topic} headline={crime.headline} source={crime.source} coverage={crime.coverage}>
          <TrendChart series={crime.trend} unit={crime.headline.unit} height={110} />
          <Legend items={crime.trend.map((series) => ({ label: series.label, color: series.color, kind: series.kind }))} />
        </FeatureCard>
      );
    }
    case "demographics": {
      const demographics = features.demographics!;
      return (
        <FeatureCard topic={topic} headline={demographics.headline} source={demographics.source} coverage={demographics.coverage}>
          <CompositionChart rows={demographics.rows} />
          <Legend items={demographics.legend} />
        </FeatureCard>
      );
    }
    case "israel": {
      const israel = features.israel!;
      return (
        <FeatureCard topic={topic} headline={israel.headline} source={israel.source} coverage={israel.coverage}>
          <ColumnChart columns={israel.columns} unit={israel.headline.unit} height={110} />
          <Legend items={israel.legend} />
        </FeatureCard>
      );
    }
    case "abortion": {
      const abortion = features.abortion!;
      return (
        <FeatureCard topic={topic} headline={abortion.headline} source={abortion.source} coverage={abortion.coverage}>
          <TrendChart series={abortion.trend} unit={abortion.headline.unit} height={110} zero />
          <Legend items={abortion.trend.map((series) => ({ label: series.label, color: series.color, kind: series.kind }))} />
        </FeatureCard>
      );
    }
  }
}

function FeatureCard({ topic: { label, href, icon: Icon }, headline, source, coverage, lead = false, children }: {
  topic: Topic; headline: Headline; source: string; coverage: string; lead?: boolean; children: ReactNode;
}) {
  return (
    <Link href={href} className={`group flex w-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600 ${lead ? "p-5 sm:p-6" : "p-5"} ${focusRing}`}>
      <div className="flex items-center gap-2">
        <Icon size={lead ? 18 : 16} aria-hidden className="shrink-0 text-slate-400 transition-colors group-hover:text-blue-700 dark:text-slate-500 dark:group-hover:text-blue-300" />
        <h3 className={`font-semibold tracking-tight text-slate-950 dark:text-white ${lead ? "text-xl" : "text-base"}`}>{label}</h3>
      </div>
      <div className="mt-3"><StatLine headline={headline} large={lead} /></div>
      <div className={`flex flex-1 flex-col ${lead ? "mt-5" : "mt-4"}`}>{children}</div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <p className="min-w-0 text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{coverage}</span> · {source}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
          <span className={lead ? "" : "sr-only sm:not-sr-only"}>Explore</span>
          <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function StatLine({ headline, large = false }: { headline: Headline; large?: boolean }) {
  const { change } = headline;
  const hasChange = change !== null && change !== undefined && Number.isFinite(change);
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{headline.label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white ${large ? "text-4xl sm:text-5xl" : "text-3xl"}`}>
          {formatValue(headline.value, headline.unit, { compact: true })}
        </span>
        {headline.unitLabel ? <span className="text-sm text-slate-500 dark:text-slate-400">{headline.unitLabel}</span> : null}
        {hasChange ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">{change > 0 ? "▲" : change < 0 ? "▼" : ""} {formatSigned(change, "percent")}</span> {headline.compareLabel}
          </span>
        ) : null}
      </p>
    </div>
  );
}

// Round gridline steps (1, 2, 2.5, 5 × 10ⁿ) spanning the data.
function niceTicks(lo: number, hi: number, count = 3) {
  const raw = (hi - lo || Math.abs(hi) || 1) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick < hi + step * 0.999; tick += step) ticks.push(tick);
  return ticks.length > 1 ? ticks : [start, start + step];
}

interface XLabel { at: number; label: string }

// Axis labels round to whole units except money and percentages.
const tickLabel = (value: number, unit: string) =>
  unit === "usd" || unit === "percent" ? formatValue(value, unit, { compact: true }) : formatNumber(value, { compact: true });

// Shared frame: HTML y-axis labels, a stretchable SVG plot area, and HTML
// x-axis labels, so text never distorts or squeezes as the card resizes.
// `fill` grows the plot to the space its card has left, `height` at least.
function Plot({ ticks, unit, height, fill = false, xLabels, label, children, overlay }: {
  ticks: number[]; unit: string; height: number; fill?: boolean; xLabels: XLabel[]; label: string; children?: ReactNode; overlay?: ReactNode;
}) {
  const [d0, d1] = [ticks[0], ticks.at(-1)!];
  const y = (value: number) => (1 - (value - d0) / (d1 - d0)) * 100;
  return (
    <div role="img" aria-label={label} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 ${fill ? "flex-1 grid-rows-[minmax(0,1fr)_auto]" : ""}`}>
      <div className="relative" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0 block -translate-y-1/2 whitespace-nowrap text-[10px] leading-none tabular-nums text-slate-400 dark:text-slate-500" style={{ top: `${y(tick)}%` }}>
            {tickLabel(tick, unit)}
          </span>
        ))}
        <span className="invisible block whitespace-nowrap text-[10px] tabular-nums">{tickLabel(d1, unit)}</span>
      </div>
      <div className="relative" style={fill ? { minHeight: height } : { height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {ticks.map((tick) => <line key={tick} x1={0} x2={100} y1={y(tick)} y2={y(tick)} stroke="var(--viz-grid)" vectorEffect="non-scaling-stroke" />)}
          {children}
        </svg>
        {overlay}
      </div>
      <div />
      <div className="relative mt-1.5 h-3" aria-hidden>
        {xLabels.map(({ at, label: text }, index) => (
          <span
            key={`${at}-${text}`}
            className={`absolute top-0 whitespace-nowrap text-[10px] leading-none tabular-nums text-slate-400 dark:text-slate-500 ${index === 0 ? "" : index === xLabels.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${at}%` }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ series, unit, height, fill = false, markers = [], zero = false }: {
  series: TrendSeries[]; unit: string; height: number; fill?: boolean; markers?: TrendMarker[]; zero?: boolean;
}) {
  const points = series.flatMap((s) => s.points);
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const values = points.map((p) => p.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const ticks = niceTicks(zero ? 0 : Math.min(...values), Math.max(...values));
  const [d0, d1] = [ticks[0], ticks.at(-1)!];
  const px = (x: number) => ((x - x0) / (x1 - x0 || 1)) * 100;
  const py = (value: number) => (1 - (value - d0) / (d1 - d0)) * 100;
  const path = (pts: TrendPoint[]) => pts.map((p, i) => `${i ? "L" : "M"}${px(p.x)},${py(p.value)}`).join(" ");
  // A projection repeats the last observed point to join the line; one
  // tooltip strip per distinct x.
  const sorted = [...points].sort((a, b) => a.x - b.x).filter((p, i, all) => !i || p.x !== all[i - 1].x);
  const first = sorted[0];
  const last = sorted.at(-1)!;
  const fmt = (value: number) => formatValue(value, unit, { compact: true });
  const description = series.map((s) => `${s.label}${s.kind === "observed" ? "" : ` (${s.kind})`}: ${s.points.map((p) => `${p.label} ${fmt(p.value)}`).filter((_, i, all) => i === 0 || i === all.length - 1).join(" to ")}`).join("; ");
  return (
    <Plot
      ticks={ticks}
      unit={unit}
      height={height}
      fill={fill}
      label={description}
      xLabels={[{ at: 0, label: first.label }, { at: 100, label: last.label }]}
      overlay={
        <>
          {markers.map((marker) => {
            const at = px(marker.x);
            return (
              <span key={marker.label} aria-hidden className={`absolute -top-1 whitespace-nowrap text-[10px] font-medium leading-none text-slate-500 dark:text-slate-400 ${at > 60 ? "-translate-x-full pr-1" : "pl-1"}`} style={{ left: `${at}%` }}>
                {marker.label}
              </span>
            );
          })}
          {series.flatMap((s) => (s.kind === "estimate" ? s.points : s.points.slice(-1)).map((p) => (
            <span
              key={`${s.id}-${p.x}`}
              aria-hidden
              className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${px(p.x)}%`,
                top: `${py(p.value)}%`,
                ...(s.kind === "projected"
                  ? { border: `1.5px solid ${s.color}`, background: "var(--viz-surface)" }
                  : { background: s.color, boxShadow: "0 0 0 2px var(--viz-surface)" }),
              }}
            />
          )))}
          {/* Native tooltips: one hover strip per point across the plot. */}
          {sorted.map((p, i) => {
            const left = i ? (px(sorted[i - 1].x) + px(p.x)) / 2 : 0;
            const right = i < sorted.length - 1 ? (px(p.x) + px(sorted[i + 1].x)) / 2 : 100;
            const owner = series.find((s) => s.points.includes(p));
            return (
              <span key={`${owner?.id}-${p.x}`} className="absolute inset-y-0" style={{ left: `${left}%`, width: `${right - left}%` }} title={`${p.label}: ${fmt(p.value)}${owner && owner.kind !== "observed" ? ` (${owner.kind})` : ""}`} />
            );
          })}
        </>
      }
    >
      {markers.map((marker) => <line key={marker.label} x1={px(marker.x)} x2={px(marker.x)} y1={0} y2={100} stroke="var(--viz-axis)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
      {series.map((s) => (
        <path
          key={s.id}
          d={path(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray={s.kind === "projected" ? "4 3" : undefined}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </Plot>
  );
}

const hatch = (color: string) => ({
  backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1.5px, transparent 1.5px 4px)`,
  boxShadow: `inset 0 0 0 1px ${color}`,
});

function ColumnChart({ columns, unit, height }: { columns: Column[]; unit: string; height: number }) {
  if (!columns.length) return null;
  const totals = columns.map((column) => column.segments.reduce((sum, segment) => sum + segment.value, 0));
  const ticks = niceTicks(0, Math.max(...totals));
  const top = ticks.at(-1)!;
  const fmt = (value: number) => formatValue(value, unit, { compact: true });
  const at = (index: number) => ((index + 0.5) / columns.length) * 100;
  const middle = columns.length > 8 ? Math.round((columns.length - 1) / 2) : -1;
  const peak = totals.indexOf(Math.max(...totals));
  const description = `${columns.length} columns from ${columns[0].label} to ${columns.at(-1)!.label}; highest ${columns[peak].label} at ${fmt(totals[peak])}; latest ${fmt(totals.at(-1)!)}${columns.at(-1)!.projected ? " (projected)" : ""}`;
  return (
    <Plot
      ticks={ticks}
      unit={unit}
      height={height}
      label={description}
      xLabels={[
        { at: 0, label: columns[0].label },
        ...(middle > 0 ? [{ at: at(middle), label: columns[middle].label }] : []),
        { at: 100, label: columns.at(-1)!.label },
      ]}
      overlay={
        <div className={`absolute inset-0 flex items-end ${columns.length > 30 ? "gap-px" : "gap-[3px]"}`}>
          {columns.map((column, index) => (
            <span
              key={column.key}
              className="flex h-full min-w-0 flex-1 flex-col-reverse"
              title={`${column.label}${column.projected ? " (projected)" : ""}: ${fmt(totals[index])}${column.segments.length > 1 ? ` — ${column.segments.filter((s) => s.value).map((s) => `${s.label} ${fmt(s.value)}`).join(", ")}` : ""}`}
            >
              {column.segments.map((segment) => (
                <span
                  key={segment.label}
                  className="block w-full"
                  style={{ height: `${(segment.value / top) * 100}%`, ...(column.projected ? hatch(segment.color) : { background: segment.color }) }}
                />
              ))}
            </span>
          ))}
        </div>
      }
    />
  );
}

function CompositionChart({ rows }: { rows: CompositionRow[] }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-2">
      {rows.map((row) => (
        <div key={row.year} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {row.year}{row.projected ? <span className="sr-only"> projected</span> : null}
          </span>
          <div
            role="img"
            aria-label={`${row.year}${row.projected ? " projected" : ""}: ${row.segments.map((s) => `${s.label} ${s.value.toFixed(1)}%`).join(", ")}`}
            className={`flex h-3.5 overflow-hidden rounded-sm ${row.projected ? "outline outline-1 outline-offset-1 outline-dashed outline-slate-400 dark:outline-slate-500" : ""}`}
          >
            {row.segments.map((segment) => (
              <span
                key={segment.id}
                className="block h-full"
                title={`${row.year}${row.projected ? " (projected)" : ""} — ${segment.label}: ${segment.value.toFixed(1)}%`}
                style={{ width: `${segment.value}%`, ...(row.projected ? hatch(segment.color) : { background: segment.color }) }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <Swatch item={item} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Swatch({ item: { color, kind } }: { item: LegendItem }) {
  if (kind === "bar") return <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ background: color }} />;
  if (kind === "hatch") return <span aria-hidden className="size-2 shrink-0 rounded-sm" style={hatch(color)} />;
  return (
    <svg aria-hidden width="16" height="8" className="shrink-0 overflow-visible">
      <line x1="0" x2="16" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={kind === "projected" ? "4 3" : undefined} />
      {kind === "estimate" ? <circle cx="8" cy="4" r="2.5" fill={color} /> : null}
    </svg>
  );
}
