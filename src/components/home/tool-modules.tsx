import Link from "next/link";
import { ArrowRight, Banknote, BookOpenCheck, Database, Gavel, MapPin, Network, Vote } from "lucide-react";
import { ToolLogo } from "@/components/tools/tool-logos";
import { formatValue } from "@/lib/format";
import { CATALOG } from "@/lib/quiz/catalog";
import type { NavPreviews } from "@/lib/nav-previews";

export interface TrendSample {
  label: string; value: number | null; unit: string; period: string; source: string; values: number[];
  firstPeriod?: string; lastPeriod?: string; events?: TrendEvent[];
}
export interface TrendEvent { position: number; label: string }
export interface DemographicSample { period: string; source: string; categories: { label: string; value: number; color: string }[] }
export interface PlatformFacts {
  people?: { entities: number; relationships: number; recent: string[] };
  money?: { contributions: number; usdTotal: number; topRecipients?: { name: string; total: number }[]; coverage?: string };
  legislation?: { bills: number; rollCalls: number };
  elections?: { cycle: number; races: number };
}

export function ToolModules({ immigration, crime, demographics, facts, previews, datasetCount, publisherCount }: {
  immigration: TrendSample | null; crime: TrendSample | null; demographics: DemographicSample | null;
  facts: PlatformFacts; previews: NavPreviews; datasetCount: number; publisherCount: number;
}) {
  return (
    <div className="space-y-12 pb-12 pt-4 lg:space-y-14 lg:pb-14">
      <SignalsSection immigration={immigration} crime={crime} demographics={demographics} />
      <PowerSection facts={facts} previews={previews} />
      <DemocracySection facts={facts} preview={previews.democracy} />
      <WorkspacesSection previews={previews} facts={facts} />
      <TrustSection datasetCount={datasetCount} publisherCount={publisherCount} />
    </div>
  );
}

function SectionHeading({ label, title, action, href }: { label: string; title: string; action?: string; href?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">{label}</p><h2 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl dark:text-white">{title}</h2></div>
      {action && href ? <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{action} <ArrowRight size={14} aria-hidden /></Link> : null}
    </div>
  );
}

function SignalsSection({ immigration, crime, demographics }: { immigration: TrendSample | null; crime: TrendSample | null; demographics: DemographicSample | null }) {
  const topics = [["Guns", "/guns"], ["Abortion", "/abortion"], ["Economy", "/economy"], ["Housing", "/housing"], ["Healthcare", "/healthcare"], ["Energy & climate", "/energy"], ["Education", "/education"], ["Religion", "/religion"], ["Family", "/family"]] as const;
  return (
    <section id="issues" className="scroll-mt-24">
      <SectionHeading label="Explore by topic" title="Issues and society" action="Browse every issue" href="/issueview" />
      <div className="mt-5 grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-[1.2fr_.8fr] dark:border-slate-800 dark:bg-slate-950">
        <Link href="/immigration" className="group p-5 sm:p-7 lg:border-r lg:border-slate-200 dark:lg:border-slate-800"><PreviewHeader title="Immigration" action="Explore immigration" />{immigration ? <TrendChart sample={immigration} color="#2563eb" large /> : <NoPreview />}</Link>
        <div className="grid border-t border-slate-200 sm:grid-cols-2 md:grid-cols-1 md:border-t-0 dark:border-slate-800">
          <Link href="/crime" className="group p-5 sm:border-r sm:p-6 md:border-r-0 md:border-b dark:border-slate-800"><PreviewHeader title="Crime" action="Explore crime" />{crime ? <TrendChart sample={crime} color="#c2410c" /> : <NoPreview />}</Link>
          <Link href="/demographics" className="group p-5 sm:p-6"><PreviewHeader title="Demographics" action="Explore demographics" />{demographics ? <Composition sample={demographics} /> : <NoPreview />}</Link>
        </div>
      </div>
      <nav aria-label="More topics" className="mt-3 flex gap-x-4 gap-y-2 overflow-x-auto border-b border-slate-200 pb-3 dark:border-slate-800">{topics.map(([label, href]) => <Link key={href} href={href} className="shrink-0 text-sm font-medium text-slate-600 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-300">{label}</Link>)}</nav>
    </section>
  );
}

