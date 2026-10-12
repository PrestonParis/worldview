"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { useWidth } from "@/components/charts/use-width";
import { formatValue } from "@/lib/format";
import { MONEY_COLORS, partyColor as partyColorOf } from "@/lib/money/semantic";
import { useIsDark } from "@/lib/theme";

export interface FlowCandidate {
  id: string;
  name: string;
  party: string; // FEC code: DEM, REP, …
  state: string;
  office: string;
  district: string;
  receipts: number;
  disbursements: number;
  cashOnHand: number;
  individual: number;
  pac: number;
  party_: number;
}

export interface FlowDonor {
  name: string;
  industry: string;
  total: number;
  count: number;
}

type SourceKey = "individual" | "pac" | "party_" | "other";

// Party colours stay on the candidate side; money sources take the shared
// Money & Influence hues (lib/money/semantic.ts), so blue and red only ever
// mean a party. Ink and band opacity are set inline on the chart's wrapper
// from the live colour scheme.
const THEME_VARS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--flow-band": "0.42",
    "--flow-ink": "#1e293b",
    "--flow-ink-muted": "#64748b",
    "--flow-leader": "#cbd5e1",
  },
  dark: {
    "--flow-band": "0.7",
    "--flow-ink": "#f1f5f9",
    "--flow-ink-muted": "#94a3b8",
    "--flow-leader": "#475569",
  },
};

// null during server render: the scheme is only known in the browser.
function useScheme(): "light" | "dark" | null {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = useIsDark();
  return mounted ? (dark ? "dark" : "light") : null;
}

const SOURCES: {
  key: SourceKey;
  label: string;
  short: string;
  color: string;
}[] = [
  {
    key: "individual",
    label: "Individual donors",
    short: "Individuals",
    color: MONEY_COLORS.individual,
  },
  {
    key: "pac",
    label: "PACs & other committees",
    short: "PACs",
    color: MONEY_COLORS.pac,
  },
  {
    key: "party_",
    label: "Party committees",
    short: "Party",
    color: MONEY_COLORS.party,
  },
  {
    key: "other",
    label: "Transfers, loans & other",
    short: "Other",
    color: MONEY_COLORS.other,
  },
];

const PARTIES = [
  { code: "DEM", label: "Democratic", color: partyColorOf("DEM") },
  { code: "REP", label: "Republican", color: partyColorOf("REP") },
] as const;
type PartyCode = (typeof PARTIES)[number]["code"];

const usd = (v: number) => formatValue(v, "usd", { compact: true });
function pct(part: number, whole: number): string {
  if (!(whole > 0)) return "—";
  const p = (part / whole) * 100;
  return p > 0 && p < 0.5 ? "<1%" : `${Math.round(p)}%`;
}

interface Node {
  id: string;
  label: string;
  sub: string;
  value: number;
  y0: number;
  y1: number;
  labelY: number;
}

interface Ribbon {
  id: string;
  source: SourceKey;
  target: string;
  value: number;
  path: string;
}

// Push labels apart to `gap` px, keeping them inside [top, bottom].
function relax(
  centres: number[],
  gap: number,
  top: number,
  bottom: number,
): number[] {
  const out = [...centres];
  for (let i = 0; i < out.length; i++)
    out[i] = Math.max(out[i], i ? out[i - 1] + gap : top);
  const overflow = out.at(-1)! - bottom;
  if (overflow > 0) {
    out[out.length - 1] = bottom;
    for (let i = out.length - 2; i >= 0; i--)
      out[i] = Math.min(out[i], out[i + 1] - gap);
  }
  return out;
}

const otherOf = (c: FlowCandidate) =>
  Math.max(0, c.receipts - c.individual - c.pac - c.party_);
const valueOf = (c: FlowCandidate, k: SourceKey) =>
  k === "other" ? otherOf(c) : c[k];

function race(c: FlowCandidate) {
  const seat =
    c.office === "S"
      ? "Senate"
      : c.office === "H"
        ? `House${c.district && c.district !== "00" ? ` ${c.district}` : ""}`
        : c.office;
  return [c.state, seat].filter(Boolean).join(" ");
}

