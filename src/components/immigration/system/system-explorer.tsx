"use client";

import { ChartColumn, ChevronRight, Flag, GitFork, Info, Workflow, type LucideIcon } from "lucide-react";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { Sparkline } from "@/components/charts/stat-tile";
import { ExplainTerms } from "@/components/ui/term";
import {
  DEFAULT_CHOICES,
  FLOWS,
  HOMES,
  LEGACY_LINKS,
  NODES,
  STAGE_FIGURES,
  STAGES,
  type Block,
  type EdgeKind,
  type Flow,
  type NodeKind,
  type StatKey,
  type SystemNode,
} from "@/lib/immigration/system";

export type Faq = { q: string; a: ReactNode; nodes: string[] };
export type Headline = { value: string; label: string; spark?: number[] };
type StatSlots = Partial<Record<StatKey, ReactNode>>;
type Headlines = Partial<Record<StatKey, Headline>>;
type Notes = { faqs: Faq[] };

// Provisional palette — every node and edge color lives here.
const KIND_STYLE: Record<NodeKind, { card: string; tag: string; label: string }> = {
  root: {
    card: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
    tag: "text-slate-300 dark:text-slate-600",
    label: "Start here",
  },
  stage: {
    card: "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900",
    tag: "text-slate-500 dark:text-slate-400",
    label: "Stage",
  },
  process: {
    card: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
    tag: "text-blue-700 dark:text-blue-300",
    label: "Process",
  },
  decision: {
    card: "border-amber-300 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40",
    tag: "text-amber-700 dark:text-amber-300",
    label: "Decision point",
  },
  outcome: {
    card: "border-emerald-300 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/40",
    tag: "text-emerald-700 dark:text-emerald-300",
    label: "Outcome",
  },
  measure: {
    card: "border-dashed border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40",
    tag: "text-violet-700 dark:text-violet-300",
    label: "Measurement",
  },
  context: {
    card: "border-dotted border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40",
    tag: "text-slate-500 dark:text-slate-400",
    label: "Context",
  },
};
// Left accent bar and icon per kind, so card types read at a glance.
const KIND_ACCENT: Record<NodeKind, { bar: string; icon: LucideIcon; data: string }> = {
  root: { bar: "border-l-slate-900", icon: Workflow, data: "bg-white/10" },
  stage: { bar: "border-l-slate-400", icon: Workflow, data: "bg-slate-50 dark:bg-slate-900" },
  process: { bar: "border-l-blue-500", icon: Workflow, data: "bg-blue-50 dark:bg-blue-950/40" },
  decision: { bar: "border-l-amber-500", icon: GitFork, data: "bg-white/70 dark:bg-amber-950/40" },
  outcome: { bar: "border-l-emerald-500", icon: Flag, data: "bg-white/70 dark:bg-emerald-950/40" },
  measure: { bar: "border-l-violet-500", icon: ChartColumn, data: "bg-white/70 dark:bg-violet-950/40" },
  context: { bar: "border-l-slate-400", icon: Info, data: "bg-white/70 dark:bg-slate-900" },
};
const EDGE_STYLE: Record<EdgeKind, { line: string; label: string }> = {
  step: { line: "border-solid border-slate-300 dark:border-slate-600", label: "Next step" },
  if: { line: "border-dashed border-slate-400 dark:border-slate-500", label: "Only in some cases" },
  status: { line: "border-solid border-emerald-500 dark:border-emerald-400", label: "Change of legal status" },
  context: { line: "border-dotted border-violet-400 dark:border-violet-500", label: "Counted in a measurement" },
};

// Each stage column gets its own accent and width; tracks and long flows need more room.
const STAGE_STYLE: Record<string, { badge: string; column: string; stripe: string; width: string }> = {
  entry: {
    badge: "bg-sky-600 text-white dark:bg-sky-400 dark:text-slate-950",
    column: "border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20",
    stripe: "bg-sky-500",
    width: "sm:w-[34rem]",
  },
  pathways: {
    badge: "bg-violet-600 text-white dark:bg-violet-400 dark:text-slate-950",
    column: "border-violet-200 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/20",
    stripe: "bg-violet-500",
    width: "sm:w-[42rem]",
  },
  processing: {
    badge: "bg-orange-600 text-white dark:bg-orange-400 dark:text-slate-950",
    column: "border-orange-200 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/20",
    stripe: "bg-orange-500",
    width: "sm:w-[42rem]",
  },
  outcomes: {
    badge: "bg-rose-600 text-white dark:bg-rose-400 dark:text-slate-950",
    column: "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20",
    stripe: "bg-rose-500",
    width: "sm:w-[34rem]",
  },
  population: {
    badge: "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950",
    column: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    stripe: "bg-emerald-500",
    width: "sm:w-[34rem]",
  },
};

const NOTE_STYLE = {
  faq: {
    box: "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/25",
    badge: "bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950",
    label: "Common question",
  },
};

const cardDomId = (loc: string) => `card-${loc.replace(/[^a-zA-Z0-9-]/g, "_")}`;
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";
const enter = "motion-safe:animate-[chapter-in_240ms_ease-out]";
const smooth = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

// ------------------------------------------------------------------ Notes