function PreviewHeader({ title, action }: { title: string; action: string }) {
  return <div className="mb-5 flex items-center justify-between gap-4"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3><span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 group-hover:underline dark:text-blue-300">{action} <ArrowRight size={12} /></span></div>;
}

function PowerSection({ facts, previews }: { facts: PlatformFacts; previews: NavPreviews }) {
  return (
    <section id="power" className="scroll-mt-24 border-y border-slate-300 py-8 dark:border-slate-700">
      <div className="grid gap-8 sm:grid-cols-[.78fr_1.22fr]">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Power</p>
          <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl dark:text-white">People, money, and decisions</h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Move from an official or organization to political giving, institutional ties, legislation, and votes without losing the underlying source.</p>
          <div className="mt-7 grid grid-cols-3 gap-4 border-y border-slate-200 py-5 dark:border-slate-800"><DarkFact value={facts.people?.entities} label="profiles" /><DarkFact value={facts.people?.relationships} label="relationships" /><DarkFact value={facts.money?.contributions} label="money records" /></div>
          <Link href="/people" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Investigate people and power <ArrowRight size={14} /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/people" className="group border-t-2 border-slate-950 pt-4 dark:border-white">
            <div className="flex items-center justify-between"><Network size={18} className="text-slate-500" /><span className="text-xs text-slate-500">Relationship index</span></div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">{previews.power.categories.map((category) => <span key={category.label} className="border-b border-slate-200 pb-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">{category.label} <b className="float-right text-slate-950 dark:text-white">{category.count}</b></span>)}</div>
            <p className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{previews.power.total} documented relationship types <ArrowRight size={13} className="ml-1 inline transition-transform group-hover:translate-x-1" /></p>
          </Link>
          <Link href="/money" className="group border-t-2 border-slate-950 pt-4 dark:border-white">
            <div className="flex items-center justify-between"><Banknote size={18} className="text-slate-500" /><span className="text-xs text-slate-500">FEC records · USD</span></div>
            <p className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">{formatValue(facts.money?.usdTotal ?? 0, "usd", { compact: true })}</p><p className="text-xs text-slate-500">itemized money tracked</p>
            <RecipientBars recipients={facts.money?.topRecipients ?? []} />
            <p className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">Investigate political money <ArrowRight size={13} className="ml-1 inline transition-transform group-hover:translate-x-1" /></p>
          </Link>
          <Link href="/legislation" className="group border-t border-slate-200 pt-4 sm:col-span-2 dark:border-slate-800">
            <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr_auto]"><Gavel size={20} className="text-slate-500" /><div><p className="font-semibold text-slate-950 dark:text-white">Legislation and roll-call decisions</p><p className="mt-1 text-sm text-slate-500">Sponsors, bill status, member votes, court records, and source documents.</p></div><div className="flex gap-6 text-right"><DarkFact value={facts.legislation?.bills} label="bills" /><DarkFact value={facts.legislation?.rollCalls} label="roll calls" /></div></div>
          </Link>
        </div>
      </div>
    </section>
  );
}

function DarkFact({ value, label }: { value?: number; label: string }) { return <div><p className="text-lg font-semibold text-slate-950 tabular-nums sm:text-xl dark:text-white">{value == null ? "—" : value.toLocaleString()}</p><p className="mt-0.5 text-[11px] text-slate-500">{label}</p></div>; }
function RecipientBars({ recipients }: { recipients: { name: string; total: number }[] }) {
  const shown = recipients.slice(0, 3); const max = shown[0]?.total || 1;
  return <div className="mt-4 space-y-2.5">{shown.map((recipient) => <div key={recipient.name}><div className="flex justify-between gap-3 text-[11px]"><span className="truncate text-slate-600 dark:text-slate-300">{recipient.name}</span><span className="shrink-0 tabular-nums text-slate-500">{formatValue(recipient.total, "usd", { compact: true })}</span></div><div className="mt-1 h-px bg-slate-200 dark:bg-slate-800"><span className="block h-full bg-slate-900 dark:bg-slate-100" style={{ width: `${Math.max(4, recipient.total / max * 100)}%` }} /></div></div>)}</div>;
}

