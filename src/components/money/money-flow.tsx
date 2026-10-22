"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { useWidth } from "@/components/charts/use-width";
import { formatValue } from "@/lib/format";
import { MONEY_COLORS, partyColor as partyColorOf } from "@/lib/money/semantic";
import { useIsDark } from "@/lib/theme";
import {
  logDomain,
  otherOf,
  PARTIES,
  pct,
  placeLabels,
  race,
  SOURCES,
  usd,
  valueOf,
  type FlowCandidate,
  type FlowDonor,
  type LabelSeed,
  type PartyCode,
  type SourceKey,
} from "./money-flow-model";
import { publicEntityPath } from "@/lib/people/public";

export type { FlowCandidate, FlowDonor } from "./money-flow-model";

// Ink, gridlines, and the dot ring (the chart surface) per colour scheme,
// set inline on the chart's wrapper.
const THEME_VARS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--flow-ink": "#1e293b",
    "--flow-ink-muted": "#64748b",
    "--flow-grid": "#e2e8f0",
    "--flow-surface": "#ffffff",
  },
  dark: {
    "--flow-ink": "#f1f5f9",
    "--flow-ink-muted": "#94a3b8",
    "--flow-grid": "#1e293b",
    "--flow-surface": "#020617",
  },
};

// null during server render: the scheme is only known in the browser.
function useScheme(): "light" | "dark" | null {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = useIsDark();
  return mounted ? (dark ? "dark" : "light") : null;
}

type PartyFilter = "all" | PartyCode;
type Office = "all" | "S" | "H";

const Y_OPTION: Record<SourceKey, string> = {
  individual: "Share from individuals",
  pac: "Share from PACs",
  party_: "Share from party",
  other: "Share from transfers & loans",
};

const Y_LABEL: Record<SourceKey, string> = {
  individual: "Share from individual donors",
  pac: "Share from PACs & other committees",
  party_: "Share from party committees",
  other: "Share from transfers, loans & other",
};

const M = { top: 24, right: 12, bottom: 34, left: 40 };