// A home is shown on load when every track it depends on is on its default.
const shownByDefault = (id: string) => {
  const home = HOMES[id];
  return Boolean(home) && Object.entries(home.choices).every(([k, v]) => DEFAULT_CHOICES[k] === v);
};

// Each question and term sits once in the chart, beside the first card it
// belongs to — preferring one that's visible before any track is picked.
function placeNotes(faq: Faq[]): Map<string, Notes> {
  const out = new Map<string, Notes>();
  const at = (loc: string) => {
    let notes = out.get(loc);
    if (!notes) out.set(loc, (notes = { faqs: [] }));
    return notes;
  };
  for (const f of faq) {
    const ids = f.nodes.filter((id) => HOMES[id]);
    const id = ids.find(shownByDefault) ?? ids[0];
    if (id) at(HOMES[id].loc).faqs.push(f);
  }
  return out;
}

// The steps after a card, read from its location: `.../<flow>/s<j>/<id>`.
function nextIds(loc: string | null): string[] | undefined {
  const m = loc?.match(/\/([^/]+)\/s(\d+)\/[^/]+$/);
  return m ? FLOWS[m[1]]?.steps[Number(m[2]) + 1]?.ids : undefined;
}

// ------------------------------------------------------------------ State

interface State {
  collapsed: string[]; // condensed stages
  figures: Record<string, StatKey | null>; // stage -> the figure whose chart is open
  choices: Record<string, string>; // track selector id -> flow id
  node: string | null;
  at: string | null; // the card the node was opened from, if not its home
}

interface Ctx extends State {
  anchor: string | null;
  stats: StatSlots;
  headlines: Headlines;
  faq: Faq[];
  notes: Map<string, Notes>;
  query: string;
  select: (id: string, loc?: string) => void;
  close: () => void;
  choose: (tracks: string, flow: string) => void;
  toggleStage: (id: string) => void;
  goToStage: (id: string) => void;
  pickFigure: (stage: string, stat: StatKey) => void;
}

const SystemContext = createContext<Ctx | null>(null);
const useSystem = () => {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error("Must be inside ImmigrationSystemExplorer");
  return ctx;
};

const matches = (q: string, ...text: (string | undefined)[]) => text.some((t) => t?.toLowerCase().includes(q));

function resolve(state: State, node: string | null, loc?: string): State {
  if (!node || !NODES[node]) return { ...state, node: null, at: null };
  if (NODES[node].kind === "stage")
    return { ...state, collapsed: state.collapsed.filter((x) => x !== node), node: null, at: null };
  const home = HOMES[node];
  const collapsed = state.collapsed.filter((x) => x !== home?.stage);
  const choices = loc ? { ...state.choices } : { ...state.choices, ...home?.choices };
  const opens = NODES[node].opens;
  if (opens) choices[opens.tracks] = opens.flow;
  return { ...state, collapsed, choices, node, at: loc ?? null };
}

// Reads ?node=, falling back to the old page's #chapter and ?focus= links.
function readUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.slice(1);
  const focus = params.get("focus");
  let node = params.get("node");
  if (!node && focus) node = LEGACY_LINKS[focus] ?? null;
  if (!node && hash) node = NODES[hash] ? hash : (LEGACY_LINKS[hash] ?? null);
  return node && NODES[node] ? node : null;
}

function writeUrl(node: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("focus");
  url.searchParams.delete("view"); // the old Overview/Statistics tabs
  if (node) url.searchParams.set("node", node);
  else url.searchParams.delete("node");
  if (url.href === window.location.href) return;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

// Bring a card into view on both axes, leaving it alone if it's already visible.
function bringIntoView(loc: string | null) {
  if (!loc) return;
  const el = document.getElementById(cardDomId(loc));
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top > 72 && r.bottom < window.innerHeight && r.left >= 0 && r.right <= window.innerWidth) return;
  el.scrollIntoView({ behavior: smooth(), block: "center", inline: "start" });
}

// ----------------------------------------------------------------- Pieces

function Connector({ edge = "step", label }: { edge?: EdgeKind; label?: string }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <div className="relative flex h-9 justify-center">
        <span className={`h-full border-l-2 ${EDGE_STYLE[edge].line}`} />
        {label && (
          <span className="absolute top-1/2 left-3 w-max max-w-[14rem] -translate-y-1/2 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            {label}
          </span>
        )}
      </div>
      <span className="-mt-px size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-slate-400 dark:border-t-slate-500" />
    </div>
  );
}

// Arrow between stage columns.
function HConnector() {
  return (
    <div aria-hidden className="hidden shrink-0 items-center self-start pt-10 sm:flex">
      <span className="w-4 border-t-2 border-slate-300 dark:border-slate-600" />
      <span className="-ml-px size-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-slate-400 dark:border-l-slate-500" />
    </div>
  );
}