function DemocracySection({ facts, preview }: { facts: PlatformFacts; preview: NavPreviews["democracy"] }) {
  return (
    <section id="my-government" className="scroll-mt-24">
      <SectionHeading label="Government" title="Elections and representation" action="Explore election results" href="/elections" />
      <div className="mt-5 grid gap-4 sm:grid-cols-[1.08fr_.92fr]">
        <Link href="/elections" className="group rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-950 dark:text-white">Presidential result by state</p><p className="mt-1 text-xs text-slate-500">MIT Election Data and Science Lab · {preview?.year ?? "latest cycle"}</p></div><Vote size={20} className="text-slate-400" /></div>
          {preview ? <ElectionTileMap preview={preview} /> : <NoPreview />}
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800"><div><p className="text-2xl font-semibold text-slate-950 dark:text-white">{facts.elections?.races.toLocaleString() ?? "—"}</p><p className="text-xs text-slate-500">races indexed for {facts.elections?.cycle ?? "the latest cycle"}</p></div><span className="text-sm font-semibold text-blue-700 group-hover:underline dark:text-blue-300">Results, ratings, and maps <ArrowRight size={13} className="inline" /></span></div>
        </Link>
        <AddressLookup />
      </div>
    </section>
  );
}

function ElectionTileMap({ preview }: { preview: NonNullable<NavPreviews["democracy"]> }) {
  const cols = Math.max(...preview.states.map((state) => state.col)) + 1; const rows = Math.max(...preview.states.map((state) => state.row)) + 1;
  return <svg viewBox={`0 0 ${cols * 12} ${rows * 12}`} role="img" aria-label={`${preview.year} presidential winner by state`} className="mx-auto mt-5 h-40 w-full max-w-xl">{preview.states.map((state) => <g key={state.abbr}><rect x={state.col * 12 + .7} y={state.row * 12 + .7} width={10.6} height={10.6} rx={1.5} fill={state.winner === "D" ? "#3b82f6" : state.winner === "R" ? "#ef4444" : "#cbd5e1"}><title>{state.abbr}</title></rect><text x={state.col * 12 + 6} y={state.row * 12 + 6.2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="3.2" fontWeight="600">{state.abbr}</text></g>)}</svg>;
}

function AddressLookup() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2"><MapPin size={18} className="text-blue-700 dark:text-blue-300" /><h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Who represents your address?</h3></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Federal, state, county, city, school board, and judicial offices in one lookup.</p>
      <form action="/my-government" className="mt-5 flex flex-col gap-2"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><MapPin size={16} className="shrink-0 text-slate-400" aria-hidden /><span className="sr-only">Your address</span><input name="address" type="text" autoComplete="street-address" placeholder="Street address, city, state, ZIP" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white" /></label><button type="submit" className="h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">Find my government</button></form>
      <p className="mt-3 text-xs text-slate-500">Your address is used for the lookup and is not saved. <Link href="/privacy#address-lookups" className="underline underline-offset-2">Privacy</Link></p>
    </div>
  );
}

