import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { PeriodTag, periodTags } from "@/components/charts/period-tag";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { EncounterExplorer } from "@/components/immigration/encounter-explorer";
import { ImmigrationChapterDeck, type ImmigrationChapter } from "@/components/immigration/chapter-deck";
import { ChapterExplorer, EnforcementExplorer } from "@/components/immigration/chapter-explorer";
import {
  GreenCardChapter,
  ImmigrationExplorerProvider,
  ImmigrationOverviewExplorer,
} from "@/components/immigration/green-card-explorer";
import { StateFlows } from "@/components/immigration/state-flows";
import { Disclosure } from "@/components/ui/disclosure";
import { Term } from "@/components/ui/term";
import { formatPeriod, formatValue } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { loadImmigration } from "@/lib/immigration/data";
import { IssueHeader } from "@/components/data/issue-layout";

export const revalidate = 86400;

// The previous chapter-based page, kept while the flowchart at /immigration
// is evaluated. Not indexed; delete once the new page reaches parity.
export const metadata: Metadata = {
  robots: { index: false },
  title: "Immigration (previous version) | Worldview",
  description:
    "U.S. immigration explained with data: how the system works, border encounters, green cards, refugees and asylum, the unauthorized population, temporary visas, the foreign-born population, removals and detention — nationally and by state.",
};

const CHAPTERS: ImmigrationChapter[] = [
  { id: "snapshot", label: "Foreign-born share", group: "Start" },
  { id: "overview", label: "How it works", group: "Start" },
  { id: "border", label: "Border", group: "Core system" },
  { id: "legal", label: "Green cards", group: "Core system" },
  { id: "humanitarian", label: "Humanitarian", group: "Core system" },
  { id: "unauthorized", label: "Unauthorized", group: "Population & places" },
  { id: "temporary", label: "Temporary", group: "Core system" },
  { id: "population", label: "Population", group: "Population & places" },
  { id: "enforcement", label: "Enforcement", group: "Core system" },
  { id: "states", label: "States", group: "Population & places" },
  { id: "related", label: "Related migration", group: "Population & places" },
  { id: "questions", label: "Questions", group: "Reference" },
  { id: "glossary", label: "Glossary", group: "Reference" },
];

const SOURCE_SPECS = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  unauthorized: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/dhs-unauthorized" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
  historical: { label: "Census Bureau decennial census and American Community Survey", href: "/datasets/census-historical-nativity" },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  ice: { label: "ICE Detention Statistics", href: "/datasets/ice-detention" },
  flows: { label: "Census Bureau State-to-State Migration Flows", href: "/datasets/census-state-migration" },
  un: { label: "UN DESA International Migrant Stock", href: "/datasets/un-migrant-stock" },
} satisfies Record<string, SourceSpec>;

const NUMBER_WORDS: Record<number, string> = { 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve" };
const compact = (v: number | null | undefined, unit = "people") => formatValue(v, unit, { compact: true });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const year = (period: string) => period.replace(/\D/g, "");

function Section({ id, title, question, children }: { id: string; title: string; question: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">{question}</p>
      </div>
      {children}
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-3 text-base leading-7 text-slate-600 dark:text-slate-300">{children}</div>;
}

// The one thing a reader must not miss in a section.
function KeyPoint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl rounded-r-xl border-l-4 border-slate-900 bg-slate-50 px-4 py-3 dark:border-white dark:bg-slate-900/60">
      <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

function Explainers({ items, cols = 2 }: { items: { title: ReactNode; body: ReactNode }[]; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-3 ${cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-950 dark:text-white">{it.title}</h3>
          <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{it.body}</div>
        </div>
      ))}
    </div>
  );
}

function Steps({ title, steps, counted }: { title: ReactNode; steps: ReactNode[]; counted: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
      <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
        <span className="font-medium">Counted here:</span> {counted}
      </p>
    </div>
  );
}

function SubHeading({ id, title, question }: { id?: string; title: string; question: string }) {
  return (
    <div id={id} className="max-w-3xl scroll-mt-28 pt-4">
      <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{question}</p>
    </div>
  );
}