function NodeCard({ id, loc, compact = false }: { id: string; loc: string; compact?: boolean }) {
  const { node, anchor, select, close, query } = useSystem();
  const n = NODES[id];
  const style = KIND_STYLE[n.kind];
  const accent = KIND_ACCENT[n.kind];
  const Icon = accent.icon;
  const active = node === id && anchor === loc;
  const hit = query ? matches(query, n.title, n.summary) : null;
  const details = () => (active ? close() : select(id, loc));
  return (
    <article
      id={cardDomId(loc)}
      data-hit={hit || undefined}
      className={`flex h-full w-full scroll-mt-28 flex-col rounded-2xl border border-l-4 shadow-sm transition hover:shadow-md ${style.card} ${accent.bar} ${
        active ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950" : ""
      } ${hit ? "ring-2 ring-yellow-400 ring-offset-1 dark:ring-offset-slate-950" : ""} ${hit === false ? "opacity-40" : ""}`}
    >
      <div className="flex flex-1 flex-col justify-start px-4 pt-3 pb-3">
        <button
          type="button"
          onClick={details}
          aria-expanded={active}
          aria-controls={active ? "node-panel" : undefined}
          className={`group rounded-lg text-left ${focusRing}`}
        >
          <span className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase ${style.tag}`}>
            <Icon aria-hidden className="size-3.5" />
            {style.label}
            {node === id && !active && " · open elsewhere"}
          </span>
          <span className={`mt-1 flex items-start gap-1 font-semibold ${compact ? "text-sm" : "text-base"}`}>
            <span className="flex-1">{n.title}</span>
            <ChevronRight
              aria-hidden
              className="mt-0.5 size-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </span>
        </button>
        <span className={`mt-1 block leading-snug opacity-75 ${compact ? "text-xs" : "text-sm"}`}>
          <ExplainTerms ids={n.terms}>{n.teaser ?? n.summary}</ExplainTerms>
        </span>
      </div>
    </article>
  );
}

// A stage's figures, one per process. Each tile is a tab: picking it opens
// that process's chart below the row; picking it again closes it.
function FigureTabs({ stage }: { stage: string }) {
  const { stats, headlines, figures, pickFigure } = useSystem();
  const shown = STAGE_FIGURES[stage].filter((f) => headlines[f.stat] && stats[f.stat]);
  const open = shown.find((f) => f.stat === figures[stage]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!shown.length) return null;
  const style = STAGE_STYLE[stage];
  const panelId = `figure-panel-${stage}`;
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    tabs.current[(i + step + shown.length) % shown.length]?.focus();
  };
  return (
    <div className="mx-3 mb-4 sm:mx-5">
      <div role="tablist" aria-label={`${NODES[stage].title} figures`} className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
        {shown.map((f, i) => {
          const h = headlines[f.stat]!;
          const on = open?.stat === f.stat;
          return (
            <button
              key={f.stat}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`figure-${stage}-${f.stat}`}
              aria-selected={on}
              aria-controls={on ? panelId : undefined}
              tabIndex={on || (!open && i === 0) ? 0 : -1}
              onClick={() => pickFigure(stage, f.stat)}
              onKeyDown={(e) => onKey(e, i)}
              className={`group flex min-w-0 flex-col rounded-2xl border px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${focusRing} ${
                on
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-white/0 bg-white/85 text-slate-950 dark:bg-slate-900/70 dark:text-white"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden className={`size-2 shrink-0 self-start rounded-full mt-1 ${style.stripe}`} />
                <span className={`line-clamp-2 text-[11px] leading-tight font-semibold tracking-wide uppercase ${on ? "opacity-80" : "text-slate-500 dark:text-slate-400"}`}>
                  {NODES[f.node].title}
                </span>
              </span>
              <span className="mt-1 flex flex-wrap items-end justify-between gap-x-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{h.value}</span>
                {h.spark && (
                  <span className={on ? "opacity-80" : ""}>
                    <Sparkline values={h.spark} />
                  </span>
                )}
              </span>
              <span className={`mt-0.5 text-xs leading-snug text-pretty ${on ? "opacity-80" : "text-slate-600 dark:text-slate-300"}`}>{h.label}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div
          key={open.stat}
          id={panelId}
          role="tabpanel"
          aria-labelledby={`figure-${stage}-${open.stat}`}
          className={`mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950 ${enter}`}
        >
          {stats[open.stat]}
        </div>
      )}
    </div>
  );
}