function WorkspacesSection({ previews, facts }: { previews: NavPreviews; facts: PlatformFacts }) {
  return (
    <section id="tools" className="scroll-mt-24">
      <SectionHeading label="Tools" title="Analytical workspaces" action="See all tools" href="/tools" />
      <div className="mt-5 grid gap-4 sm:grid-cols-[1.08fr_.92fr]">
        <Link href="/subpoena" className="group border-y border-slate-300 py-6 dark:border-slate-700">
          <div className="flex items-start justify-between gap-5"><ToolLogo tool="subpoena" size={52} priority /><span className="text-xs font-semibold text-slate-500">People & money</span></div>
          <div className="mt-10 max-w-xl"><p className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Build a case file in Subpoena.</p><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Biography, political giving, institutional ties, quotes, and source records in one canonical profile.</p></div>
          <div className="mt-6 grid grid-cols-2 border-y border-slate-200 sm:grid-cols-4 dark:border-slate-800">{[{ icon: Network, value: facts.people?.relationships, label: "relationships" }, { icon: Banknote, value: facts.money?.contributions, label: "money records" }, { icon: Database, value: facts.people?.entities, label: "entities" }, { icon: BookOpenCheck, value: previews.power.total, label: "tie types" }].map((item) => <div key={item.label} className="py-3 sm:border-r sm:px-3 sm:last:border-r-0 dark:border-slate-800"><item.icon size={14} className="text-slate-500" /><p className="mt-2 font-semibold text-slate-950 tabular-nums dark:text-white">{item.value?.toLocaleString() ?? "—"}</p><p className="text-[11px] text-slate-500">{item.label}</p></div>)}</div>
          <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300">Open Subpoena <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></p>
        </Link>
        <div className="grid gap-3"><WorkspaceRow tool="writ" title="Writ" description="Trace bills, roll calls, courts, election shifts, and close races." visual={<MiniVoteVisual bills={facts.legislation?.bills ?? 0} votes={facts.legislation?.rollCalls ?? 0} />} /><WorkspaceRow tool="issueview" title="IssueView" description="Compare state and county metrics across every issue." visual={<MiniSocietyTrend preview={previews.society} />} /><WorkspaceRow tool="atlas" title="Worldview Atlas" description={`Map ${CATALOG.axes} political dimensions and compare ${CATALOG.traditions} traditions.`} visual={<MiniAxes axes={previews.tools} />} /></div>
      </div>
    </section>
  );
}