export default async function ImmigrationPage() {
  const d = await loadImmigration();
  const { stats: s } = d;
  const lastMonth = d.border.lastMonth;
  const yearbookYear = s.lpr ? year(s.lpr.period) : "";
  const removalsYear = s.removals ? year(s.removals.period) : "";

  const faq: { q: string; a: ReactNode }[] = [
    {
      q: "What are Title 8 and Title 42?",
      a: (
        <>
          Title 8 is ordinary federal immigration law; almost every encounter is processed under it. Title 42 was a public-health authority used
          from March 2020 to May 2023 to expel people quickly without immigration processing. See{" "}
          <a href="#title-8-42" className="underline">Title 8 vs. Title 42</a>.
        </>
      ),
    },
    {
      q: "Is a border encounter the same as an illegal immigrant? Is each encounter a different person?",
      a: (
        <>
          No to both. An encounter is an event: someone stopped twice counts twice, and people who arrive at an airport without valid papers are
          encounters too. Encounters also don&apos;t count people who crossed without being stopped.
        </>
      ),
    },
    {
      q: "What's the difference between an encounter and an apprehension?",
      a: (
        <>
          An apprehension is one kind of encounter: Border Patrol taking someone into custody between ports of entry. The other kind is a person
          found inadmissible at a port of entry.
          {s.encounters12?.usbpShare != null && (
            <> In the last 12 months, {pct(s.encounters12.usbpShare)} of encounters were Border Patrol apprehensions or expulsions.</>
          )}
        </>
      ),
    },
    {
      q: "Why do Florida and New York have border encounters? Does “Texas encounters” mean people settled in Texas?",
      a: (
        <>
          Encounters are filed under the state of the CBP office that recorded them. Florida and New York have large international airports and
          seaports, where people found inadmissible are counted. Where someone was encountered says nothing about where they live or go.
        </>
      ),
    },
    {
      q: "How many people were deported?",
      a: s.removals ? (
        <>
          DHS carried out {compact(s.removals.value)} removals in {formatPeriod(s.removals.period)}, the latest year published, plus returns
          and Title 42 expulsions. See <a href="#enforcement" className="underline">Enforcement</a>.
        </>
      ) : (
        "See Enforcement."
      ),
    },
    {
      q: "How many asylum claims were granted?",
      a: s.asylum ? (
        <>
          {compact(s.asylum.value)} people were granted asylum in {formatPeriod(s.asylum.period)}, by USCIS asylum officers or immigration
          judges. See <a href="#humanitarian" className="underline">Humanitarian</a>.
        </>
      ) : (
        "See Humanitarian."
      ),
    },
    {
      q: "How many unauthorized immigrants live in the U.S.?",
      a: s.unauthorized ? (
        <>
          DHS estimates {compact(s.unauthorized.value)} as of January 1, {s.unauthorized.period}, its latest estimate. Pew Research Center
          estimates 14 million as of July 2023. See <a href="#unauthorized" className="underline">Unauthorized population</a>.
        </>
      ) : (
        "See Unauthorized population."
      ),
    },
    {
      q: "Do green cards mean that many people entered the country that year?",
      a: s.lpr ? (
        <>
          No. In {formatPeriod(s.lpr.period)}, {pct(s.lpr.adjustmentShare)} of the {compact(s.lpr.value)} new green cards went to people who
          were already living in the U.S. and adjusted their status.
        </>
      ) : (
        "No — many go to people already living here."
      ),
    },
    {
      q: "Is net international migration just immigration minus deportations? Why doesn't it match green cards?",
      a: (
        <>
          Neither. Net international migration counts everyone who moved here for a year or more — any status, including returning U.S.
          citizens — minus everyone who moved abroad. Green cards count status grants, mostly to people who were already here, so the two
          measure different things.
        </>
      ),
    },
    {
      q: "What's the difference between a refugee and an asylum seeker?",
      a: (
        <>
          Both must show the same fear of persecution. Refugees are approved while outside the U.S. and then resettled here; asylum is requested
          after reaching the U.S. or its border. See <a href="#humanitarian" className="underline">Humanitarian</a>.
        </>
      ),
    },
    {
      q: "Why are people without criminal convictions in ICE detention?",
      a: (
        <>
          Immigration detention is civil custody while a removal case is decided or a removal is arranged, not punishment for a crime. Being in
          the U.S. without status is a civil violation. Some people are held under mandatory-detention laws; “no criminal conviction” can
          include people with pending charges.
          {s.detention?.noConvictionShare != null && (
            <> In {formatPeriod(s.detention.period)} so far, {pct(s.detention.noConvictionShare)} of the average daily population had no criminal conviction.</>
          )}
        </>
      ),
    },
    {
      q: "Does “foreign-born” include naturalized citizens and unauthorized immigrants?",
      a: <>Yes. It counts everyone living here who wasn&apos;t a U.S. citizen at birth, whatever their status today.</>,
    },
    {
      q: "Why are some figures from 2024 or earlier?",
      a: (
        <>
          Each agency publishes on its own schedule. DHS releases each Yearbook of Immigration Statistics about a year and a half after the
          fiscal year ends — FY {yearbookYear} is the newest — and its enforcement chapter{removalsYear && ` (FY ${removalsYear})`} trails
          by another year. DHS&apos;s unauthorized-population estimate is published irregularly. CBP publishes monthly.
        </>
      ),
    },
    {
      q: "Why are moves between states on this page?",
      a: (
        <>
          They aren&apos;t immigration, but they&apos;re often confused with it, so they sit under{" "}
          <a href="#related" className="underline">Related migration</a> at the end, with Americans living abroad.
        </>
      ),
    },
  ];

  // Hero: the foreign-born share since 1850, and the last time it was this high.
  const longRun = d.population.longRun[0].points;
  const nowShare = longRun.at(-1);
  const since = nowShare ? longRun.findLast((p) => p.x < nowShare.x && p.value >= nowShare.value) : undefined;

  const glossary = Object.entries(GLOSSARY).sort((a, b) => a[1].term.localeCompare(b[1].term));
  const flowData = {
    encounters: {
      value: s.encounters12?.value,
      period: lastMonth ? periodTags.trailing12(lastMonth).label : "",
      change: s.encounters12?.change,
      compare: "vs prior 12 months",
      spark: s.encounters?.spark,
    },
    temporary: {
      value: s.temporary?.value,
      period: s.temporary ? formatPeriod(s.temporary.period) : "",
      change: s.temporary?.change,
      compare: s.temporary?.compare,
      spark: s.temporary?.spark,
    },
    humanitarian: {
      value: s.refugees && s.asylum && s.refugees.period === s.asylum.period ? s.refugees.value + s.asylum.value : null,
      period: s.refugees ? formatPeriod(s.refugees.period) : "",
    },
    greenCards: {
      value: s.lpr?.value,
      period: s.lpr ? formatPeriod(s.lpr.period) : "",
      change: s.lpr?.change,
      compare: s.lpr?.compare,
      spark: s.lpr?.spark,
    },
    adjustmentShare: s.lpr?.adjustmentShare,
    naturalizations: {
      value: s.naturalizations?.value,
      period: s.naturalizations ? formatPeriod(s.naturalizations.period) : "",
      change: s.naturalizations?.change,
      compare: s.naturalizations?.compare,
      spark: s.naturalizations?.spark,
    },
    netMigration: {
      value: s.netMigration?.value,
      period: s.netMigration ? periodTags.july(s.netMigration.period).label : "",
      change: s.netMigration?.change,
      compare: s.netMigration?.compare,
      spark: s.netMigration?.spark,
    },
    naturalized: d.population.foreignBorn[0].points.at(-1)?.value,
    noncitizen: d.population.foreignBorn[1].points.at(-1)?.value,
    foreignBorn: {
      value: s.foreignBorn?.value,
      period: s.foreignBorn?.period ?? "",
      change: s.foreignBorn?.change,
      compare: s.foreignBorn?.compare,
      spark: s.foreignBorn?.spark,
    },
    unauthorized: { value: s.unauthorized?.value, period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "" },
  };
  const greenCardData = {
    total: s.lpr?.value ?? null,
    period: s.lpr ? formatPeriod(s.lpr.period) : "",
    change: s.lpr?.change,
    compare: s.lpr?.compare,
    adjustmentShare: s.lpr?.adjustmentShare ?? null,
    history: d.legal.lprHistory,
    split: d.legal.lprSplit,
    pathways: d.legal.pathways,
    countries: d.legal.byCountry,
    naturalizations: d.legal.naturalizations,
    naturalizedShare: d.legal.naturalizedShare,
    naturalizationCountries: d.legal.natzByCountry,
  };
  const explorerData = {
    border: {
      latest: {
        value: s.encounters?.value,
        period: s.encounters ? formatPeriod(s.encounters.period) : "",
        change: s.encounters?.change,
        compare: s.encounters?.compare,
        spark: s.encounters?.spark,
      },
      trailing: {
        value: s.encounters12?.value,
        period: lastMonth ? periodTags.trailing12(lastMonth).label : "",
        change: s.encounters12?.change,
        compare: "vs prior 12 months",
        note: s.encounters12 ? `${pct(s.encounters12.usbpShare)} Border Patrol · ${pct(s.encounters12.ofoShare)} at ports` : undefined,
      },
      peak: {
        value: s.peakMonth?.value,
        period: s.peakMonth ? formatPeriod(s.peakMonth.period) : "",
      },
      trend: d.border.series.nation?.authority ?? [],
      states: d.border.byState,
      citizenship: d.border.byCitizenship,
      offices: d.border.byOffice,
      period: lastMonth ? periodTags.trailing12(lastMonth).label : "",
    },
    temporary: {
      recorded: flowData.temporary,
      all: {
        value: s.temporary?.all,
        period: s.temporary ? formatPeriod(s.temporary.period) : "",
        note: "Includes estimated short land-border visits not recorded on Form I-94",
      },
      purpose: d.temporary.groups,
      trend: d.temporary.purpose,
      work: d.temporary.workVisas,
      period: d.temporary.period,
    },
    humanitarian: {
      total: flowData.humanitarian,
      refugees: {
        value: s.refugees?.value,
        period: s.refugees ? formatPeriod(s.refugees.period) : "",
        change: s.refugees?.change,
        compare: s.refugees?.compare,
        spark: s.refugees?.spark,
      },
      asylum: {
        value: s.asylum?.value,
        period: s.asylum ? formatPeriod(s.asylum.period) : "",
        change: s.asylum?.change,
        compare: s.asylum?.compare,
        spark: s.asylum?.spark,
      },
      refugeeTrend: d.humanitarian.refugees,
      asylumTrend: d.humanitarian.asylum,
      refugeeCountries: d.humanitarian.refugeesByCountry,
      asylumCountries: d.humanitarian.asylumByCountry,
    },
    greenCards: greenCardData,
    naturalizations: {
      total: flowData.naturalizations,
      history: d.legal.naturalizations,
      countries: d.legal.natzByCountry,
      share: d.legal.naturalizedShare,
    },
    population: {
      total: flowData.foreignBorn,
      share: {
        value: s.foreignBorn?.share,
        period: s.foreignBorn?.period ?? "",
        note: s.foreignBorn?.naturalizedShare != null ? `${pct(s.foreignBorn.naturalizedShare)} are naturalized citizens` : undefined,
      },
      unauthorized: {
        value: s.unauthorized?.value,
        period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "",
        note: "Latest DHS estimate",
      },
      citizenship: d.population.foreignBorn,
      shareHistory: d.population.foreignBornShare,
      countries: d.population.byCountry,
      regions: d.population.byRegion,
    },
    netMigration: {
      total: flowData.netMigration,
      trend: d.population.netMigration,
      growth: d.population.growth,
    },
  };

  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  return (
    <ImmigrationExplorerProvider>
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Immigration" />
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Previous version of this page. <a href="/immigration" className="font-semibold underline">Open the interactive system map →</a>
      </p>

      <ImmigrationChapterDeck chapters={CHAPTERS}>

      {/* ---------------------------------------------------------------- Hero */}
      <section id="snapshot" className="scroll-mt-28">
      {nowShare ? (
        <figure className="space-y-5">
          <figcaption className="max-w-3xl">
            <p className="text-5xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-6xl dark:text-white">
              {nowShare.value.toFixed(1)}%
            </p>
            <p className="mt-3 text-xl leading-8 text-slate-700 dark:text-slate-200">
              About one in {NUMBER_WORDS[Math.round(100 / nowShare.value)] ?? Math.round(100 / nowShare.value)} people living in the U.S. is <Term id="foreign-born">foreign-born</Term>
              {since ? <> — the highest share since {since.x}.</> : <> — the highest share on record.</>}
            </p>
          </figcaption>
          <ChartCard
            title="Foreign-born share of the U.S. population"
            subtitle={`Every census 1850–2000, then the yearly American Community Survey through ${nowShare.x}`}
            source={SOURCES.historical}
            table={seriesTable(d.population.longRun, "percent")}
          >
            <TimeSeriesChart
              series={d.population.longRun}
              unit="percent"
              height={320}
              xTickValues={[1850, 1875, 1900, 1925, 1950, 1975, 2000, 2025]}
              markers={[
                { x: 1924, label: "1924 quotas" },
                { x: 1965, label: "1965 quotas end" },
              ]}
            />
          </ChartCard>
        </figure>
      ) : (
        <p className="rounded-2xl border border-slate-200 p-8 text-slate-500 dark:border-slate-800 dark:text-slate-400">The latest population snapshot is not available.</p>
      )}
      </section>

      {/* ------------------------------------------------------------ Overview */}
      <Section
        id="overview"
        title="How immigration works"
        question="Yearly flows on the left, the population they add up to on the right."
      >
        <Prose>
          <p>
            Each yearly flow and the <Term id="stock">population</Term> is counted by a different agency, in its own unit and on its own{" "}
            <Term id="fiscal-year">calendar</Term>.
          </p>
        </Prose>
        <ImmigrationOverviewExplorer flow={flowData} data={explorerData} />
      </Section>

      {/* -------------------------------------------------------------- Border */}
      <Section id="border" title="The border" question="How often CBP stops people at the border, and what happens next.">
        <EncounterExplorer
          regions={d.border.regions}
          breakdowns={[
            { key: "authority", label: "Legal authority", note: "Title 42 expulsions ran March 2020 – May 2023 (shaded). Everything else is processed under Title 8." },
            { key: "agency", label: "Agency", note: "Border Patrol apprehends people between ports of entry; the Office of Field Operations records people found inadmissible at ports, including airports." },
            {
              key: "group",
              label: "Who",
              note: "Single adults; members of family units (a child with a parent or guardian) and other accompanied children; and unaccompanied children, who are transferred to HHS custody.",
            },
          ]}
          series={d.border.series}
          markers={[
            { x: 2020 + 2 / 12, to: 2023 + 5 / 12, label: "Title 42 in effect" },
            { x: 2021, label: "Biden term" },
            { x: 2024 + 5 / 12, label: "Jun 2024 asylum limits" },
            { x: 2025, label: "Trump term" },
          ]}
          source={SOURCES.cbp}
        />

        <KeyPoint title="An encounter is an event, not a person.">
          Someone stopped three times is three encounters. Encounters don&apos;t measure who got in or who lives here without status — that&apos;s
          the <a href="#unauthorized" className="underline">unauthorized population</a>.
        </KeyPoint>

        <ChapterExplorer
          primaryLabel="Where and who"
          metrics={[
            { label: "Latest month", value: s.encounters?.value, unit: "encounters", period: s.encounters ? formatPeriod(s.encounters.period) : "", change: s.encounters?.change, compare: s.encounters?.compare },
            { label: "Last 12 months", value: s.encounters12?.value, unit: "encounters", period: lastMonth ? periodTags.trailing12(lastMonth).label : "", note: s.encounters12 ? `${pct(s.encounters12.usbpShare)} Border Patrol · ${pct(s.encounters12.ofoShare)} at ports` : undefined },
            { label: "Peak month since FY 2020", value: s.peakMonth?.value, unit: "encounters", period: s.peakMonth ? formatPeriod(s.peakMonth.period) : "" },
          ]}
          primary={[
            { key: "states", label: "States", title: "Where CBP encounters were recorded", subtitle: `${lastMonth ? periodTags.trailing12(lastMonth).label : ""} · office location, not where the person settled`, kind: "ranked", items: d.border.byState, itemLabel: "State", unit: "encounters", source: SOURCES.cbp },
            { key: "offices", label: "Offices", title: "Border sectors and port field offices", subtitle: lastMonth ? periodTags.trailing12(lastMonth).label : "", kind: "ranked", items: d.border.byOffice, itemLabel: "Sector or field office", unit: "encounters", slot: 3, source: SOURCES.cbp },
            { key: "citizenship", label: "Citizenship", title: "Encounters by citizenship", subtitle: lastMonth ? periodTags.trailing12(lastMonth).label : "", kind: "ranked", items: d.border.byCitizenship, itemLabel: "Citizenship", unit: "encounters", source: SOURCES.cbp },
          ]}
        />

        <Disclosure id="title-8-42" summary="How the border process works: Title 8 vs. Title 42, Border Patrol vs. ports, and what happens next">
          <Explainers
            items={[
              {
                title: <Term id="title-8">Title 8 — immigration law</Term>,
                body: (
                  <>
                    The normal body of federal immigration law. A person encountered under Title 8 may be put in expedited removal, given a notice to
                    appear before an immigration judge (and detained or released while the case proceeds), allowed to return voluntarily, paroled, or
                    prosecuted for illegal entry or re-entry. People who fear persecution can seek asylum. A removal bars re-entry for years.
                  </>
                ),
              },
              {
                title: <Term id="title-42">Title 42 — public-health expulsions, 2020–2023</Term>,
                body: (
                  <>
                    A public-health law invoked from March 2020 to May 11, 2023, during COVID-19. Many people encountered at the border were expelled
                    to Mexico or their home country within hours, without immigration processing or an asylum screening. Expulsion carried no penalty
                    for trying again, so repeat encounters of the same people rose while it was in effect.
                  </>
                ),
              },
            ]}
          />
          <Explainers
            items={[
              {
                title: <Term id="usbp">Border Patrol — between ports of entry</Term>,
                body: (
                  <>
                    Encounters here are <Term id="apprehension">apprehensions</Term>: people taken into custody after crossing somewhere other than
                    an official crossing, almost all on the southwest border.
                  </>
                ),
              },
              {
                title: <Term id="ofo">Office of Field Operations — at ports of entry</Term>,
                body: (
                  <>
                    Encounters here are people found <Term id="inadmissible">inadmissible</Term> at land crossings, airports, and seaports.
                  </>
                ),
              },
            ]}
          />
          <Steps
            title="What can happen after an encounter"
            steps={[
              <>Title 42 (2020–2023 only): expelled, usually within hours.</>,
              <>Under Title 8, CBP decides how to process the person: expedited removal, a notice to appear in immigration court, voluntary return, parole, or referral for prosecution.</>,
              <>Someone who says they fear return gets a screening interview; if they pass, they can pursue asylum before an immigration judge.</>,
              <>While a case is pending, the person may be held in ICE detention or released with a court date — cases can take years.</>,
              <>The case ends in permission to stay (asylum or another status) or an order of removal.</>,
            ]}
            counted={
              <>
                encounters (above), and later <a href="#enforcement" className="underline">removals, returns, and detention</a> and{" "}
                <a href="#humanitarian" className="underline">asylum grants</a>. Individual encounters can&apos;t be followed through to their outcomes
                in published data.
              </>
            }
          />
        </Disclosure>
      </Section>

      {/* -------------------------------------------------------- Legal / LPR */}
      <Section id="legal" title="Green cards" question="How many become permanent residents each year, and how?">
        <GreenCardChapter data={greenCardData} />
      </Section>

      {/* -------------------------------------------------------- Humanitarian */}
      <Section id="humanitarian" title="Refugees and asylum" question="How many people receive humanitarian protection, and through which route?">
        <div className="grid gap-4 md:grid-cols-2">
          <Steps
            title={<Term id="refugee">Refugees — approved abroad</Term>}
            steps={[
              "Outside the U.S., often in a third country, and referred to the U.S. Refugee Admissions Program.",
              "Interviewed abroad by USCIS and security-vetted.",
              "Approved, then resettled in the U.S. — within a yearly ceiling the president sets.",
              "Must apply for a green card after one year.",
            ]}
            counted="refugee arrivals, in the fiscal year they arrive."
          />
          <Steps
            title={<Term id="asylum">Asylum — requested from inside the U.S.</Term>}
            steps={[
              "Already in the U.S., or arriving at the border or a port of entry.",
              <>
                Applies <Term id="affirmative-asylum">affirmatively</Term> with USCIS, or <Term id="defensive-asylum">defensively</Term> in
                immigration court to stop a removal.
              </>,
              "The case is decided — often years later, after a backlog.",
              "Granted or denied. Asylees can apply for a green card after one year.",
            ]}
            counted="asylum grants, in the fiscal year of the decision — not applications."
          />
        </div>
        <KeyPoint title="These are two separate processes, counted at different points.">
          Refugees are counted when they arrive; asylees when their case is granted, often years after they arrived. The charts below are not two
          shares of one total.
        </KeyPoint>
        <ChapterExplorer
          primaryLabel="Route"
          secondaryLabel="Nationality"
          metrics={[
            { label: "Refugee arrivals", value: s.refugees?.value, unit: "people", period: s.refugees ? formatPeriod(s.refugees.period) : "", change: s.refugees?.change, compare: s.refugees?.compare },
            { label: "People granted asylum", value: s.asylum?.value, unit: "people", period: s.asylum ? formatPeriod(s.asylum.period) : "", change: s.asylum?.change, compare: s.asylum?.compare },
          ]}
          primary={[
            { key: "refugees", label: "Refugees", title: "Refugee arrivals", subtitle: "Approved abroad and counted when they arrive", kind: "time", series: d.humanitarian.refugees, unit: "people", markers: [{ x: 2002, label: "Post-9/11 changes" }, { x: 2020, label: "COVID-19" }], source: SOURCES.yearbook },
            { key: "asylum", label: "Asylum", title: "Asylum grants by route", subtitle: "Counted when protection is granted, often years after arrival", kind: "time", type: "column", series: d.humanitarian.asylum, unit: "people", source: SOURCES.yearbook },
          ]}
          secondary={[
            { key: "refugee-origin", label: "Refugees", title: "Refugee arrivals by nationality", subtitle: `${formatPeriod(d.humanitarian.refugeesByCountry.period)} · top 10`, kind: "ranked", items: d.humanitarian.refugeesByCountry.items, itemLabel: "Nationality", unit: "people", source: SOURCES.yearbook },
            { key: "asylum-origin", label: "Asylum", title: "Affirmative asylum grants by nationality", subtitle: `${formatPeriod(d.humanitarian.asylumByCountry.period)} · top 10`, kind: "ranked", items: d.humanitarian.asylumByCountry.items, itemLabel: "Nationality", unit: "people", slot: 2, source: SOURCES.yearbook },
          ]}
        />
      </Section>

      {/* -------------------------------------------------------- Unauthorized */}
      <Section id="unauthorized" title="The unauthorized population" question="How many live here without legal status, and from where?">
        <KeyPoint title="Border encounters are not a measure of this population.">
          It includes people who entered legally and overstayed, and people who arrived decades ago.
        </KeyPoint>
        <ChapterExplorer
          metrics={[
            { label: "DHS estimate", value: s.unauthorized?.value, unit: "people", period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "" },
            { label: "Share of all residents", value: s.unauthorized?.shareOfPopulation, unit: "percent", period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "", note: s.unauthorized?.shareOfForeignBorn != null ? `${pct(s.unauthorized.shareOfForeignBorn)} of foreign-born residents` : undefined },
            { label: "Pew estimate", value: 14_000_000, unit: "people", period: "Jul 2023", note: "Independent estimate; methodology and vintage differ from DHS" },
          ]}
          primary={[{ key: "estimate", label: "Estimate", title: "Estimated unauthorized population", subtitle: "January 1 · gaps in 2001–2004 and 2021", kind: "time", series: d.unauthorized.series, unit: "people", markers: [{ x: 2010, label: "2010 Census base" }, { x: 2022, label: "2020 Census base" }], source: SOURCES.unauthorized }]}
          secondaryLabel="Composition"
          secondary={[
            { key: "country", label: "Country", title: "By country of birth", subtitle: `January 1, ${d.unauthorized.byCountry.period}`, kind: "ranked", items: d.unauthorized.byCountry.items, itemLabel: "Country", unit: "people", limit: 11, source: SOURCES.unauthorized },
            { key: "state", label: "State", title: "By state of residence", subtitle: `January 1, ${d.unauthorized.byState.period}`, kind: "ranked", items: [...d.unauthorized.byState.items, ...(d.unauthorized.byState.other ? [{ label: "All other states", value: d.unauthorized.byState.other }] : [])], itemLabel: "State", unit: "people", limit: 11, slot: 3, source: SOURCES.unauthorized },
            { key: "arrival", label: "Arrival era", title: "When they arrived", subtitle: `January 1, ${d.unauthorized.byEntry.period}`, kind: "ranked", items: d.unauthorized.byEntry.items, itemLabel: "Period", unit: "people", slot: 2, source: SOURCES.unauthorized },
          ]}
        />

        <Disclosure summary="How DHS estimates a population no one counts directly">
          <Prose>
            <p>
              No agency counts <Term id="unauthorized">unauthorized immigrants</Term> directly. DHS estimates them by subtraction: the foreign-born
              population measured by the Census Bureau&apos;s survey, adjusted for people the survey misses, minus everyone known to be here legally
              (green-card holders, refugees, asylees, and temporary residents). DHS&apos;s most recent estimate is for January 2022; independent
              researchers use similar methods with newer survey data.
            </p>
          </Prose>
        </Disclosure>
      </Section>

      {/* ----------------------------------------------------------- Temporary */}
      <Section id="temporary" title="Temporary visas" question="How many people come temporarily — to visit, study, or work?">
        <Prose>
          <p>
            Most people who enter legally never immigrate: they&apos;re admitted for a set purpose and time on a{" "}
            <Term id="nonimmigrant">nonimmigrant</Term> class. A <Term id="visa">visa is not an admission</Term> — one visa can be used for many
            trips — and admissions count entries, not people: a consultant who flies in ten times is ten admissions.
          </p>
        </Prose>
        <ChapterExplorer
          metrics={[
            { label: "Recorded on Form I-94", value: s.temporary?.value, unit: "admissions", period: s.temporary ? formatPeriod(s.temporary.period) : "", change: s.temporary?.change, compare: s.temporary?.compare },
            { label: "All temporary admissions", value: s.temporary?.all, unit: "admissions", period: s.temporary ? formatPeriod(s.temporary.period) : "", note: "Includes estimated short land-border visits" },
          ]}
          primary={[
            { key: "trend", label: "Over time", title: "Workers, students, and exchange visitors", subtitle: "I-94 admissions; repeat entries count again", kind: "time", type: "column", series: d.temporary.purpose, unit: "admissions", markers: [{ x: 2020, label: "COVID-19 travel limits" }], source: SOURCES.yearbook },
            { key: "purpose", label: "Latest mix", title: "Temporary admissions by purpose", subtitle: `${formatPeriod(d.temporary.period)} · I-94 admissions`, kind: "ranked", items: d.temporary.groups, itemLabel: "Purpose", unit: "admissions", source: SOURCES.yearbook },
          ]}
          secondaryLabel="Detail"
          secondary={[{ key: "work", label: "Work classes", title: "Largest temporary work classes", subtitle: `${formatPeriod(d.temporary.period)} · repeat entries count again`, kind: "ranked", items: d.temporary.workVisas, itemLabel: "Class", unit: "admissions", slot: 3, source: SOURCES.yearbook }]}
          callout="Admissions count entries, not unique people. A person who enters ten times is counted ten times."
        />
      </Section>

      {/* ---------------------------------------------------------- Population */}
      <Section id="population" title="Immigration and population" question="How many immigrants live in the U.S.?">
        <ChapterExplorer
          metrics={[
            { label: "Foreign-born residents", value: s.foreignBorn?.value, unit: "people", period: s.foreignBorn?.period, change: s.foreignBorn?.change, compare: s.foreignBorn?.compare },
            { label: "Share of the population", value: s.foreignBorn?.share, unit: "percent", period: s.foreignBorn?.period, note: s.foreignBorn?.naturalizedShare != null ? `${pct(s.foreignBorn.naturalizedShare)} are naturalized citizens` : undefined },
            { label: "Net international migration", value: s.netMigration?.value, unit: "people", period: s.netMigration ? periodTags.july(s.netMigration.period).label : "", change: s.netMigration?.change, compare: s.netMigration?.compare },
          ]}
          primaryLabel="Measure"
          primary={[
            { key: "citizenship", label: "Citizenship", title: "Foreign-born population by citizenship", subtitle: "Naturalized citizens and noncitizens", kind: "time", type: "column", series: d.population.foreignBorn, unit: "people", source: SOURCES.acs },
            { key: "share", label: "Population share", title: "Foreign-born share of the population", subtitle: "Per survey year", kind: "time", series: d.population.foreignBornShare, unit: "percent", fromZero: false, source: SOURCES.acs },
            { key: "migration", label: "Net migration", title: "Net international migration", subtitle: "Everyone moving in from abroad minus everyone moving abroad", kind: "time", type: "column", series: d.population.netMigration, unit: "people", source: SOURCES.pep },
            { key: "growth", label: "Population growth", title: "Where population growth comes from", subtitle: "Natural increase versus net international migration", kind: "time", type: "column", series: d.population.growth, unit: "people", source: SOURCES.pep },
          ]}
          secondaryLabel="Origin"
          secondary={[
            { key: "country", label: "Country", title: "Foreign-born residents by country of birth", subtitle: `${d.population.byCountry.period} survey`, kind: "ranked", items: d.population.byCountry.items, itemLabel: "Country", unit: "people", source: SOURCES.acs },
            { key: "region", label: "Region", title: "By world region of birth", subtitle: `${d.population.byRegion.period} survey`, kind: "ranked", items: d.population.byRegion.items, itemLabel: "Region", unit: "people", slot: 2, source: SOURCES.acs },
          ]}
          callout="Net international migration includes every status and U.S. citizens moving to or from abroad. It is not green cards minus deportations."
        />
      </Section>

      {/* --------------------------------------------------------- Enforcement */}
      <Section id="enforcement" title="Enforcement" question="How many are removed, returned, or detained?">
        <EnforcementExplorer
          departures={{
            metrics: [
              { label: "Removals", value: s.removals?.value, unit: "events", period: s.removals ? formatPeriod(s.removals.period) : "", change: s.removals?.change, compare: s.removals?.compare },
            ],
            primary: [{ key: "history", label: "1892–present", title: "Removals, returns, and expulsions since 1892", subtitle: "DHS repatriations per fiscal year · events, not unique people", kind: "time", type: "column", series: d.enforcement.repatriations, unit: "events", markers: [{ x: 1924, label: "1924 quotas" }, { x: 1996, label: "IIRIRA" }, { x: 2020, to: 2023.4, label: "Title 42" }], source: SOURCES.yearbook, note: "After the 1996 law created expedited removal, formal removals—with re-entry penalties—replaced many returns." }],
            secondary: [
              { key: "status", label: "Criminal status", title: "Removals by criminal status", subtitle: "Known conviction at the time of removal", kind: "time", type: "column", series: d.enforcement.removalsByStatus, unit: "events", source: SOURCES.yearbook },
              { key: "country", label: "Nationality", title: "Removals by nationality", subtitle: `${formatPeriod(d.enforcement.removalsByCountry.period)} · top 10`, kind: "ranked", items: d.enforcement.removalsByCountry.items, itemLabel: "Nationality", unit: "events", source: SOURCES.yearbook },
            ],
          }}
          detention={{
            metrics: [
              { label: "Average daily population", value: s.detention?.value, unit: "people", period: s.detention ? `${formatPeriod(s.detention.period)} to date` : "", change: s.detention?.change, compare: s.detention?.compare },
              { label: "No criminal conviction", value: s.detention?.noConvictionShare, unit: "percent", period: s.detention ? `${formatPeriod(s.detention.period)} to date` : "", note: s.detention?.mandatoryShare != null ? `${pct(s.detention.mandatoryShare)} in mandatory detention` : undefined },
            ],
            primary: [{ key: "population", label: "By conviction", title: "Average daily detained population", subtitle: "By criminal conviction; current year is year to date", kind: "time", type: "column", series: d.enforcement.detention, unit: "people", source: SOURCES.ice }],
            secondary: [{ key: "facilities", label: "Largest", title: "Largest detention facilities", subtitle: `${formatPeriod(d.enforcement.facilities.period)} · hover for location and average stay`, kind: "ranked", items: d.enforcement.facilities.items, itemLabel: "Facility", unit: "people", source: SOURCES.ice }],
          }}
        />
        <Disclosure summary="Definitions: removal, return, Title 42, detention, and criminal status">
          <Explainers cols={3} items={[
            { title: <Term id="removal">Removal</Term>, body: "A compulsory departure under a removal order, with consequences for re-entry." },
            { title: <Term id="return">Return</Term>, body: "A confirmed departure without a removal order, such as voluntary return." },
            { title: <Term id="title-42">Title 42 expulsion</Term>, body: "A public-health expulsion used from March 2020 through May 2023." },
          ]} />
        </Disclosure>
      </Section>

      {/* -------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare?">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      {/* ---------------------------------------------------- Related migration */}
      <Section id="related" title="Related migration" question="Moves between states and Americans abroad.">
        <Prose>
          <p>
            These are often mixed up with immigration. Moving from California to Texas is <em>domestic</em> migration, and Americans who move abroad
            are emigrants. Both are shown here for context.
          </p>
        </Prose>

        <SubHeading id="domestic" title="Moving between states" question="Which states are people moving to and from?" />
        <Prose>
          <p>
            Net domestic migration is the number of people who moved into a state from elsewhere in the U.S. minus the number who moved out, over
            the 12 months ending July 1. The state-to-state flows come from the American Community Survey, which asks everyone where they lived a
            year earlier.
          </p>
        </Prose>
        <ChapterExplorer
          primaryLabel="View"
          primary={[
            { key: "trend", label: "Total moving", title: "People who moved between states", subtitle: "Per survey year, 50 states and DC", kind: "time", type: "column", series: d.domestic.interstate, unit: "people", source: SOURCES.flows },
          ]}
          secondaryLabel="Routes"
          secondary={[{ key: "corridors", label: "Largest", title: "Largest state-to-state moves", subtitle: `${d.domestic.flows.period} survey`, kind: "ranked", items: d.domestic.flows.corridors, itemLabel: "Move", unit: "people", source: SOURCES.flows }]}
        />
        {d.domestic.flows.states.some((st) => st.origins.length) && <Disclosure summary="Explore every state's origins and destinations"><StateFlows states={d.domestic.flows.states} period={d.domestic.flows.period} /></Disclosure>}

        <SubHeading id="abroad" title="Americans living abroad" question="How many people born in the U.S. live in other countries, and where?" />
        <Prose>
          <p>
            The U.S. has no register of people who leave, so there is no official count of how many emigrate each year. The UN Population Division
            instead counts people born in the U.S. who live in each other country, from those countries&apos; censuses and surveys. This is a{" "}
            <Term id="stock">stock</Term>: someone who moved to Canada twenty years ago is still counted.
          </p>
        </Prose>
        {d.abroad.total && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">{compact(d.abroad.total.value)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">U.S.-born people living abroad</p>
            <PeriodTag {...periodTags.midYear(d.abroad.total.period)} />
          </div>
        )}
        <ChapterExplorer
          primary={[{ key: "trend", label: "Over time", title: "U.S.-born people living abroad", subtitle: "Mid-year estimate", kind: "time", type: "column", series: d.abroad.series, unit: "people", source: SOURCES.un }]}
          secondaryLabel="Where they live"
          secondary={[
            { key: "country", label: "Country", title: "Where they live, by country", subtitle: `Mid-${d.abroad.byCountry.period} · top 10`, kind: "ranked", items: d.abroad.byCountry.items, itemLabel: "Country", unit: "people", source: SOURCES.un },
            { key: "region", label: "Region", title: "Where they live, by region", subtitle: `Mid-${d.abroad.byRegion.period}`, kind: "ranked", items: d.abroad.byRegion.items, itemLabel: "Region", unit: "people", slot: 2, source: SOURCES.un },
          ]}
        />
      </Section>

      {/* ---------------------------------------------------- Common questions */}
      <Section id="questions" title="Common questions" question="Short answers to the questions these numbers raise most.">
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {faq.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-slate-900 dark:text-white">
                {f.q}
                <span aria-hidden className="mt-0.5 text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ Glossary */}
      <Section id="glossary" title="Glossary" question="Terms used on this page.">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {glossary.map(([id, g]) => (
            <div key={id} id={`term-${id}`} className="scroll-mt-28">
              <dt className="font-semibold text-slate-950 dark:text-white">{g.term}</dt>
              <dd className="mt-0.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{g.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>
      </ImmigrationChapterDeck>
    </div>
    </ImmigrationExplorerProvider>
  );
}