// Every campaign this cycle as one dot: across = dollars raised (log
// scale), up = the share from one money source, colour = party. Filters
// highlight rather than remove, so the axes never move. Picking a dot (or
// ?candidate=) opens that campaign's donors and opponent.
export function MoneyFlow({
  cycle,
  candidates,
  donorsByCandidate,
  opponents = {},
  initialCandidateId = null,
  source,
}: {
  cycle: number;
  candidates: FlowCandidate[];
  donorsByCandidate: Record<string, FlowDonor[]>;
  /** Candidate id → the opposing party's leading candidate in the same race. */
  opponents?: Record<string, string>;
  initialCandidateId?: string | null;
  source: { label: string; href?: string };
}) {
  const [party, setParty] = useState<PartyFilter>("all");
  const [office, setOffice] = useState<Office>("all");
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<SourceKey>("individual");
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates.some((c) => c.id === initialCandidateId) ? initialCandidateId : null,
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const scheme = useScheme();

  const all = useMemo(
    () => candidates.filter((c) => c.receipts > 0).sort((a, b) => b.receipts - a.receipts),
    [candidates],
  );
  const allTotal = all.reduce((s, c) => s + c.receipts, 0);
  const q = query.trim().toLowerCase();
  const filtered = party !== "all" || office !== "all" || q !== "";
  const isOn = (c: FlowCandidate) =>
    (party === "all" || c.party === party) &&
    (office === "all" || c.office === office) &&
    (!q || `${c.name} ${race(c)}`.toLowerCase().includes(q));
  const on = all.filter(isOn);
  const onTotal = on.reduce((s, c) => s + c.receipts, 0);

  const narrow = width < 640;
  const height = narrow ? 340 : 460;
  const plotR = width - M.right;
  const plotB = height - M.bottom;
  const { lo, hi, ticks } = useMemo(() => logDomain(Math.max(1000, all.at(-1)?.receipts ?? 1000), all[0]?.receipts ?? 1e6), [all]);
  const share = (c: FlowCandidate) => Math.min(1, Math.max(0, valueOf(c, metric) / c.receipts));
  const sx = (v: number) => M.left + ((Math.log10(Math.max(lo, v)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (plotR - M.left);
  const sy = (s: number) => plotB - s * (plotB - M.top);

  const points = all.map((c) => ({ c, x: sx(c.receipts), y: sy(share(c)), on: isOn(c) }));
  const byId = new Map(points.map((p) => [p.c.id, p]));
  const selected = selectedId ? (byId.get(selectedId)?.c ?? null) : null;
  const hovered = hoverId ? (byId.get(hoverId) ?? null) : null;
  const opponent = selected ? (candidates.find((c) => c.id === opponents[selected.id]) ?? null) : null;

  // Name the biggest fundraisers and the outliers on the current measure
  // among campaigns with real money, so the chart explains itself.
  const big = on.filter((c) => c.receipts >= 1_000_000);
  // Ties (many campaigns sit at exactly 0% or 100%) go to the bigger one.
  const lowest = [...big].sort((a, b) => share(a) - share(b) || b.receipts - a.receipts);
  const highest = [...big].sort((a, b) => share(b) - share(a) || b.receipts - a.receipts);
  const seedOf = (c: FlowCandidate): LabelSeed => {
    const p = byId.get(c.id)!;
    const name = c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name;
    return { id: c.id, x: p.x, y: p.y, text: name };
  };
  const labels = placeLabels(
    [
      ...(selected ? [selected] : []),
      ...on.slice(0, narrow ? 3 : 5),
      ...(narrow ? [] : [...lowest.slice(0, 3), ...highest.slice(0, 3)]),
    ].map(seedOf),
    { left: M.left, right: plotR },
    narrow ? 4 : 11,
  );

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    let best: string | null = null;
    let bestD = 18 * 18;
    for (const p of points) {
      if (!p.on) continue;
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.c.id;
      }
    }
    setHoverId(best);
  };

  const field =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const ring = (p: (typeof points)[number]) => {
    const sel = p.c.id === selectedId;
    const hov = p.c.id === hoverId;
    return (
      <circle
        key={p.c.id}
        cx={p.x}
        cy={p.y}
        r={sel ? 6 : hov ? 5 : narrow ? 2.5 : 3.25}
        style={{
          fill: partyColorOf(p.c.party),
          fillOpacity: sel || hov ? 1 : p.on ? (narrow ? 0.4 : 0.5) : 0.07,
          stroke: sel ? "var(--flow-ink)" : p.on && !narrow ? "var(--flow-surface)" : "none",
          strokeWidth: sel ? 2 : 1,
        }}
      />
    );
  };

  return (
    <div style={(scheme ? THEME_VARS[scheme] : THEME_VARS.light) as CSSProperties}>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800"
          role="group"
          aria-label="Party"
        >
          {[{ code: "all" as const, label: "Both parties", color: "" }, ...PARTIES].map((p) => {
            const active = p.code === party;
            return (
              <button
                key={p.code}
                type="button"
                aria-pressed={active}
                onClick={() => setParty(p.code)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {p.color ? <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> : null}
                {p.label}
              </button>
            );
          })}
        </div>
        <select aria-label="Office" value={office} onChange={(e) => setOffice(e.target.value as Office)} className={field}>
          <option value="all">Senate &amp; House</option>
          <option value="S">Senate</option>
          <option value="H">House</option>
        </select>
        <select
          aria-label="Measure"
          value={metric}
          onChange={(e) => setMetric(e.target.value as SourceKey)}
          className={field}
        >
          {SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {Y_OPTION[s.key]}
            </option>
          ))}
        </select>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or state"
            aria-label="Search candidates"
            className={`${field} w-44 pl-7`}
          />
        </label>
        <select
          aria-label="Candidate"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className={`${field} max-w-52`}
        >
          <option value="">Pick a campaign…</option>
          {on.slice(0, 500).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.state ? ` (${c.state})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ChartCard
          title={`What every campaign raised, ${cycle}`}
          subtitle={
            filtered
              ? `${usd(onTotal)} raised by ${on.length.toLocaleString()} campaigns, ${pct(onTotal, allTotal)} of the ${usd(allTotal)} raised by all ${all.length.toLocaleString()}. Pick a dot for its donors and opponent.`
              : `${usd(allTotal)} raised by ${all.length.toLocaleString()} campaigns. One dot each; pick one for its donors and opponent.`
          }
          source={source}
          table={{
            columns: ["Candidate", "Party", "Race", "Raised", "Individuals", "PACs", "Party cmte", "Other"],
            rows: on.map((c) => [
              c.name,
              c.party,
              race(c),
              formatValue(c.receipts, "usd"),
              formatValue(c.individual, "usd"),
              formatValue(c.pac, "usd"),
              formatValue(c.party_, "usd"),
              formatValue(otherOf(c), "usd"),
            ]),
          }}
        >
          <div ref={ref} className="relative" style={{ minHeight: height }}>
            {scheme ? (
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={`Scatter plot of ${all.length} campaigns: total raised against ${Y_LABEL[metric].toLowerCase()}`}
                className={hovered ? "cursor-pointer" : undefined}
                onPointerMove={pick}
                onPointerLeave={() => setHoverId(null)}
                onClick={() => hoverId && setSelectedId((cur) => (cur === hoverId ? null : hoverId))}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <g key={t}>
                    <line x1={M.left} x2={plotR} y1={sy(t)} y2={sy(t)} style={{ stroke: "var(--flow-grid)" }} />
                    <text
                      x={M.left - 6}
                      y={sy(t) + 4}
                      textAnchor="end"
                      fontSize={11}
                      className="tabular-nums"
                      style={{ fill: "var(--flow-ink-muted)" }}
                    >
                      {t * 100}%
                    </text>
                  </g>
                ))}
                {ticks.map((t, i) => (
                  <g key={t}>
                    <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={plotB} style={{ stroke: "var(--flow-grid)" }} />
                    {!narrow || i % 2 === 0 ? (
                      <text
                        x={sx(t)}
                        y={plotB + 16}
                        textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                        fontSize={11}
                        className="tabular-nums"
                        style={{ fill: "var(--flow-ink-muted)" }}
                      >
                        {usd(t)}
                      </text>
                    ) : null}
                  </g>
                ))}
                <text x={M.left} y={12} fontSize={11} fontWeight={500} style={{ fill: "var(--flow-ink-muted)" }}>
                  ↑ {Y_LABEL[metric]}
                </text>
                <text
                  x={plotR}
                  y={height - 2}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={500}
                  style={{ fill: "var(--flow-ink-muted)" }}
                >
                  Total raised (log scale) →
                </text>

                <g>
                  {points.filter((p) => !p.on).map(ring)}
                  {points.filter((p) => p.on && p.c.id !== selectedId && p.c.id !== hoverId).map(ring)}
                  {[...new Set([selectedId, hoverId])].map((id) => (id && byId.has(id) ? ring(byId.get(id)!) : null))}
                </g>

                {labels.map((l) => (
                  <text
                    key={l.id}
                    x={l.lx}
                    y={l.y + 4}
                    textAnchor={l.anchor}
                    fontSize={11}
                    fontWeight={l.id === selectedId ? 600 : 500}
                    paintOrder="stroke"
                    style={{ fill: "var(--flow-ink)", stroke: "var(--flow-surface)", strokeWidth: 3 }}
                    className="pointer-events-none"
                  >
                    {l.text}
                  </text>
                ))}
              </svg>
            ) : null}

            {hovered ? (
              <div
                className="pointer-events-none absolute z-10 w-60 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
                style={{
                  left: Math.min(Math.max(0, hovered.x + 12), width - 240),
                  top: hovered.y > height / 2 ? hovered.y - 110 : hovered.y + 12,
                }}
              >
                <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partyColorOf(hovered.c.party) }} />
                  <span className="truncate">{hovered.c.name}</span>
                </p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {race(hovered.c)} · <span className="tabular-nums">{usd(hovered.c.receipts)}</span> raised
                </p>
                <span className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded">
                  {SOURCES.map((s) => {
                    const v = valueOf(hovered.c, s.key);
                    return v > 0 ? (
                      <span key={s.key} style={{ width: `${(v / hovered.c.receipts) * 100}%`, background: s.color }} />
                    ) : null;
                  })}
                </span>
                <ul className="mt-1.5 grid grid-cols-2 gap-x-3 text-slate-600 dark:text-slate-300">
                  {SOURCES.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />
                        {s.short}
                      </span>
                      <span className="tabular-nums">{pct(valueOf(hovered.c, s.key), hovered.c.receipts)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {PARTIES.map((p) => (
              <li key={p.code} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MONEY_COLORS.other }} />
              Other parties
            </li>
          </ul>
        </ChartCard>

        <div className="space-y-4 xl:sticky xl:top-20">
          {selected ? (
            <CandidatePanel
              candidate={selected}
              donors={donorsByCandidate[selected.id] ?? []}
              partyColor={partyColorOf(selected.party)}
              opponent={opponent}
              onCompare={opponent ? () => setSelectedId(opponent.id) : undefined}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            PARTIES.filter((p) => party === "all" || p.code === party).map((p) => (
              <PartySummary
                key={p.code}
                label={p.label}
                color={p.color}
                pool={all.filter((c) => c.party === p.code && (office === "all" || c.office === office))}
                onPick={(id) => setSelectedId(id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Shown until a candidate is picked: the selected party's money at a glance.
function PartySummary({
  label,
  color,
  pool,
  onPick,
}: {
  label: string;
  color: string;
  pool: FlowCandidate[];
  onPick: (id: string) => void;
}) {
  const sum = (f: (c: FlowCandidate) => number) => pool.reduce((s, c) => s + f(c), 0);
  const raised = sum((c) => c.receipts);
  const sorted = pool.map((c) => c.receipts).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
  const parts: [string, number, string][] = [
    [SOURCES[0].short, sum((c) => c.individual), SOURCES[0].color],
    [SOURCES[1].short, sum((c) => c.pac), SOURCES[1].color],
    [SOURCES[2].short, sum((c) => c.party_), SOURCES[2].color],
    [SOURCES[3].short, sum(otherOf), SOURCES[3].color],
  ];
  const leader = pool[0];
  return (
    <aside className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        All {label} candidates
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">
        {usd(raised)}
      </p>
      <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
        raised by {pool.length} candidate{pool.length === 1 ? "" : "s"} · median {usd(median)}
      </p>
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded">
        {parts
          .filter(([, v]) => v > 0)
          .map(([l, v, c]) => (
            <span
              key={l}
              title={`${l}: ${formatValue(v, "usd")}`}
              style={{ width: `${(v / (raised || 1)) * 100}%`, background: c }}
            />
          ))}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        {parts.map(([l, v, c]) => (
          <li key={l} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
              {l}
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {usd(v)} · {pct(v, raised)}
            </span>
          </li>
        ))}
      </ul>
      {leader ? (
        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          Top fundraiser{" "}
          <button
            type="button"
            onClick={() => onPick(leader.id)}
            className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900 dark:text-white"
          >
            {leader.name}
          </button>{" "}
          <span className="tabular-nums">{usd(leader.receipts)}</span>
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-400">
        Pick a dot to see a campaign&rsquo;s largest donor committees and its opponent.
      </p>
    </aside>
  );
}

function CandidatePanel({
  candidate,
  donors,
  partyColor,
  opponent,
  onCompare,
  onClose,
}: {
  candidate: FlowCandidate;
  donors: FlowDonor[];
  partyColor: string;
  opponent: FlowCandidate | null;
  onCompare?: () => void;
  onClose: () => void;
}) {
  const c = candidate;
  const parts: [string, number, string][] = [
    [SOURCES[0].short, c.individual, SOURCES[0].color],
    [SOURCES[1].short, c.pac, SOURCES[1].color],
    [SOURCES[2].short, c.party_, SOURCES[2].color],
    [SOURCES[3].short, otherOf(c), SOURCES[3].color],
  ];
  const maxDonor = Math.max(1, ...donors.map((d) => d.total));
  return (
    <aside className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: partyColor }} />
            {race(c)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{c.name}</h3>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Raised", c.receipts],
            ["Spent", c.disbursements],
            ["Cash on hand", c.cashOnHand],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-900">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-sm font-semibold text-slate-900 tabular-nums dark:text-white">{usd(v)}</dd>
          </div>
        ))}
      </dl>

      {/* Source split as one stacked bar, 2px surface gaps between segments. */}
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded">
        {parts
          .filter(([, v]) => v > 0)
          .map(([label, v, color]) => (
            <span
              key={label}
              title={`${label}: ${formatValue(v, "usd")}`}
              style={{
                width: `${(v / (c.receipts || 1)) * 100}%`,
                background: color,
              }}
            />
          ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {parts.map(([label, v, color]) => (
          <li key={label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
              {label}
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{pct(v, c.receipts)}</span>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 text-xs font-medium tracking-wide text-slate-400 uppercase">Largest donor committees</h4>
      {donors.length ? (
        <ol className="mt-2 space-y-2">
          {donors.map((d) => (
            <li key={d.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-slate-800 dark:text-slate-100" title={d.name}>
                  {d.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">{usd(d.total)}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${(d.total / maxDonor) * 100}%`,
                    background: MONEY_COLORS.pac,
                  }}
                />
              </div>
              {d.industry ? <p className="mt-0.5 text-[11px] text-slate-400">{d.industry}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No itemized committee gifts recorded for this campaign.
        </p>
      )}

      {opponent && onCompare ? (
        <button
          type="button"
          onClick={onCompare}
          className="mt-5 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <span className="min-w-0">
            <span className="block text-slate-500 dark:text-slate-400">Compare with opponent</span>
            <span className="flex items-center gap-1.5 truncate font-medium text-slate-900 dark:text-white">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partyColorOf(opponent.party) }} />
              {opponent.name}
            </span>
          </span>
          <span className="shrink-0 text-slate-600 tabular-nums dark:text-slate-300">{usd(opponent.receipts)} →</span>
        </button>
      ) : null}

      <Link
        href={publicEntityPath(c)}
        className="mt-4 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        Full profile
      </Link>
    </aside>
  );
}