function StepRow({ ids, path, join }: { ids: string[]; path: string; join: boolean }) {
  if (ids.length === 1) return <NodeCard id={ids[0]} loc={`${path}/${ids[0]}`} />;
  // Fork and join bars span the two grid columns.
  const inset = { left: "25%", right: "25%" };
  return (
    <div className="relative w-full">
      <span
        aria-hidden
        className="absolute top-0 hidden border-t-2 @sm:block border-slate-300 dark:border-slate-600"
        style={inset}
      />
      {join && (
        <span
          aria-hidden
          className="absolute bottom-0 hidden border-t-2 @sm:block border-slate-300 dark:border-slate-600"
          style={inset}
        />
      )}
      <div className="grid gap-3 @sm:grid-cols-2">
        {ids.map((id) => (
          <div key={id} className="flex flex-col items-center">
            <span aria-hidden className="hidden h-4 border-l-2 @sm:block border-slate-300 dark:border-slate-600" />
            <div className="w-full flex-1">
              <NodeCard id={id} loc={`${path}/${id}`} compact />
            </div>
            {join && (
              <span aria-hidden className="hidden h-4 border-l-2 @sm:block border-slate-300 dark:border-slate-600" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqNote({ f }: { f: Faq }) {
  const { query } = useSystem();
  const hit = query ? matches(query, f.q) : null;
  const terms = [...new Set(f.nodes.flatMap((id) => NODES[id]?.terms ?? []))];
  return (
    <details
      data-hit={hit || undefined}
      className={`group rounded-xl border-l-4 px-3 py-2 text-[13px] ${NOTE_STYLE.faq.box} ${hit ? "ring-2 ring-yellow-400" : ""} ${hit === false ? "opacity-40" : ""}`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 text-slate-700 dark:text-slate-200">
        <span
          aria-hidden
          className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${NOTE_STYLE.faq.badge}`}
        >
          ?
        </span>
        <span className="flex-1">{f.q}</span>
        <span aria-hidden className="text-indigo-400 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-2 pl-7 leading-6 text-slate-700 dark:text-slate-300">
        {typeof f.a === "string" ? <ExplainTerms ids={terms}>{f.a}</ExplainTerms> : f.a}
      </p>
    </details>
  );
}

function NotesSlot({ locs }: { locs: string[] }) {
  const { notes, query } = useSystem();
  const [open, setOpen] = useState(false);
  const here = locs.map((l) => notes.get(l)).filter((n): n is Notes => Boolean(n));
  const faqs = here.flatMap((n) => n.faqs);
  if (!faqs.length) return null;
  const faqHit = Boolean(query) && faqs.some((f) => matches(query, f.q));
  const showFaqs = faqs.length === 1 || open || faqHit;
  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${focusRing} ${on ? "shadow-sm" : "hover:shadow-sm"}`;
  return (
    <div className="mt-3 space-y-2">
      {faqs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-expanded={showFaqs}
            onClick={() => setOpen((value) => !value)}
            className={`${pill(showFaqs)} ${showFaqs ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950" : "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"}`}
          >
            <span aria-hidden>?</span>
            {faqs.length} questions
          </button>
        </div>
      )}
      {showFaqs && faqs.map((f) => <FaqNote key={f.q} f={f} />)}
    </div>
  );
}

function FlowView({ flow, path }: { flow: Flow; path: string }) {
  return (
    <div className="flex flex-col">
      {flow.steps.map((step, j) => (
        <Fragment key={j}>
          {j > 0 && <Connector edge={step.edge} label={step.label} />}
          <StepRow ids={step.ids} path={`${path}/s${j}`} join={step.ids.length > 1 && j < flow.steps.length - 1} />
          <NotesSlot locs={step.ids.map((id) => `${path}/s${j}/${id}`)} />
        </Fragment>
      ))}
      {flow.after && (
        <div className="mt-8 space-y-8 border-t border-slate-300/70 pt-8 dark:border-slate-700">
          <Blocks blocks={flow.after} path={`${path}/after`} />
        </div>
      )}
    </div>
  );
}

function Tracks({ id, label, flows, path }: { id: string; label: string; flows: string[]; path: string }) {
  const { choices, choose } = useSystem();
  const chosen = choices[id];
  return (
    <div className="flex flex-col">
      <p className="mb-1.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      <div
        role="tablist"
        aria-label={label}
        className="grid grid-cols-2 gap-1 rounded-xl bg-white/80 p-1 shadow-sm @md:grid-cols-4 dark:bg-slate-900"
      >
        {flows.map((flowId) => (
          <button
            key={flowId}
            type="button"
            role="tab"
            aria-selected={chosen === flowId}
            onClick={() => choose(id, flowId)}
            className={`rounded-lg px-2 py-2 text-sm font-medium transition ${focusRing} ${
              chosen === flowId
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            {FLOWS[flowId].label}
          </button>
        ))}
      </div>
      {chosen && flows.includes(chosen) ? (
        <div key={chosen} className={enter}>
          <Connector />
          <FlowView flow={FLOWS[chosen]} path={`${path}/${chosen}`} />
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">Choose one to see its steps.</p>
      )}
    </div>
  );
}

function Blocks({ blocks, path }: { blocks: Block[]; path: string }) {
  return blocks.map((block, i) => {
    const at = `${path}/b${i}`;
    if (block.kind === "flow") return <FlowView key={at} flow={FLOWS[block.id]} path={`${at}/${block.id}`} />;
    if (block.kind === "tracks")
      return <Tracks key={at} id={block.id} label={block.label} flows={block.flows} path={at} />;
    const grid = block.cols === 2 && block.ids.length > 1;
    return (
      <div key={at} className="space-y-3">
        {block.title && (
          <p className="text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {block.title}
          </p>
        )}
        <div className={grid ? "grid gap-3 @sm:grid-cols-2" : "space-y-3"}>
          {block.ids.map((id) => (
            <NodeCard key={id} id={id} loc={`${at}/${id}`} compact={grid} />
          ))}
        </div>
        <NotesSlot locs={block.ids.map((id) => `${at}/${id}`)} />
      </div>
    );
  });
}

function StageColumn({ index, id }: { index: number; id: string }) {
  const { collapsed, toggleStage, stats, headlines, pickFigure, figures: open } = useSystem();
  const n = NODES[id];
  const style = STAGE_STYLE[id];
  const figures = STAGE_FIGURES[id].filter((f) => headlines[f.stat] && stats[f.stat]);
  const condensed = collapsed.includes(id);
  const body = useRef<HTMLDivElement>(null);

  // A condensed stage keeps its cards in the page as hidden="until-found", so
  // the browser's find can match them; a match opens the stage around the same
  // nodes. React's types only allow a boolean `hidden`, so it renders plain
  // hidden and is upgraded here.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    if (!condensed) return;
    el.setAttribute("hidden", "until-found");
    const open = () => flushSync(() => toggleStage(id));
    el.addEventListener("beforematch", open);
    return () => el.removeEventListener("beforematch", open);
  }, [condensed, id, toggleStage]);

  const content = (
    // Keyed so React keeps these nodes when the stage opens around a find match.
    <div key="body" ref={body} hidden={condensed} className={`space-y-8 px-3 pb-6 sm:px-5 ${enter}`}>
      <NotesSlot locs={[`stage/${id}`]} />
      <Blocks blocks={STAGES[index].blocks} path={`stage/${id}`} />
    </div>
  );

  if (condensed)
    return (
      <section id={`stage-${id}`} className="contents">
        <div
          className={`group flex h-full w-full snap-start flex-col overflow-hidden rounded-3xl border transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${style.column}`}
        >
          <span aria-hidden className={`block h-1.5 w-full shrink-0 ${style.stripe}`} />
          <button
            type="button"
            onClick={() => toggleStage(id)}
            aria-expanded={false}
            aria-label={`${index + 1}. ${n.title} — expand stage`}
            className={`flex flex-col rounded-t-3xl p-4 pb-3 text-left ${focusRing}`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${style.badge}`}
              >
                {index + 1}
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Stage {index + 1}
              </span>
            </span>
            <span className="mt-3 text-base leading-snug font-semibold text-balance text-slate-950 dark:text-white">
              {n.title}
            </span>
            <span className="mt-1.5 text-sm leading-snug text-slate-600 dark:text-slate-300">{n.summary}</span>
          </button>
          {figures.length > 0 && (
            <ul className="mx-3 space-y-1">
              {figures.map((f) => {
                const h = headlines[f.stat]!;
                return (
                  <li key={f.stat}>
                    <button
                      type="button"
                      onClick={() => pickFigure(id, f.stat)}
                      title={`${NODES[f.node].title}: ${h.value} ${h.label}`}
                      className={`flex w-full flex-col rounded-xl bg-white/85 px-2.5 py-1.5 text-left shadow-sm transition hover:bg-white hover:shadow dark:bg-slate-900/70 dark:hover:bg-slate-900 ${focusRing}`}
                    >
                      <span className="text-sm font-semibold text-slate-950 tabular-nums dark:text-white">{h.value}</span>
                      <span className="text-[11px] leading-tight text-slate-600 dark:text-slate-300">{NODES[f.node].title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => toggleStage(id)}
            tabIndex={-1}
            aria-hidden
            className="mt-auto self-start p-4 pt-3"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 transition group-hover:border-slate-400 group-hover:bg-white group-hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:group-hover:bg-slate-900 dark:group-hover:text-white">
              Expand stage
              <ChevronRight aria-hidden className="size-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
        {content}
      </section>
    );
  return (
    <section
      id={`stage-${id}`}
      aria-labelledby={`stage-title-${id}`}
      // An open figure's chart needs room for its explorer's side-by-side views.
      className={`@container w-[88vw] shrink-0 snap-start overflow-hidden rounded-3xl border transition-[width] ${open[id] ? "sm:w-[min(64rem,calc(100vw-4rem))]" : style.width} ${style.column}`}
    >
      <span aria-hidden className={`block h-1.5 ${style.stripe}`} />
      <header className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.badge}`}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`stage-title-${id}`} className="text-lg font-semibold text-slate-950 dark:text-white">
            {n.title}
          </h3>
          <p className="mt-0.5 text-sm leading-snug text-slate-600 dark:text-slate-300">
            <ExplainTerms ids={n.terms}>{n.summary}</ExplainTerms>
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleStage(id)}
          aria-expanded
          title={`Condense ${n.title}`}
          className={`shrink-0 rounded-lg border border-slate-300 bg-white/70 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white ${focusRing}`}
        >
          − Condense
        </button>
      </header>
      <FigureTabs stage={id} />
      {content}
    </section>
  );
}

// ------------------------------------------------------------------ Panel

function List({ title, items, terms }: { title: string; items?: string[]; terms?: SystemNode["terms"] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>
            <ExplainTerms ids={terms}>{item}</ExplainTerms>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Links({ title, refs }: { title: string; refs?: { label: string; href: string }[] }) {
  if (!refs?.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h4>
      <ul className="mt-1.5 space-y-1 text-sm">
        {refs.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline dark:text-blue-300"
            >
              {r.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NodeChips({ title, ids }: { title: string; ids?: string[] }) {
  const { select } = useSystem();
  if (!ids?.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            className={`rounded-full border px-3 py-1 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${KIND_STYLE[NODES[id].kind].card} ${focusRing}`}
          >
            {NODES[id].title}
          </button>
        ))}
      </div>
    </div>
  );
}

// Slide-over sheet: the columns are too narrow for charts.
function NodePanel({ id, next }: { id: string; next?: string[] }) {
  const { close, stats, goToStage } = useSystem();
  const title = useRef<HTMLHeadingElement>(null);
  const n = NODES[id];
  const slots = (n.stats ?? []).filter((k) => stats[k]);
  const hasRules = [n.triggers, n.rights, n.outcomes, n.review].some((x) => x?.length);
  const hasProcess = [n.triggers, n.rights, n.outcomes, n.review, n.earlier].some((x) => x?.length);
  const hasRelated = [n.related, next].some((x) => x?.length);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden
        onClick={close}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] motion-safe:animate-[chapter-in_160ms_ease-out]"
      />
      <section
        id="node-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-panel-title"
        className="relative flex h-full w-full max-w-4xl flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl motion-safe:animate-[sheet-in_220ms_ease-out] sm:p-6 dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold tracking-wider uppercase ${KIND_STYLE[n.kind].tag}`}>
              {KIND_STYLE[n.kind].label}
            </p>
            <h3
              ref={title}
              tabIndex={-1}
              id="node-panel-title"
              className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950 outline-none dark:text-white"
            >
              <ExplainTerms ids={n.terms}>{n.title}</ExplainTerms>
            </h3>
            <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-300">
              <ExplainTerms ids={n.terms}>{n.summary}</ExplainTerms>
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className={`shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
          >
            Close ✕
          </button>
        </div>

        <div className="mt-5 space-y-8">
          {n.kind === "root" && (
            <section>
              <h4 className="mb-4 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                The five stages
              </h4>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STAGES.map((stage, i) => (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        goToStage(stage.id);
                      }}
                      className={`flex h-full w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition hover:shadow-md ${STAGE_STYLE[stage.id].column} ${focusRing}`}
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${STAGE_STYLE[stage.id].badge}`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                          {NODES[stage.id].title}
                        </span>
                        <span className="mt-1.5 block list-disc space-y-1 pl-4 text-sm leading-snug text-slate-600 dark:text-slate-300">
                          {(NODES[stage.id].points ?? [NODES[stage.id].summary]).map((point) => (
                            <span key={point} className="list-item">
                              {point}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              {n.body?.map((p) => (
                <p key={p} className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  <ExplainTerms ids={n.terms}>{p}</ExplainTerms>
                </p>
              ))}
            </section>
          )}
          {n.kind !== "root" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="max-w-3xl space-y-3 text-base leading-7 text-slate-700 dark:text-slate-300">
                {(n.body ?? [n.summary]).map((p) => (
                  <p key={p}>
                    <ExplainTerms ids={n.terms}>{p}</ExplainTerms>
                  </p>
                ))}
              </div>
              <div className="space-y-5">
                {!n.roles && <List title="Responsible" items={n.agency} terms={n.terms} />}
                <Links title="Official sources" refs={n.sources} />
              </div>
            </div>
          )}
          {slots.length > 0 && (
            <section className="space-y-6 border-t border-slate-200 pt-6 dark:border-slate-800">
              <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Statistics
              </h4>
              {n.units && (
                <p className="max-w-3xl rounded-r-xl border-l-4 border-slate-900 bg-slate-50 px-4 py-2 text-sm leading-6 text-slate-600 dark:border-white dark:bg-slate-900/60 dark:text-slate-300">
                  <ExplainTerms ids={n.terms}>{n.units}</ExplainTerms>
                </p>
              )}
              {slots.map((key) => (
                <div key={key}>{stats[key]}</div>
              ))}
            </section>
          )}
          {n.roles && (
            <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
              <h4 className="mb-4 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Who does what
              </h4>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {n.roles.map((r) => (
                  <div
                    key={r.agency}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <dt className="text-sm font-semibold text-slate-950 dark:text-white">
                      <ExplainTerms ids={n.terms}>{r.agency}</ExplainTerms>
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <ExplainTerms ids={n.terms}>{r.does}</ExplainTerms>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {hasProcess && (
            <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
              <h4 className="mb-4 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Legal process
              </h4>
              <div className={`grid gap-6 ${hasRules ? "md:grid-cols-2" : ""}`}>
                {hasRules && (
                  <div className="space-y-5">
                    <List title="When it applies" items={n.triggers} terms={n.terms} />
                    <List title="Rights and protections" items={n.rights} terms={n.terms} />
                    <List title="Possible outcomes" items={n.outcomes} terms={n.terms} />
                    <List title="Review and appeal" items={n.review} terms={n.terms} />
                  </div>
                )}
                <div className="space-y-5">
                  <List title="Earlier and changing rules" items={n.earlier} terms={n.terms} />
                </div>
              </div>
            </section>
          )}
          {hasRelated && (
            <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
              <h4 className="mb-4 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Related
              </h4>
              <div className="space-y-6">
                <NodeChips title="Next in this process" ids={next?.filter((x) => x !== id)} />
                <NodeChips title="See also" ids={n.related} />
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------- Root

export function ImmigrationSystemExplorer({
  stats,
  headlines,
  faq,
}: {
  stats: StatSlots;
  headlines: Headlines;
  faq: Faq[];
}) {
  const [state, setState] = useState<State>({
    collapsed: STAGES.map((x) => x.id),
    figures: {},
    choices: { ...DEFAULT_CHOICES },
    node: null,
    at: null,
  });
  const [query, setQuery] = useState("");
  const [edges, setEdges] = useState({ start: true, end: false });
  const canvas = useRef<HTMLDivElement>(null);
  const hitIndex = useRef(-1);
  const scrollTo = useRef<"card" | null>(null);
  const anchor = state.node ? (state.at ?? HOMES[state.node]?.loc ?? null) : null;
  const notes = useMemo(() => placeNotes(faq), [faq]);
  const q = query.trim().toLowerCase();

  // The page is one cached static render, so the URL is read after hydration.
  useEffect(() => {
    const sync = (initial: boolean) => {
      const node = readUrl();
      setState((s) => resolve(s, node));
      if (initial) writeUrl(node, "replace");
      scrollTo.current = node ? "card" : null;
    };
    sync(true);
    const onPop = () => sync(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const target = scrollTo.current;
    // On load the URL is read before the node resolves; wait for its card.
    if (target === "card" && !anchor) return;
    scrollTo.current = null;
    if (target === "card") requestAnimationFrame(() => bringIntoView(anchor));
  }, [anchor, state.collapsed]);

  // The sheet is modal: lock the page and close on Escape.
  const open = Boolean(state.node);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setState((s) => ({ ...s, node: null, at: null }));
      writeUrl(null, "push");
    };
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onScroll = () => {
    const el = canvas.current;
    if (!el) return;
    const next = { start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 };
    setEdges((e) => (e.start === next.start && e.end === next.end ? e : next));
  };
  useEffect(onScroll);
  useEffect(() => {
    window.addEventListener("resize", onScroll);
    return () => window.removeEventListener("resize", onScroll);
  }, []);

  // Browsers without hidden="until-found" can't find text in condensed stages,
  // so opening their find bar expands every stage first.
  useEffect(() => {
    if ("onbeforematch" in HTMLElement.prototype) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") setState((s) => ({ ...s, collapsed: [] }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goToStage = (id: string) => {
    setState((s) => ({ ...s, collapsed: s.collapsed.filter((x) => x !== id) }));
    requestAnimationFrame(() =>
      document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: smooth(), block: "nearest", inline: "start" }),
    );
  };
  const ctx: Ctx = {
    ...state,
    anchor,
    stats,
    headlines,
    faq,
    notes,
    query: q,
    select: (id, loc) => {
      setState((s) => resolve(s, id, loc));
      writeUrl(NODES[id].kind === "stage" ? null : id, "push");
      // A card that was clicked is already in view; one picked from the sheet may not be.
      scrollTo.current = loc ? null : "card";
    },
    close: () => {
      setState((s) => ({ ...s, node: null, at: null }));
      writeUrl(null, "push");
    },
    choose: (tracks, flow) => setState((s) => ({ ...s, choices: { ...s.choices, [tracks]: flow } })),
    pickFigure: (stage, stat) => {
      const fig = STAGE_FIGURES[stage].find((f) => f.stat === stat);
      setState((s) => {
        const opening = s.figures[stage] !== stat || s.collapsed.includes(stage);
        return {
          ...s,
          collapsed: s.collapsed.filter((x) => x !== stage),
          figures: { ...s.figures, [stage]: opening ? stat : null },
          choices: opening && fig?.track ? { ...s.choices, [fig.track.tracks]: fig.track.flow } : s.choices,
        };
      });
      // Picked from a condensed card, the stage opens wider; bring it into view.
      if (state.collapsed.includes(stage))
        requestAnimationFrame(() =>
          document.getElementById(`stage-${stage}`)?.scrollIntoView({ behavior: smooth(), block: "nearest", inline: "start" }),
        );
    },
    toggleStage: (id) => {
      const closing = !state.collapsed.includes(id);
      const loseNode = closing && state.node && HOMES[state.node]?.stage === id;
      setState((s) => ({
        ...s,
        collapsed: closing ? [...s.collapsed, id] : s.collapsed.filter((x) => x !== id),
        ...(loseNode ? { node: null, at: null } : {}),
      }));
      if (loseNode) writeUrl(null, "push");
    },
    goToStage,
  };

  const overview = () => {
    setState((s) => ({ ...s, collapsed: STAGES.map((x) => x.id), node: null, at: null }));
    writeUrl(null, "push");
    canvas.current?.scrollTo({ left: 0, behavior: smooth() });
    document.getElementById("immigration-system")?.scrollIntoView({ behavior: smooth() });
  };
  const page = (dir: 1 | -1) =>
    canvas.current?.scrollBy({ left: dir * canvas.current.clientWidth * 0.8, behavior: smooth() });
  const nextHit = () => {
    const hits = canvas.current?.querySelectorAll<HTMLElement>("[data-hit]");
    if (!hits?.length) return;
    hitIndex.current = (hitIndex.current + 1) % hits.length;
    hits[hitIndex.current].scrollIntoView({ behavior: smooth(), block: "center", inline: "center" });
  };
  const allCollapsed = state.collapsed.length === STAGES.length;
  const utility = `rounded-lg px-2 py-1.5 text-left sm:px-2.5 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`;
  const pager = `pointer-events-auto absolute top-24 z-10 hidden size-10 items-center justify-center rounded-full border border-slate-300 bg-white/95 text-slate-700 shadow-md transition hover:bg-white hover:text-slate-950 sm:flex dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:text-white ${focusRing}`;

  return (
    <SystemContext.Provider value={ctx}>
      <div id="immigration-system" className="scroll-mt-24 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <nav
            aria-label="Stages"
            className="flex gap-1.5 overflow-x-auto p-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:flex-wrap sm:[mask-image:none]"
          >
            {STAGES.map((stage, i) => {
              const expanded = !state.collapsed.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => goToStage(stage.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-medium whitespace-nowrap text-slate-800 transition hover:border-slate-400 dark:text-slate-100 dark:hover:border-slate-500 ${
                    expanded
                      ? STAGE_STYLE[stage.id].column
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                  } ${focusRing}`}
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${STAGE_STYLE[stage.id].badge}`}
                  >
                    {i + 1}
                  </span>
                  {NODES[stage.id].title}
                </button>
              );
            })}
          </nav>
          <div className="flex flex-col gap-2 border-t border-slate-200 p-2 sm:flex-row sm:items-center dark:border-slate-800">
            <label className="flex flex-1 items-center sm:max-w-md">
              <span className="sr-only">Search the immigration system</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  hitIndex.current = -1;
                }}
                onKeyDown={(e) => e.key === "Enter" && nextHit()}
                placeholder="Search steps and questions"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <div className="grid grid-cols-2 gap-0.5 sm:ml-auto sm:flex sm:items-center">
              <button type="button" onClick={overview} className={utility}>
                Reset view
              </button>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, collapsed: allCollapsed ? [] : STAGES.map((x) => x.id) }))}
                className={utility}
              >
                {allCollapsed ? "Expand all" : "Condense all"}
              </button>
              <Legend className={utility} />
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            ref={canvas}
            data-canvas
            onScroll={onScroll}
            className="-mx-1 snap-x snap-proximity overflow-x-auto px-1 pt-1 pb-4 [scrollbar-color:var(--color-slate-300)_transparent] [scrollbar-width:thin]"
          >
            <div className="flex w-full items-start gap-0 sm:gap-1">
              <div className="mr-3 w-[70vw] max-w-72 shrink-0 snap-start space-y-3 sm:mr-2 sm:w-56">
                <NodeCard id="system" loc="root/system" />
                <NotesSlot locs={["root/system"]} />
              </div>
              {STAGES.map((stage, i) => {
                const condensed = state.collapsed.includes(stage.id);
                return (
                  <Fragment key={stage.id}>
                    <HConnector />
                    <div
                      className={`mr-3 sm:mr-0 ${
                        condensed
                          ? `flex min-w-44 flex-1 basis-0 ${allCollapsed ? "self-stretch" : "self-start"}`
                          : "shrink-0"
                      }`}
                    >
                      <StageColumn index={i} id={stage.id} />
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
          {/* Fades and arrows show there's more on that side. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--background)] to-transparent transition-opacity ${edges.start ? "opacity-0" : "opacity-100"}`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--background)] to-transparent transition-opacity ${edges.end ? "opacity-0" : "opacity-100"}`}
          />
          {!edges.start && (
            <button
              type="button"
              aria-label="Scroll the chart left"
              onClick={() => page(-1)}
              className={`${pager} left-1`}
            >
              <ChevronRight aria-hidden className="size-5 rotate-180" />
            </button>
          )}
          {!edges.end && (
            <button
              type="button"
              aria-label="Scroll the chart right"
              onClick={() => page(1)}
              className={`${pager} right-1`}
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          )}
        </div>

        <p className="-mt-2 px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Click a figure to see its chart, or any card for details, data, and the law. Each figure counts something
          different: events, grants, or people.
        </p>

      </div>
      {state.node && <NodePanel id={state.node} next={nextIds(anchor)} />}
    </SystemContext.Provider>
  );
}

function Legend({ className }: { className: string }) {
  return (
    <details className="group relative text-sm">
      <summary className={`cursor-pointer list-none ${className}`}>How to read ▾</summary>
      <div className="absolute right-0 z-20 mt-2 grid w-[22rem] max-w-[90vw] gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950">
        {(["process", "decision", "outcome", "measure"] as const).map((k) => (
          <span key={k} className="flex items-center gap-2">
            <span className={`inline-block h-4 w-6 rounded border ${KIND_STYLE[k].card}`} />
            {KIND_STYLE[k].label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className={`inline-block h-4 w-6 rounded border-l-4 ${NOTE_STYLE.faq.box}`} />
          {NOTE_STYLE.faq.label}
        </span>
        {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((k) => (
          <span key={k} className="flex items-center gap-2">
            <span className={`inline-block w-6 border-t-2 ${EDGE_STYLE[k].line}`} />
            {EDGE_STYLE[k].label}
          </span>
        ))}
        <span className="text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
          Arrows show what the law allows, not measured movement between steps.
        </span>
      </div>
    </details>
  );
}
