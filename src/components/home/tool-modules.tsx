import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Database, MapPin, Vote } from "lucide-react";
import { ShowcaseSection } from "@/components/home/showcase/showcase";
import { formatValue } from "@/lib/format";
import { CATALOG } from "@/lib/quiz/catalog";
import type { Showcase } from "@/lib/home/showcase";
import type { MidtermHighlight, MidtermRating, NavPreviews } from "@/lib/nav-previews";
import type { DossierProfile } from "@/lib/db/entities";

export interface PlatformFacts {
  people?: { entities: number; relationships: number; dossiers: DossierProfile[] };
  money?: { contributions: number; usdTotal: number; topRecipients?: { name: string; total: number }[]; coverage?: string };
  elections?: { cycle: number; races: number };
}

export function ToolModules({ facts, previews, showcase, datasetCount, publisherCount }: {
  facts: PlatformFacts; previews: NavPreviews; showcase: Showcase;
  datasetCount: number; publisherCount: number;
}) {
  return (
    <div className="space-y-12 pb-12 pt-4 lg:space-y-14 lg:pb-14">
      <PowerSection facts={facts} />
      <DemocracySection facts={facts} preview={previews.government} />
      <ShowcaseSection showcase={showcase} axisCount={CATALOG.axes} traditionCount={CATALOG.traditions} />
      <TrustSection datasetCount={datasetCount} publisherCount={publisherCount} />
    </div>
  );
}

function SectionHeading({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl dark:text-white">{title}</h2>
      {action && href ? <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{action} <ArrowRight size={14} aria-hidden /></Link> : null}
    </div>
  );
}

function PowerSection({ facts }: { facts: PlatformFacts }) {
  const dossiers = facts.people?.dossiers ?? [];
  return (
    <section id="power" className="scroll-mt-24">
      <SectionHeading title="People and money" action="Browse every profile" href="/people" />
      {dossiers.length ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{dossiers.map((profile) => <DossierCard key={profile.id} profile={profile} />)}</div>
      ) : null}
      <Link href="/money" className="group mt-4 grid gap-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Itemized political money tracked</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue(facts.money?.usdTotal ?? 0, "usd", { compact: true })}</p>
          <p className="mt-1 text-xs text-slate-500">{facts.money?.contributions?.toLocaleString() ?? "—"} FEC records</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 group-hover:underline dark:text-blue-300">Follow the money <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
        </div>
        <div><p className="text-xs font-medium text-slate-600 dark:text-slate-300">Largest recipients</p><RecipientBars recipients={facts.money?.topRecipients ?? []} /></div>
      </Link>
    </section>
  );
}

function DossierCard({ profile }: { profile: DossierProfile }) {
  return (
    <Link href={profile.path} className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors max-sm:[&:nth-child(n+4)]:hidden hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
      <div className="flex items-center gap-3">
        {profile.imageUrl
          ? <Image src={profile.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-full object-cover" />
          : <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{initials(profile.name)}</span>}
        <div className="min-w-0"><h3 className="truncate font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{profile.name}</h3><p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.roles.slice(0, 2).join(" · ")}</p></div>
      </div>
      <div className="mt-4 flex-1"><p className="line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{profile.summary}</p></div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        {profile.given > 0
          ? <div><p className="font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(profile.given, "usd", { compact: true })}</p><p className="text-[11px] text-slate-500">federal political giving</p></div>
          : <p className="text-[11px] text-slate-500">Sourced biography, ties, and statements</p>}
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">Read profile <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

function RecipientBars({ recipients }: { recipients: { name: string; total: number }[] }) {
  const shown = recipients.slice(0, 3); const max = shown[0]?.total || 1;
  return <div className="mt-4 space-y-2.5">{shown.map((recipient) => <div key={recipient.name}><div className="flex justify-between gap-3 text-[11px]"><span className="truncate text-slate-600 dark:text-slate-300">{recipient.name}</span><span className="shrink-0 tabular-nums text-slate-500">{formatValue(recipient.total, "usd", { compact: true })}</span></div><div className="mt-1 h-px bg-slate-200 dark:bg-slate-800"><span className="block h-full bg-slate-900 dark:bg-slate-100" style={{ width: `${Math.max(4, recipient.total / max * 100)}%` }} /></div></div>)}</div>;
}

function DemocracySection({ facts, preview }: { facts: PlatformFacts; preview: NavPreviews["government"] }) {
  return (
    <section id="my-government" className="scroll-mt-24">
      <SectionHeading title="Elections and representation" action="Explore election results" href="/elections" />
      <div className="mt-5 grid gap-4 sm:grid-cols-[1.08fr_.92fr]">
        <Link href="/elections" className="group rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-950 dark:text-white">{preview?.year ?? "Current"} midterm watch</p><p className="mt-1 text-xs text-slate-500">Senate and governor battleground ratings{preview?.asOf ? ` · updated ${formatShortDate(preview.asOf)}` : ""}</p></div><Vote size={20} className="text-slate-400" /></div>
          {preview ? <MidtermHighlights preview={preview} /> : <NoPreview />}
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800"><div><p className="text-2xl font-semibold text-slate-950 dark:text-white">{facts.elections?.races.toLocaleString() ?? "—"}</p><p className="text-xs text-slate-500">races indexed for {facts.elections?.cycle ?? "the latest cycle"}</p></div><span className="text-sm font-semibold text-blue-700 group-hover:underline dark:text-blue-300">Results, ratings, and maps <ArrowRight size={13} className="inline" /></span></div>
        </Link>
        <AddressLookup />
      </div>
    </section>
  );
}

const MIDTERM_RATING_LABEL: Record<MidtermRating, string> = { tossup: "Toss-up", lean_d: "Lean D", lean_r: "Lean R" };
const MIDTERM_RATING_STYLE: Record<MidtermRating, string> = {
  tossup: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  lean_d: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  lean_r: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
};

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function MidtermRace({ race }: { race: MidtermHighlight }) {
  return <li title={race.note} className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 ${MIDTERM_RATING_STYLE[race.rating]}`}><span className="text-xs font-semibold">{race.state}</span><span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{MIDTERM_RATING_LABEL[race.rating]}</span></li>;
}

function MidtermHighlights({ preview }: { preview: NonNullable<NavPreviews["government"]> }) {
  return <div className="mt-5 grid gap-4 sm:grid-cols-2" aria-label={`${preview.year} midterm battlegrounds`}>{(["Senate", "Governor"] as const).map((office) => { const races = preview.highlights.filter((race) => race.office === office); return <div key={office}><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{office}</p><span className="text-[10px] text-slate-400">{races.length} competitive</span></div><ul className="grid grid-cols-2 gap-1.5">{races.map((race) => <MidtermRace key={`${race.office}-${race.state}`} race={race} />)}</ul></div>; })}</div>;
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

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function TrustSection({ datasetCount, publisherCount }: { datasetCount: number; publisherCount: number }) {
  return <section className="grid items-center gap-4 border-t border-slate-300 py-5 sm:grid-cols-[auto_1fr_auto] dark:border-slate-700"><Database size={19} className="text-slate-500" /><div><h2 className="font-semibold text-slate-950 dark:text-white">Every figure stays attached to its source.</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{datasetCount || "Public"} datasets from {publisherCount || "government and research"} publishers, with definitions, coverage, update dates, and original records.</p></div><Link href="/datasets" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Review the dataset catalog <ArrowRight size={14} /></Link></section>;
}

function NoPreview() { return <div className="flex h-32 items-center justify-center text-sm text-slate-500">Open the topic to view its data.</div>; }
