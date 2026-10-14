import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { formatValue } from "@/lib/format";

export interface TrendSample {
  label: string;
  value: number | null;
  unit: string;
  period: string;
  source: string;
  values: number[];
  firstPeriod?: string;
}

export interface DemographicSample {
  period: string;
  source: string;
  categories: { label: string; value: number; color: string }[];
}

export interface PlatformFacts {
  people?: { entities: number; relationships: number; recent: string[] };
  money?: { contributions: number; usdTotal: number };
  legislation?: { bills: number; rollCalls: number };
  elections?: { cycle: number; races: number };
}

export function ToolModules({
  immigration,
  crime,
  demographics,
  facts,
  datasetCount,
  publisherCount,
}: {
  immigration: TrendSample | null;
  crime: TrendSample | null;
  demographics: DemographicSample | null;
  facts: PlatformFacts;
  datasetCount: number;
  publisherCount: number;
}) {
  return (
    <div className="space-y-20 py-16 lg:space-y-24 lg:py-20">
      <IssuesSection immigration={immigration} crime={crime} demographics={demographics} />
      <PowerSection facts={facts} />
      <DemocracySection facts={facts} />
      <ToolsSection />
      <TrustSection datasetCount={datasetCount} publisherCount={publisherCount} />
    </div>
  );
}