function WorkspaceRow({ tool, title, description, visual }: { tool: "writ" | "issueview" | "atlas"; title: string; description: string; visual: React.ReactNode }) {
  return <Link href={`/${tool}`} className="group grid min-h-32 grid-cols-[auto_1fr] items-center gap-4 border-b border-slate-200 py-4 first:border-t dark:border-slate-800"><ToolLogo tool={tool} size={42} /><div><h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">Open workspace <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" /></span></div><div className="col-span-2 sm:col-span-1 sm:pl-14 md:col-span-2">{visual}</div></Link>;
}
function MiniVoteVisual({ bills, votes }: { bills: number; votes: number }) { return <div className="flex gap-6 border-t border-slate-200 pt-2 text-left dark:border-slate-800"><div><b className="block text-sm text-slate-950 dark:text-white">{bills.toLocaleString()}</b><span className="text-[10px] text-slate-500">bills</span></div><div><b className="block text-sm text-slate-950 dark:text-white">{votes.toLocaleString()}</b><span className="text-[10px] text-slate-500">votes</span></div></div>; }
function MiniSocietyTrend({ preview }: { preview: NavPreviews["society"] }) {
  if (!preview) return <span className="text-xs text-slate-500">Cross-topic comparison</span>;
  const all = preview.lines.flatMap((line) => line.points.map((point) => point[1])); const min = Math.min(...all); const max = Math.max(...all); const span = max - min || 1;
  const points = (line: (typeof preview.lines)[number]) => line.points.map(([year, value]) => `${(year - preview.years[0]) / (preview.years[1] - preview.years[0]) * 100},${32 - (value - min) / span * 28}`).join(" ");
  return <div><svg viewBox="0 0 100 36" role="img" aria-label={`Population trends, ${preview.years[0]} to ${preview.years[1]}`} className="h-14 w-full">{preview.lines.map((line) => <polyline key={line.label} points={points(line)} fill="none" stroke={line.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke"><title>{line.label}</title></polyline>)}</svg><p className="text-center text-[9px] text-slate-500">Census population trends</p></div>;
}
function MiniAxes({ axes }: { axes: NavPreviews["tools"] }) { return <div className="space-y-2" aria-hidden>{axes.slice(0, 3).map((axis) => <div key={axis.name}><div className="relative h-px bg-slate-300 dark:bg-slate-700"><span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-y-1/2 bg-slate-500" /></div><p className="mt-1 truncate text-center text-[9px] text-slate-500">{axis.name}</p></div>)}</div>; }

function TrustSection({ datasetCount, publisherCount }: { datasetCount: number; publisherCount: number }) {
  return <section className="grid items-center gap-4 border-t border-slate-300 py-5 sm:grid-cols-[auto_1fr_auto] dark:border-slate-700"><Database size={19} className="text-slate-500" /><div><h2 className="font-semibold text-slate-950 dark:text-white">Every figure stays attached to its source.</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{datasetCount || "Public"} datasets from {publisherCount || "government and research"} publishers, with definitions, coverage, update dates, and original records.</p></div><Link href="/datasets" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Review the dataset catalog <ArrowRight size={14} /></Link></section>;
}

function TrendChart({ sample, color, large = false }: { sample: TrendSample; color: string; large?: boolean }) {
  const width = large ? 620 : 340; const height = large ? 190 : 124; const margin = { top: 22, right: 8, bottom: 24, left: 48 };
  const min = Math.min(...sample.values); const max = Math.max(...sample.values); const range = max - min || 1; const yTicks = [max, min + range / 2, min];
  const y = (value: number) => margin.top + (max - value) / range * (height - margin.top - margin.bottom); const points = linePoints(sample.values, width, height, margin, min, max);
  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-xs text-slate-500 dark:text-slate-400">{sample.label}</p><p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{formatValue(sample.value, sample.unit, { compact: true })}</p></div><p className="text-right text-xs text-slate-500">{sample.period}</p></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${sample.label} from ${sample.firstPeriod ?? "the first observation"} to ${sample.lastPeriod ?? sample.period}`} className={`${large ? "h-52" : "h-36"} mt-3 w-full overflow-visible`}>{yTicks.map((tick) => <g key={tick}><line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" /><text x={margin.left - 7} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{formatValue(tick, sample.unit, { compact: true })}</text></g>)}{sample.events?.map((event) => { const x = margin.left + event.position * (width - margin.left - margin.right); const flip = x > width - 110; return <g key={`${event.position}-${event.label}`}><line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke="currentColor" strokeDasharray="3 3" className="text-slate-400" /><text x={x + (flip ? -4 : 4)} y={12} textAnchor={flip ? "end" : "start"} className="fill-slate-500 text-[9px] font-medium dark:fill-slate-400">{event.label}</text></g>; })}<polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /><circle cx={width - margin.right} cy={y(sample.values.at(-1) ?? 0)} r="3.5" fill={color} stroke="var(--viz-surface)" strokeWidth="2" /><text x={margin.left} y={height - 6} className="fill-slate-400 text-[10px] tabular-nums">{sample.firstPeriod}</text><text x={width - margin.right} y={height - 6} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{sample.lastPeriod ?? sample.period}</text></svg><p className="mt-1 text-right text-[11px] text-slate-500">Source: {sample.source}</p></div>;
}

function Composition({ sample }: { sample: DemographicSample }) { return <div><div className="flex items-baseline justify-between gap-4"><p className="text-xs text-slate-500">Race and ethnicity</p><p className="text-xs text-slate-500">{sample.period}</p></div><div className="mt-5 flex h-4 overflow-hidden rounded-full" aria-label="Population share by race and ethnicity">{sample.categories.map((category) => <span key={category.label} style={{ width: `${category.value}%`, backgroundColor: category.color }} title={`${category.label}: ${category.value.toFixed(1)}%`} />)}</div><div className="mt-4 space-y-2">{sample.categories.slice(0, 4).map((category) => <div key={category.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs"><span className="size-2 rounded-sm" style={{ backgroundColor: category.color }} /><span className="truncate text-slate-600 dark:text-slate-300">{category.label}</span><span className="font-medium text-slate-900 dark:text-white">{category.value.toFixed(1)}%</span></div>)}</div><p className="mt-4 text-[11px] text-slate-500">Source: {sample.source}</p></div>; }
function NoPreview() { return <div className="flex h-32 items-center justify-center text-sm text-slate-500">Open the topic to view its data.</div>; }
function linePoints(values: number[], width: number, height: number, margin: { top: number; right: number; bottom: number; left: number }, min: number, max: number) { if (values.length < 2) return ""; const range = max - min || 1; return values.map((value, index) => `${margin.left + index / (values.length - 1) * (width - margin.left - margin.right)},${margin.top + (max - value) / range * (height - margin.top - margin.bottom)}`).join(" "); }