// Where one party's campaign money comes from: money sources on the left,
// that party's top candidates on the right, band width = dollars, from
// each campaign's FEC totals. Picking a candidate (in the chart, the
// picker, or via ?candidate=) turns it into that campaign's drill-down.
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
  const initial = candidates.find((c) => c.id === initialCandidateId);
  const [party, setParty] = useState<PartyCode>(
    PARTIES.find((p) => p.code === initial?.party)?.code ?? "DEM",
  );
  const [hover, setHover] = useState<{
    kind: "source" | "candidate" | "ribbon";
    id: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial && PARTIES.some((p) => p.code === initial.party) ? initial.id : null,
  );
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    ribbon: Ribbon;
  } | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const scheme = useScheme();

  const partyMeta = PARTIES.find((p) => p.code === party)!;
  const allTotal = candidates.reduce((s, c) => s + c.receipts, 0);
  const pool = useMemo(
    () =>
      candidates
        .filter((c) => c.party === party && c.receipts > 0)
        .sort((a, b) => b.receipts - a.receipts),
    [candidates, party],
  );
  const partyTotal = pool.reduce((s, c) => s + c.receipts, 0);
  const senateOnly = pool.every((c) => c.office === "S");

  const chart = useMemo(() => {
    const narrow = width < 640;
    const leftLabelW = narrow ? 96 : 200;
    const rightLabelW = narrow ? 128 : 230;
    const nodeW = 10;
    // Every candidate gets its own band; the chart grows to fit the labels.
    const right = pool;
    const flowTotal = (c: FlowCandidate) =>
      SOURCES.reduce((s, src) => s + valueOf(c, src.key), 0);

    const labelGap = narrow ? 30 : 34;
    const height = Math.max(380, right.length * labelGap + 24);
    const total = right.reduce((s, c) => s + flowTotal(c), 0) || 1;
    const sources = SOURCES.map((s) => ({
      ...s,
      value: right.reduce((sum, c) => sum + valueOf(c, s.key), 0),
    })).filter((s) => s.value > 0);
    const gapL = 16;
    const gapR = 5;
    const pad = 12;
    const k = Math.min(
      (height - 2 * pad - gapL * (sources.length - 1)) / total,
      (height - 2 * pad - gapR * (right.length - 1)) / total,
    );

    const stack = <T,>(items: T[], value: (t: T) => number, gap: number) => {
      const used =
        items.reduce((s, t) => s + value(t) * k, 0) + gap * (items.length - 1);
      let y = (height - used) / 2;
      return items.map((t) => {
        const y0 = y;
        y += value(t) * k;
        const out = { y0, y1: y };
        y += gap;
        return out;
      });
    };

    const leftPos = stack(sources, (s) => s.value, gapL);
    const rightPos = stack(right, flowTotal, gapR);
    const leftLabels = relax(
      leftPos.map((p) => (p.y0 + p.y1) / 2),
      40,
      20,
      height - 20,
    );
    const rightLabels = relax(
      rightPos.map((p) => (p.y0 + p.y1) / 2),
      labelGap,
      16,
      height - 16,
    );

    const leftNodes: (Node & { key: SourceKey; color: string })[] = sources.map(
      (s, i) => ({
        id: s.key,
        key: s.key,
        color: s.color,
        label: narrow ? s.short : s.label,
        sub: `${usd(s.value)} · ${pct(s.value, total)}`,
        value: s.value,
        ...leftPos[i],
        labelY: leftLabels[i],
      }),
    );
    const maxChars = Math.floor((rightLabelW - 20) / (narrow ? 6.2 : 7));
    const rightNodes: (Node & { candidate: FlowCandidate })[] = right.map(
      (c, i) => {
        const name = c.state ? `${c.name} (${c.state})` : c.name;
        return {
          id: c.id,
          candidate: c,
          label:
            name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name,
          sub: usd(c.receipts),
          value: c.receipts,
          ...rightPos[i],
          labelY: rightLabels[i],
        };
      },
    );

    const xL = leftLabelW;
    const xR = width - rightLabelW - nodeW;
    const xm = (xL + nodeW + xR) / 2;
    const leftOffset = new Map(leftNodes.map((n) => [n.key, n.y0]));
    const ribbons: Ribbon[] = [];
    rightNodes.forEach((rn) => {
      let ry = rn.y0;
      for (const ln of leftNodes) {
        const v = valueOf(rn.candidate, ln.key);
        if (v <= 0) continue;
        const h = v * k;
        const ly = leftOffset.get(ln.key)!;
        leftOffset.set(ln.key, ly + h);
        const a = xL + nodeW;
        ribbons.push({
          id: `${ln.key}>${rn.id}`,
          source: ln.key,
          target: rn.id,
          value: v,
          path: `M${a},${ly}C${xm},${ly} ${xm},${ry} ${xR},${ry}L${xR},${ry + h}C${xm},${ry + h} ${xm},${ly + h} ${a},${ly + h}Z`,
        });
        ry += h;
      }
    });

    return {
      narrow,
      height,
      nodeW,
      xL,
      xR,
      leftNodes,
      rightNodes,
      ribbons,
      labelGap,
    };
  }, [pool, width]);

  const active =
    hover ??
    (selectedId ? { kind: "candidate" as const, id: selectedId } : null);
  const ribbonOn = (r: Ribbon) =>
    !active ||
    (active.kind === "ribbon" && active.id === r.id) ||
    (active.kind === "source" && active.id === r.source) ||
    (active.kind === "candidate" && active.id === r.target);

  const selected = selectedId
    ? (pool.find((c) => c.id === selectedId) ?? null)
    : null;
  const opponent = selected
    ? (candidates.find((c) => c.id === opponents[selected.id]) ?? null)
    : null;
  const jumpTo = (c: FlowCandidate) => {
    const p = PARTIES.find((x) => x.code === c.party);
    if (!p) return;
    setParty(p.code);
    setSelectedId(c.id);
    setHover(null);
  };
  const selectCandidate = (id: string) =>
    setSelectedId((cur) => (cur === id ? null : id));
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectCandidate(id);
    }
  };
  const moveTip = (r: Ribbon) => (e: PointerEvent<SVGPathElement>) => {
    const box = (
      e.currentTarget.ownerSVGElement as SVGSVGElement
    ).getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, ribbon: r });
  };
  const nameOf = (id: string) =>
    chart.rightNodes.find((n) => n.id === id)?.candidate.name ?? "";

  return (
    <div
      style={(scheme ? THEME_VARS[scheme] : THEME_VARS.light) as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800"
          role="group"
          aria-label="Party"
        >
          {PARTIES.map((p) => {
            const on = p.code === party;
            return (
              <button
                key={p.code}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setParty(p.code);
                  setSelectedId(null);
                  setHover(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                  on
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Candidate
          <select
            value={selectedId ?? ""}
            onChange={(e) => {
              setSelectedId(e.target.value || null);
              setHover(null);
            }}
            className="max-w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All {partyMeta.label} candidates</option>
            {pool.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.state ? ` (${c.state})` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 tabular-nums dark:text-white">
            {usd(partyTotal)}
          </span>{" "}
          raised by {pool.length} {partyMeta.label}{" "}
          {senateOnly ? "Senate " : ""}candidates,{" "}
          <span className="tabular-nums">{pct(partyTotal, allTotal)}</span> of
          the {usd(allTotal)} raised by all {candidates.length} tracked
          candidates
        </p>
      </div>

      {/* A CSS breakpoint, not a measured width, so the chart's first
          measurement already sees its final column. */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ChartCard
          title={`Where ${partyMeta.label} campaign money comes from, ${cycle} cycle`}
          subtitle={`Each band is dollars from one source to one campaign. All ${pool.length} candidates, ranked by money raised.`}
          source={source}
          table={{
            columns: [
              "Candidate",
              "Raised",
              "Individuals",
              "PACs",
              "Party",
              "Other",
            ],
            rows: pool.map((c) => [
              `${c.name}${c.state ? ` (${c.state})` : ""}`,
              formatValue(c.receipts, "usd"),
              formatValue(c.individual, "usd"),
              formatValue(c.pac, "usd"),
              formatValue(c.party_, "usd"),
              formatValue(otherOf(c), "usd"),
            ]),
          }}
        >
          <div
            ref={ref}
            className="relative"
            style={{ minHeight: chart.height }}
          >
            {scheme ? (
              <svg
                width={width}
                height={chart.height}
                role="img"
                aria-label={`Sankey diagram: sources of money for ${partyMeta.label} candidates`}
                onPointerLeave={() => {
                  setHover(null);
                  setTip(null);
                }}
              >
                <g>
                  {chart.ribbons.map((r) => (
                    <path
                      key={r.id}
                      d={r.path}
                      style={{
                        fill: SOURCES.find((s) => s.key === r.source)!.color,
                        fillOpacity: ribbonOn(r)
                          ? active
                            ? 0.85
                            : "var(--flow-band)"
                          : 0.08,
                      }}
                      className="cursor-pointer transition-[fill-opacity] duration-150"
                      onPointerEnter={() =>
                        setHover({ kind: "ribbon", id: r.id })
                      }
                      onPointerMove={moveTip(r)}
                      onPointerLeave={() => {
                        setHover(null);
                        setTip(null);
                      }}
                      onClick={() => selectCandidate(r.target)}
                    />
                  ))}
                </g>

                {chart.leftNodes.map((n) => (
                  <g
                    key={n.id}
                    onPointerEnter={() =>
                      setHover({ kind: "source", id: n.key })
                    }
                    onPointerLeave={() => setHover(null)}
                  >
                    <rect
                      x={chart.xL}
                      y={n.y0}
                      width={chart.nodeW}
                      height={Math.max(1, n.y1 - n.y0)}
                      rx={2}
                      style={{ fill: n.color }}
                    />
                    {Math.abs(n.labelY - (n.y0 + n.y1) / 2) > 3 ? (
                      <path
                        d={`M${chart.xL - 4},${(n.y0 + n.y1) / 2}L${chart.xL - 10},${n.labelY}`}
                        fill="none"
                        style={{ stroke: "var(--flow-leader)" }}
                      />
                    ) : null}
                    <text
                      x={chart.xL - 12}
                      y={n.labelY - 3}
                      textAnchor="end"
                      fontSize={12}
                      fontWeight={500}
                      style={{ fill: "var(--flow-ink)" }}
                    >
                      {n.label}
                    </text>
                    <text
                      x={chart.xL - 12}
                      y={n.labelY + 11}
                      textAnchor="end"
                      fontSize={11}
                      className="tabular-nums"
                      style={{ fill: "var(--flow-ink-muted)" }}
                    >
                      {n.sub}
                    </text>
                  </g>
                ))}

                {chart.rightNodes.map((n) => {
                  const isSel = n.id === selectedId;
                  const lx = chart.xR + chart.nodeW + 12;
                  return (
                    <g
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSel}
                      aria-label={`${n.candidate.name}, ${usd(n.value)} raised`}
                      className="cursor-pointer outline-none"
                      onPointerEnter={() =>
                        setHover({ kind: "candidate", id: n.id })
                      }
                      onPointerLeave={() => setHover(null)}
                      onClick={() => selectCandidate(n.id)}
                      onKeyDown={onKey(n.id)}
                    >
                      <rect
                        x={chart.xR}
                        y={n.y0}
                        width={chart.nodeW}
                        height={Math.max(1.5, n.y1 - n.y0)}
                        rx={2}
                        style={{ fill: partyMeta.color }}
                      />
                      {Math.abs(n.labelY - (n.y0 + n.y1) / 2) > 3 ? (
                        <path
                          d={`M${chart.xR + chart.nodeW + 2},${(n.y0 + n.y1) / 2}L${lx - 3},${n.labelY}`}
                          fill="none"
                          style={{ stroke: "var(--flow-leader)" }}
                        />
                      ) : null}
                      {/* Hit area wider than the text, per the interaction spec. */}
                      <rect
                        x={lx - 4}
                        y={n.labelY - (chart.labelGap - 2) / 2 - 2}
                        width={width - lx + 4}
                        height={chart.labelGap - 2}
                        style={{ fill: "transparent" }}
                      />
                      <text
                        x={lx}
                        y={n.labelY - 3}
                        fontSize={12}
                        fontWeight={isSel ? 600 : 500}
                        textDecoration={isSel ? "underline" : undefined}
                        style={{ fill: "var(--flow-ink)" }}
                      >
                        {n.label}
                      </text>
                      <text
                        x={lx}
                        y={n.labelY + 11}
                        fontSize={11}
                        className="tabular-nums"
                        style={{ fill: "var(--flow-ink-muted)" }}
                      >
                        {n.sub}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {tip ? (
              <div
                className="pointer-events-none absolute z-10 w-max max-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
                style={{
                  left: Math.min(tip.x + 12, width - 200),
                  top: Math.max(0, tip.y - 56),
                }}
              >
                <p className="font-medium text-slate-900 dark:text-white">
                  {SOURCES.find((s) => s.key === tip.ribbon.source)!.label} →{" "}
                  {nameOf(tip.ribbon.target)}
                </p>
                <p className="mt-0.5 text-slate-500 tabular-nums dark:text-slate-400">
                  {formatValue(tip.ribbon.value, "usd")} ·{" "}
                  {pct(
                    tip.ribbon.value,
                    chart.rightNodes.find((n) => n.id === tip.ribbon.target)
                      ?.value ?? 0,
                  )}{" "}
                  of receipts
                </p>
              </div>
            ) : null}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {SOURCES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-1 rounded-sm"
                style={{ background: partyMeta.color }}
              />
              {partyMeta.label} candidate
            </li>
          </ul>
        </ChartCard>

        {selected ? (
          <CandidatePanel
            candidate={selected}
            donors={donorsByCandidate[selected.id] ?? []}
            partyColor={partyMeta.color}
            opponent={opponent}
            onCompare={opponent ? () => jumpTo(opponent) : undefined}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <PartySummary
            label={partyMeta.label}
            color={partyMeta.color}
            pool={pool}
            onPick={(id) => setSelectedId(id)}
          />
        )}
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
  const sum = (f: (c: FlowCandidate) => number) =>
    pool.reduce((s, c) => s + f(c), 0);
  const raised = sum((c) => c.receipts);
  const sorted = pool.map((c) => c.receipts).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    : 0;
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
        raised by {pool.length} candidate{pool.length === 1 ? "" : "s"} ·
        median {usd(median)}
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
        Pick a candidate in the chart or the menu to see where their money
        came from.
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
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: partyColor }}
            />
            {race(c)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
            {c.name}
          </h3>
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
          <div
            key={label}
            className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-900"
          >
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">
              {label}
            </dt>
            <dd className="text-sm font-semibold text-slate-900 tabular-nums dark:text-white">
              {usd(v)}
            </dd>
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
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: color }}
              />
              {label}
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {pct(v, c.receipts)}
            </span>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 text-xs font-medium tracking-wide text-slate-400 uppercase">
        Largest donor committees
      </h4>
      {donors.length ? (
        <ol className="mt-2 space-y-2">
          {donors.map((d) => (
            <li key={d.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate text-slate-800 dark:text-slate-100"
                  title={d.name}
                >
                  {d.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {usd(d.total)}
                </span>
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
              {d.industry ? (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {d.industry}
                </p>
              ) : null}
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
            <span className="block text-slate-500 dark:text-slate-400">
              Compare with opponent
            </span>
            <span className="flex items-center gap-1.5 truncate font-medium text-slate-900 dark:text-white">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: partyColorOf(opponent.party) }}
              />
              {opponent.name}
            </span>
          </span>
          <span className="shrink-0 text-slate-600 tabular-nums dark:text-slate-300">
            {usd(opponent.receipts)} →
          </span>
        </button>
      ) : null}

      <Link
        href={`/data/entities/${c.id}`}
        className="mt-4 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        Full profile
      </Link>
    </aside>
  );
}