function SectionHeading({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="grid gap-3 border-t border-slate-300 pt-5 md:grid-cols-[12rem_1fr] dark:border-slate-700">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}

function AddressLookup() {
  return (
    <div className="border-t-2 border-slate-950 pt-4 dark:border-white">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Who represents your address?</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
        Federal, state, county, city, school board, and judicial offices in one place.
      </p>
      <form action="/my-government" className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
          <MapPin size={17} className="shrink-0 text-slate-400" aria-hidden />
          <span className="sr-only">Your address</span>
          <input name="address" type="text" autoComplete="street-address" placeholder="Street address, city, state, ZIP" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white" />
        </label>
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500">
          Find
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Worldview does not save your address. <Link href="/privacy#address-lookups" className="underline underline-offset-2">Learn more</Link>.
      </p>
    </div>
  );
}

function IssuesSection({ immigration, crime, demographics }: { immigration: TrendSample | null; crime: TrendSample | null; demographics: DemographicSample | null }) {
  return (
    <section id="issues" className="scroll-mt-24">
      <SectionHeading label="Issues" title="Start with the numbers." body="Each preview below uses the same public data shown on its topic page. Open a topic for definitions, comparisons, and original sources." />
      <div className="mt-9 grid gap-x-8 gap-y-10 lg:grid-cols-3">
        <IssueCard href="/immigration" title="Immigration" description="Border encounters, legal immigration, asylum, migration, and enforcement.">
          {immigration ? <TrendChart sample={immigration} color="#2563eb" /> : <NoPreview />}
        </IssueCard>
        <IssueCard href="/crime" title="Crime" description="National trends, state comparisons, cities, and reported offenses.">
          {crime ? <TrendChart sample={crime} color="#c2410c" /> : <NoPreview />}
        </IssueCard>
        <IssueCard href="/demographics" title="Demographics" description="Population estimates, age, race and ethnicity, religion, and education.">
          {demographics ? <Composition sample={demographics} /> : <NoPreview />}
        </IssueCard>
      </div>
    </section>
  );
}

function IssueCard({ href, title, description, children }: { href: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group border-t-2 border-slate-950 pt-4 dark:border-white">
      {children}
      <h3 className="mt-5 text-xl font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 group-hover:underline dark:text-blue-300">
        Explore {title.toLowerCase()} <ArrowRight size={14} aria-hidden />
      </span>
    </Link>
  );
}

function TrendChart({ sample, color }: { sample: TrendSample; color: string }) {
  const points = linePoints(sample.values, 340, 96);
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{sample.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{formatValue(sample.value, sample.unit, { compact: true })}</p>
        </div>
        <p className="text-right text-sm text-slate-500 dark:text-slate-400">{sample.period}</p>
      </div>
      <svg viewBox="0 0 340 100" role="img" aria-label={`${sample.label} trend`} className="mt-5 h-28 w-full overflow-visible">
        <line x1="0" y1="98" x2="340" y2="98" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{sample.firstPeriod}</span><span>{sample.source}</span>
      </div>
    </div>
  );
}

function Composition({ sample }: { sample: DemographicSample }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Race and ethnicity</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{sample.period}</p>
      </div>
      <div className="mt-6 flex h-4 overflow-hidden" aria-label="Population share by race and ethnicity">
        {sample.categories.map((category) => <span key={category.label} style={{ width: `${category.value}%`, backgroundColor: category.color }} title={`${category.label}: ${category.value.toFixed(1)}%`} />)}
      </div>
      <div className="mt-5 space-y-2">
        {sample.categories.slice(0, 4).map((category) => (
          <div key={category.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
            <span className="size-2 rounded-sm" style={{ backgroundColor: category.color }} />
            <span className="truncate text-slate-600 dark:text-slate-300">{category.label}</span>
            <span className="font-medium text-slate-900 dark:text-white">{category.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{sample.source}</p>
    </div>
  );
}

function PowerSection({ facts }: { facts: PlatformFacts }) {
  const items = [
    {
      href: "/people", title: "People and organizations", body: "Public officials, candidates, institutions, and the relationships between them.",
      facts: facts.people ? [
        `${facts.people.entities.toLocaleString()} profiles`,
        `${facts.people.relationships.toLocaleString()} relationships`,
        ...(facts.people.recent.length ? [`Recently added: ${facts.people.recent.slice(0, 2).join(", ")}`] : []),
      ] : [],
    },
    {
      href: "/money", title: "Political money", body: "Contributions, donors, recipients, industries, and geographic patterns.",
      facts: facts.money ? [`${facts.money.contributions.toLocaleString()} contribution records`, `${formatValue(facts.money.usdTotal, "usd", { compact: true })} tracked in USD`] : [],
    },
    {
      href: "/legislation", title: "Congress", body: "Bills, sponsors, legislative status, roll calls, and member votes.",
      facts: facts.legislation ? [`${facts.legislation.bills.toLocaleString()} bills`, `${facts.legislation.rollCalls.toLocaleString()} roll-call votes`] : [],
    },
  ];
  return (
    <section id="power" className="scroll-mt-24">
      <SectionHeading label="Power" title="Follow people, money, and decisions." body="The records are connected so you can move from a public official to donors, legislation, votes, and source documents." />
      <div className="mt-9 grid border-y border-slate-300 md:grid-cols-3 md:divide-x dark:border-slate-700 dark:divide-slate-700">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="group border-b border-slate-300 py-6 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.body}</p>
            {item.facts.length ? <ul className="mt-5 space-y-1.5 text-sm text-slate-800 dark:text-slate-200">{item.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">Open section <ArrowRight size={14} aria-hidden /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DemocracySection({ facts }: { facts: PlatformFacts }) {
  return (
    <section id="my-government" className="scroll-mt-24">
      <SectionHeading label="Democracy" title="Elections and representation." body="Browse races and results nationwide, or use an address to identify the districts and offices that represent you." />
      <div className="mt-9 grid gap-8 md:grid-cols-2">
        <TextLink href="/elections" title="Elections">
          {facts.elections ? `${facts.elections.races.toLocaleString()} races are available for the ${facts.elections.cycle} cycle, including federal, state, and local offices.` : "Browse races, results, district maps, candidates, and nonpartisan race ratings."}
        </TextLink>
        <AddressLookup />
      </div>
    </section>
  );
}

function ToolsSection() {
  return (
    <section>
      <SectionHeading label="Tools" title="Work with the information." body="Answer questions about your political views, build geographic stories, or inspect the datasets behind the site." />
      <div className="mt-9 grid gap-8 md:grid-cols-3">
        <TextLink href="/quiz" title="Political Quiz">Compare your views across 17 political axes and 25 policy issues.</TextLink>
        <TextLink href="/geography" title="Geography Studio">Build and save maps about alliances, conflict, resources, trade, and other geographic subjects.</TextLink>
        <TextLink href="/datasets" title="Dataset catalog">Review publishers, coverage, update dates, methodology, and original sources.</TextLink>
      </div>
    </section>
  );
}

function TextLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group border-t-2 border-slate-950 pt-4 dark:border-white">
      <h3 className="text-lg font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{children}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">Open <ArrowRight size={14} aria-hidden /></span>
    </Link>
  );
}

function TrustSection({ datasetCount, publisherCount }: { datasetCount: number; publisherCount: number }) {
  return (
    <section className="grid gap-4 border-t border-slate-300 pt-6 md:grid-cols-[12rem_1fr] dark:border-slate-700">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">How Worldview works</p>
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Source records stay attached.</h2>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">
          Worldview organizes data from {publisherCount || "public"} publishers into consistent views without hiding where it came from. Definitions, coverage dates, and links to original sources are included throughout the site.
        </p>
        <Link href="/datasets" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Review {datasetCount || "all"} datasets <ArrowRight size={14} aria-hidden /></Link>
      </div>
    </section>
  );
}

function NoPreview() {
  return <div className="flex h-48 items-center justify-center border-y border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Open the topic to view its data.</div>;
}

function linePoints(values: number[], width: number, height: number) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / range) * (height - 8)}`).join(" ");
}
