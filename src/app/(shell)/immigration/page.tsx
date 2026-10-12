import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { PeriodTag, periodTags } from "@/components/charts/period-tag";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { SectionNav } from "@/components/data/section-nav";
import { EncounterExplorer } from "@/components/immigration/encounter-explorer";
import { NumbersMap, SystemPathways } from "@/components/immigration/primer";
import { StateFlows } from "@/components/immigration/state-flows";
import { Term } from "@/components/ui/term";
import { formatPeriod, formatValue } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { loadImmigration } from "@/lib/immigration/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Immigration | Worldview",
  description:
    "U.S. immigration explained with data: how the system works, border encounters, green cards, refugees and asylum, the unauthorized population, temporary visas, the foreign-born population, removals and detention — nationally and by state.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["border", "Border"],
  ["legal", "Green cards"],
  ["humanitarian", "Humanitarian"],
  ["unauthorized", "Unauthorized"],
  ["temporary", "Temporary"],
  ["population", "Population"],
  ["enforcement", "Enforcement"],
  ["states", "States"],
  ["related", "Related migration"],
  ["glossary", "Glossary"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  unauthorized: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/dhs-unauthorized" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  ice: { label: "ICE Detention Statistics", href: "/datasets/ice-detention" },
  flows: { label: "Census Bureau State-to-State Migration Flows", href: "/datasets/census-state-migration" },
  un: { label: "UN DESA International Migrant Stock", href: "/datasets/un-migrant-stock" },
};

const USES: Record<string, string> = {
  cbp: "border encounters — monthly totals by legal authority, agency, region, sector or field office, state, and citizenship",
  "dhs-yearbook": "green cards, naturalizations, refugee arrivals, asylum grants, temporary admissions, and removals and returns",
  "dhs-unauthorized": "the unauthorized immigrant population, by country of birth, state, and period of entry",
  "census-pep": "net international migration, sources of population growth, and net moves between states",
  "census-acs1-immigration": "the foreign-born population, citizenship, and countries of birth",
  "ice-detention": "the detained population, conviction status, facilities, and length of stay",
  "census-state-migration": "moves between states and residents who lived abroad a year earlier",
  "un-migrant-stock": "Americans living abroad",
};

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

  const glossary = Object.entries(GLOSSARY).sort((a, b) => a[1].term.localeCompare(b[1].term));

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">Immigration</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
          How people come to the United States, how they gain or lose legal status, how many live here, and how the law is enforced — with
          each number explained, from the agencies that count them.
        </p>
      </header>

      <SectionNav sections={SECTIONS} />

      {/* ------------------------------------------------------------ Overview */}
      <section id="overview" className="scroll-mt-28 space-y-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {s.encounters && (
              <StatTile
                label="Border encounters"
                unit="encounters"
                value={s.encounters.value}
                tag={periodTags.month(s.encounters.period)}
                note="Monthly enforcement events, not unique people"
                change={s.encounters.change}
                compareLabel={s.encounters.compare}
                spark={s.encounters.spark}
              />
            )}
            {s.lpr && (
              <StatTile
                label="New permanent residents"
                unit="people"
                value={s.lpr.value}
                tag={{ ...periodTags.fiscalYear(s.lpr.period), latest: true }}
                note={`People granted green cards — ${pct(s.lpr.adjustmentShare)} already lived in the U.S.`}
                change={s.lpr.change}
                compareLabel={s.lpr.compare}
                spark={s.lpr.spark}
              />
            )}
            {s.netMigration && (
              <StatTile
                label="Net international migration"
                unit="people"
                value={s.netMigration.value}
                tag={periodTags.july(s.netMigration.period)}
                note="Everyone moving in from abroad minus everyone moving out, U.S. citizens included"
                change={s.netMigration.change}
                compareLabel={s.netMigration.compare}
                spark={s.netMigration.spark}
              />
            )}
            {s.foreignBorn && (
              <StatTile
                label="Foreign-born population"
                unit="people"
                value={s.foreignBorn.value}
                extra={s.foreignBorn.share !== null ? `${s.foreignBorn.share.toFixed(1)}%` : undefined}
                tag={periodTags.survey(s.foreignBorn.period)}
                note="People living here who weren't U.S. citizens at birth, any status — a population, not a yearly flow"
                change={s.foreignBorn.change}
                compareLabel={s.foreignBorn.compare}
                spark={s.foreignBorn.spark}
              />
            )}
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Each agency counts on its own calendar, so every figure is tagged with its period. <Term id="fiscal-year">Fiscal years</Term> run
            October 1 – September 30. Census population estimates cover the year to July 1; the American Community Survey is collected across
            a calendar year. Some measures are yearly flows and others are a <Term id="stock">stock</Term> — a population at one moment.
          </p>
        </div>

        <div className="space-y-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">How immigration works</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              People interact with the immigration system in several separate ways. Each is counted by a different agency, in a different unit.
            </p>
          </div>
          <SystemPathways />
        </div>

        <div className="space-y-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">How these numbers relate</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              The headline numbers are not steps in one pipeline, and they don&apos;t add up to each other. Yearly flows count events or status
              decisions; people move between categories over years; the population is what&apos;s here at one moment.
            </p>
          </div>
          <NumbersMap
            encounters={{ value: s.encounters12?.value, unit: "encounters", period: lastMonth ? periodTags.trailing12(lastMonth).label : "" }}
            temporary={{ value: s.temporary?.value, period: s.temporary ? formatPeriod(s.temporary.period) : "" }}
            humanitarian={{
              value: s.refugees && s.asylum && s.refugees.period === s.asylum.period ? s.refugees.value + s.asylum.value : null,
              period: s.refugees ? formatPeriod(s.refugees.period) : "",
            }}
            greenCards={{ value: s.lpr?.value, period: s.lpr ? formatPeriod(s.lpr.period) : "" }}
            adjustmentShare={s.lpr?.adjustmentShare}
            naturalizations={{ value: s.naturalizations?.value, period: s.naturalizations ? formatPeriod(s.naturalizations.period) : "" }}
            netMigration={{ value: s.netMigration?.value, period: s.netMigration ? periodTags.july(s.netMigration.period).label : "" }}
            naturalized={d.population.foreignBorn[0].points.at(-1)?.value}
            noncitizen={d.population.foreignBorn[1].points.at(-1)?.value}
            fbPeriod={s.foreignBorn?.period ?? ""}
            unauthorized={{ value: s.unauthorized?.value, period: s.unauthorized ? `Jan ${s.unauthorized.period}` : "" }}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Common questions</h2>
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
        </div>
      </section>

      {/* -------------------------------------------------------------- Border */}
      <Section id="border" title="The border" question="How often does CBP stop people at the border, where, under what legal authority — and what happens next?">
        <KeyPoint title="An encounter is an event, not a person.">
          Someone stopped three times is three encounters. Encounters count people CBP stopped — not people who got in, and not how many people
          live here without status (that&apos;s the <a href="#unauthorized" className="underline">unauthorized population</a>).
        </KeyPoint>

        <div className="grid gap-4 sm:grid-cols-3">
          {s.encounters && (
            <StatTile
              label="Encounters, latest month"
              unit="encounters"
              value={s.encounters.value}
              tag={periodTags.month(s.encounters.period)}
              change={s.encounters.change}
              compareLabel={s.encounters.compare}
              spark={s.encounters.spark}
            />
          )}
          {s.encounters12 && lastMonth && (
            <StatTile
              label="Encounters, last 12 months"
              unit="encounters"
              value={s.encounters12.value}
              tag={periodTags.trailing12(lastMonth)}
              note={`${pct(s.encounters12.usbpShare)} Border Patrol between ports · ${pct(s.encounters12.ofoShare)} at ports of entry`}
              change={s.encounters12.change}
              compareLabel="vs prior 12 months"
            />
          )}
          {s.peakMonth && (
            <StatTile
              label="Peak month since FY 2020"
              unit="encounters"
              value={s.peakMonth.value}
              tag={periodTags.month(s.peakMonth.period)}
              note="Highest monthly total since October 2019, where this series begins"
            />
          )}
        </div>

        <div id="title-8-42" className="scroll-mt-28 space-y-3">
          <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Title 8 vs. Title 42</h3>
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
        </div>

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

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Where CBP encounters were recorded, by state"
            subtitle={`${lastMonth ? periodTags.trailing12(lastMonth).label : ""} · state of the CBP office that recorded the encounter — not where the person lives or went`}
            source={SOURCES.cbp}
            table={rankedTable(d.border.byState, "State", "encounters")}
          >
            <RankedBars items={d.border.byState} unit="encounters" />
          </ChartCard>
          <ChartCard
            title="By Border Patrol sector or port field office"
            subtitle={`${lastMonth ? periodTags.trailing12(lastMonth).label : ""} · sectors patrol between ports; field offices run ports, including airports`}
            source={SOURCES.cbp}
            table={rankedTable(d.border.byOffice, "Sector or field office", "encounters")}
          >
            <RankedBars items={d.border.byOffice} unit="encounters" slot={3} />
          </ChartCard>
          <ChartCard
            title="By citizenship"
            subtitle={`${lastMonth ? periodTags.trailing12(lastMonth).label : ""} · country of citizenship of the person encountered`}
            source={SOURCES.cbp}
            table={rankedTable(d.border.byCitizenship, "Citizenship", "encounters")}
          >
            <RankedBars items={d.border.byCitizenship} unit="encounters" />
          </ChartCard>
        </div>
      </Section>

      {/* -------------------------------------------------------- Legal / LPR */}
      <Section id="legal" title="Green cards" question="How many people become permanent residents each year, through which programs, and from where?">
        <Prose>
          <p>
            A <Term id="green-card">green card</Term> makes someone a <Term id="lpr">lawful permanent resident</Term>: they can live and work in the
            U.S. permanently and, usually after five years, apply for citizenship. Green cards go both to people arriving with an immigrant visa and
            to people already living here who <Term id="adjustment-of-status">adjust their status</Term> — so a year&apos;s green cards are not a
            year&apos;s arrivals.
          </p>
        </Prose>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="How people got green cards"
            subtitle={`${formatPeriod(d.legal.pathways.period)} · class of admission`}
            source={SOURCES.yearbook}
            table={rankedTable(d.legal.pathways.items, "Class of admission", "people")}
          >
            <RankedBars items={d.legal.pathways.items} unit="people" />
          </ChartCard>
          <div className="rounded-2xl border border-slate-200 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">The main pathways</h3>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="font-medium text-slate-900 dark:text-white">Immediate relatives of U.S. citizens</dt>
                <dd>Spouses, unmarried children under 21, and parents of adult citizens. No annual limit.</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-white">Family-sponsored preferences</dt>
                <dd>Other relatives of citizens and of green-card holders, under annual caps with per-country limits — waits can run decades.</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-white">Employment-based preferences</dt>
                <dd>Workers sponsored by employers, people of extraordinary ability, and investors, plus their families. Capped yearly.</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-white">Refugees and asylees</dt>
                <dd>People admitted for protection, adjusting to permanent residence after a year.</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-white">Diversity</dt>
                <dd>A lottery for countries with low recent immigration, up to about 55,000 a year.</dd>
              </div>
            </dl>
          </div>
          <ChartCard
            title="Already here, or arriving?"
            subtitle="Per fiscal year · where new green-card holders were when they got it"
            source={SOURCES.yearbook}
            table={seriesTable(d.legal.lprSplit, "people")}
          >
            <TimeSeriesChart series={d.legal.lprSplit} type="column" unit="people" />
          </ChartCard>
          <ChartCard
            title="Green cards by country of birth"
            subtitle={`${formatPeriod(d.legal.byCountry.period)} · top 10`}
            source={SOURCES.yearbook}
            table={rankedTable(d.legal.byCountry.items, "Country", "people")}
          >
            <RankedBars items={d.legal.byCountry.items} unit="people" />
          </ChartCard>
        </div>

        <ChartCard
          title="Two centuries of permanent immigration"
          subtitle="New lawful permanent residents per fiscal year, 1820 onward, with the laws that reshaped who could come"
          source={SOURCES.yearbook}
          table={seriesTable(d.legal.lprHistory, "people")}
        >
          <TimeSeriesChart
            series={d.legal.lprHistory}
            unit="people"
            height={320}
            markers={[
              { x: 1882, label: "1882 Chinese Exclusion Act" },
              { x: 1921, label: "1921 Emergency Quota Act" },
              { x: 1924, label: "1924 national-origins quotas" },
              { x: 1965, label: "1965 Hart–Celler Act" },
              { x: 1986, label: "1986 IRCA" },
              { x: 1990, label: "1990 Immigration Act" },
            ]}
          />
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            These counts sit inside changing legal systems: early years come from port arrival records, the 1920s laws capped immigration by national
            origin, and the 1965 act replaced those quotas with today&apos;s family- and employment-based system. The 1989–1991 peak is people
            legalized under the 1986 Immigration Reform and Control Act (IRCA) receiving green cards.
          </p>
        </ChartCard>

        <SubHeading id="citizenship" title="Becoming a citizen" question="How many green-card holders naturalize, and how much of the foreign-born population are citizens?" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Naturalization applications and new citizens" subtitle="Per fiscal year, since 1907" source={SOURCES.yearbook} table={seriesTable(d.legal.naturalizations, "people")}>
            <TimeSeriesChart series={d.legal.naturalizations} unit="people" />
          </ChartCard>
          <ChartCard
            title="Share of foreign-born residents who are citizens"
            subtitle="Naturalized citizens as a share of all foreign-born residents · per survey year"
            source={SOURCES.acs}
            table={seriesTable(d.legal.naturalizedShare, "percent")}
          >
            <TimeSeriesChart series={d.legal.naturalizedShare} unit="percent" fromZero={false} />
          </ChartCard>
          <ChartCard
            title="New citizens by country of birth"
            subtitle={`${formatPeriod(d.legal.natzByCountry.period)} · top 10`}
            source={SOURCES.yearbook}
            table={rankedTable(d.legal.natzByCountry.items, "Country", "people")}
          >
            <RankedBars items={d.legal.natzByCountry.items} unit="people" />
          </ChartCard>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {s.refugees && (
            <StatTile
              label="Refugee arrivals"
              unit="people"
              value={s.refugees.value}
              tag={{ ...periodTags.fiscalYear(s.refugees.period), latest: true }}
              change={s.refugees.change}
              compareLabel={s.refugees.compare}
              spark={s.refugees.spark}
            />
          )}
          {s.asylum && (
            <StatTile
              label="People granted asylum"
              unit="people"
              value={s.asylum.value}
              tag={{ ...periodTags.fiscalYear(s.asylum.period), latest: true }}
              change={s.asylum.change}
              compareLabel={s.asylum.compare}
              spark={s.asylum.spark}
            />
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Refugee arrivals" subtitle="Per fiscal year, since the Refugee Act of 1980" source={SOURCES.yearbook} table={seriesTable(d.humanitarian.refugees, "people")}>
            <TimeSeriesChart
              series={d.humanitarian.refugees}
              unit="people"
              markers={[
                { x: 2002, label: "Post-9/11 security changes" },
                { x: 2020, label: "COVID-19" },
              ]}
            />
          </ChartCard>
          <ChartCard title="Asylum grants, by route" subtitle="People granted asylum per fiscal year" source={SOURCES.yearbook} table={seriesTable(d.humanitarian.asylum, "people")}>
            <TimeSeriesChart series={d.humanitarian.asylum} type="column" unit="people" />
          </ChartCard>
          <ChartCard
            title="Refugee arrivals by nationality"
            subtitle={`${formatPeriod(d.humanitarian.refugeesByCountry.period)} · top 10`}
            source={SOURCES.yearbook}
            table={rankedTable(d.humanitarian.refugeesByCountry.items, "Nationality", "people")}
          >
            <RankedBars items={d.humanitarian.refugeesByCountry.items} unit="people" />
          </ChartCard>
          <ChartCard
            title="Affirmative asylum grants by nationality"
            subtitle={`${formatPeriod(d.humanitarian.asylumByCountry.period)} · top 10 · grants by USCIS asylum officers`}
            source={SOURCES.yearbook}
            table={rankedTable(d.humanitarian.asylumByCountry.items, "Nationality", "people")}
          >
            <RankedBars items={d.humanitarian.asylumByCountry.items} unit="people" slot={2} />
          </ChartCard>
        </div>
      </Section>

      {/* -------------------------------------------------------- Unauthorized */}
      <Section id="unauthorized" title="The unauthorized population" question="How many people live in the U.S. without legal status, where are they from, and where do they live?">
        <KeyPoint title="Border encounters are not a measure of this population.">
          Encounters count stops at the border, including repeat stops and people turned back. The unauthorized population is everyone living here
          without status on a given date — including people who entered legally and overstayed, and people who arrived decades ago.
        </KeyPoint>
        <div className="grid gap-4 sm:grid-cols-3">
          {s.unauthorized && (
            <StatTile
              label="Unauthorized immigrants (DHS estimate)"
              unit="people"
              value={s.unauthorized.value}
              tag={{ ...periodTags.january(s.unauthorized.period), latest: true }}
              spark={s.unauthorized.spark}
            />
          )}
          {s.unauthorized?.shareOfPopulation != null && (
            <StatTile
              label="Share of all U.S. residents"
              unit="percent"
              value={s.unauthorized.shareOfPopulation}
              tag={periodTags.january(s.unauthorized.period)}
              note={s.unauthorized.shareOfForeignBorn != null ? `${pct(s.unauthorized.shareOfForeignBorn)} of the foreign-born population` : undefined}
            />
          )}
          <StatTile
            label="Pew Research Center estimate"
            unit="people"
            value={14_000_000}
            tag={{ label: "Jul 2023", title: "Pew Research Center, published August 2025" }}
            note={
              <>
                4.1% of U.S. residents ·{" "}
                <a
                  className="underline"
                  href="https://www.pewresearch.org/race-and-ethnicity/2025/08/21/u-s-unauthorized-immigrant-population-reached-a-record-14-million-in-2023/"
                >
                  Pew, 2025
                </a>
              </>
            }
          />
        </div>
        <Prose>
          <p>
            No agency counts <Term id="unauthorized">unauthorized immigrants</Term> directly. DHS estimates them by subtraction: the foreign-born
            population measured by the Census Bureau&apos;s survey, adjusted for people the survey misses, minus everyone known to be here legally
            (green-card holders, refugees, asylees, and temporary residents). DHS&apos;s most recent estimate is for January 2022; independent
            researchers use similar methods with newer survey data.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Estimated unauthorized population"
            subtitle="January 1 of each year · no estimates for 2001–2004 or 2021"
            source={SOURCES.unauthorized}
            table={seriesTable(d.unauthorized.series, "people")}
          >
            <TimeSeriesChart
              series={d.unauthorized.series}
              unit="people"
              markers={[
                { x: 2010, label: "Re-based on 2010 Census" },
                { x: 2022, label: "2020 Census base" },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="By country of birth"
            subtitle={`January 1, ${d.unauthorized.byCountry.period} · top 10`}
            source={SOURCES.unauthorized}
            table={rankedTable(d.unauthorized.byCountry.items, "Country of birth", "people")}
          >
            <RankedBars items={d.unauthorized.byCountry.items} unit="people" limit={11} />
          </ChartCard>
          <ChartCard
            title="By state of residence"
            subtitle={`January 1, ${d.unauthorized.byState.period} · top 10 states`}
            source={SOURCES.unauthorized}
            table={rankedTable(
              [...d.unauthorized.byState.items, ...(d.unauthorized.byState.other ? [{ label: "All other states", value: d.unauthorized.byState.other }] : [])],
              "State",
              "people",
            )}
          >
            <RankedBars
              items={[...d.unauthorized.byState.items, ...(d.unauthorized.byState.other ? [{ label: "All other states", value: d.unauthorized.byState.other }] : [])]}
              unit="people"
              limit={11}
              slot={3}
            />
          </ChartCard>
          <ChartCard
            title="When they arrived"
            subtitle={`January 1, ${d.unauthorized.byEntry.period} · period of entry to the U.S.`}
            source={SOURCES.unauthorized}
            table={rankedTable(d.unauthorized.byEntry.items, "Period of entry", "people")}
          >
            <RankedBars items={d.unauthorized.byEntry.items} unit="people" slot={2} />
          </ChartCard>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {s.temporary && (
            <StatTile
              label="Temporary admissions recorded on Form I-94"
              unit="admissions"
              value={s.temporary.value}
              tag={{ ...periodTags.fiscalYear(s.temporary.period), latest: true }}
              note="Entries by air and sea, and land entries beyond the border zone"
              change={s.temporary.change}
              compareLabel={s.temporary.compare}
              spark={s.temporary.spark}
            />
          )}
          {s.temporary?.all != null && (
            <StatTile
              label="All temporary admissions (estimated)"
              unit="admissions"
              value={s.temporary.all}
              tag={periodTags.fiscalYear(s.temporary.period)}
              note="Adds short visits by Canadian and Mexican border crossers not recorded on I-94"
            />
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Temporary admissions by purpose"
            subtitle={`${formatPeriod(d.temporary.period)} · I-94 admissions`}
            source={SOURCES.yearbook}
            table={rankedTable(d.temporary.groups, "Purpose", "admissions")}
          >
            <RankedBars items={d.temporary.groups} unit="admissions" />
          </ChartCard>
          <ChartCard
            title="Workers, students, and exchange visitors"
            subtitle="I-94 admissions per fiscal year · their families are counted separately"
            source={SOURCES.yearbook}
            table={seriesTable(d.temporary.purpose, "admissions")}
          >
            <TimeSeriesChart series={d.temporary.purpose} type="column" unit="admissions" markers={[{ x: 2020, label: "COVID-19 travel limits" }]} />
          </ChartCard>
          <ChartCard
            title="Largest temporary work classes"
            subtitle={`${formatPeriod(d.temporary.period)} · I-94 admissions — workers who travel often are counted each time`}
            source={SOURCES.yearbook}
            table={rankedTable(d.temporary.workVisas, "Class", "admissions")}
          >
            <RankedBars items={d.temporary.workVisas} unit="admissions" slot={3} />
          </ChartCard>
        </div>
      </Section>

      {/* ---------------------------------------------------------- Population */}
      <Section id="population" title="Immigration and population" question="How many immigrants live in the U.S., and how much does migration change the population?">
        <div className="grid gap-4 sm:grid-cols-3">
          {s.foreignBorn && (
            <StatTile
              label="Foreign-born residents"
              unit="people"
              value={s.foreignBorn.value}
              tag={periodTags.survey(s.foreignBorn.period)}
              change={s.foreignBorn.change}
              compareLabel={s.foreignBorn.compare}
              spark={s.foreignBorn.spark}
            />
          )}
          {s.foreignBorn?.share != null && (
            <StatTile
              label="Share of the population"
              unit="percent"
              value={s.foreignBorn.share}
              tag={periodTags.survey(s.foreignBorn.period)}
              note={s.foreignBorn.naturalizedShare != null ? `${pct(s.foreignBorn.naturalizedShare)} of foreign-born residents are naturalized citizens` : undefined}
            />
          )}
          {s.netMigration && (
            <StatTile
              label="Net international migration"
              unit="people"
              value={s.netMigration.value}
              tag={periodTags.july(s.netMigration.period)}
              change={s.netMigration.change}
              compareLabel={s.netMigration.compare}
            />
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Foreign-born population, by citizenship"
            subtitle="People living in the U.S. who weren't citizens at birth · per survey year"
            source={SOURCES.acs}
            table={seriesTable(d.population.foreignBorn, "people")}
          >
            <TimeSeriesChart series={d.population.foreignBorn} type="column" unit="people" />
          </ChartCard>
          <ChartCard title="Foreign-born share of the population" subtitle="Per survey year" source={SOURCES.acs} table={seriesTable(d.population.foreignBornShare, "percent")}>
            <TimeSeriesChart series={d.population.foreignBornShare} unit="percent" fromZero={false} />
          </ChartCard>
          <ChartCard
            title="Net international migration"
            subtitle="Everyone who moved in from abroad minus everyone who moved abroad · 12 months to July 1"
            source={SOURCES.pep}
            table={seriesTable(d.population.netMigration, "people")}
          >
            <TimeSeriesChart series={d.population.netMigration} type="column" unit="people" />
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-white">Includes</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>immigrants of every status — green-card holders, temporary residents, unauthorized</li>
                <li>U.S. citizens returning from or leaving for abroad, including Puerto Rico</li>
                <li>foreign-born residents who leave the country</li>
              </ul>
              <p className="mt-2">So it is not green cards, not border encounters, and not immigration minus deportations.</p>
            </div>
          </ChartCard>
          <ChartCard
            title="Where population growth comes from"
            subtitle="Natural increase vs. net international migration · 12 months to July 1"
            source={SOURCES.pep}
            table={seriesTable(d.population.growth, "people")}
          >
            <TimeSeriesChart series={d.population.growth} type="column" unit="people" />
          </ChartCard>
          <ChartCard
            title="Foreign-born residents by country of birth"
            subtitle={`${d.population.byCountry.period} survey · top 10`}
            source={SOURCES.acs}
            table={rankedTable(d.population.byCountry.items, "Country of birth", "people")}
          >
            <RankedBars items={d.population.byCountry.items} unit="people" />
          </ChartCard>
          <ChartCard
            title="By world region of birth"
            subtitle={`${d.population.byRegion.period} survey`}
            source={SOURCES.acs}
            table={rankedTable(d.population.byRegion.items, "Region", "people")}
          >
            <RankedBars items={d.population.byRegion.items} unit="people" slot={2} />
          </ChartCard>
        </div>
      </Section>

      {/* --------------------------------------------------------- Enforcement */}
      <Section id="enforcement" title="Enforcement" question="How many people are removed or returned, and how many are held in immigration detention?">
        <Explainers
          cols={3}
          items={[
            { title: <Term id="removal">Removal</Term>, body: "A compulsory departure under a removal order. What most people mean by deportation; bars re-entry for years." },
            { title: <Term id="return">Return</Term>, body: "A confirmed departure without a removal order, such as voluntary return at the border. Fewer consequences for re-entry." },
            { title: <Term id="title-42">Title 42 expulsion</Term>, body: "A public-health expulsion, March 2020 – May 2023, with no immigration processing." },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {s.removals && (
            <StatTile
              label="Removals"
              unit="events"
              value={s.removals.value}
              tag={{ ...periodTags.fiscalYear(s.removals.period), latest: true }}
              change={s.removals.change}
              compareLabel={s.removals.compare}
              spark={s.removals.spark}
            />
          )}
          {s.detention && (
            <StatTile
              label="Held in ICE detention, daily average"
              unit="people"
              value={s.detention.value}
              tag={{ ...periodTags.fiscalYear(s.detention.period), label: `${periodTags.fiscalYear(s.detention.period).label} to date` }}
              change={s.detention.change}
              compareLabel={s.detention.compare}
              spark={s.detention.spark}
            />
          )}
          {s.detention?.noConvictionShare != null && (
            <StatTile
              label="Detained with no criminal conviction"
              unit="percent"
              value={s.detention.noConvictionShare}
              tag={{ ...periodTags.fiscalYear(s.detention.period), label: `${periodTags.fiscalYear(s.detention.period).label} to date` }}
              note={s.detention.mandatoryShare != null ? `${pct(s.detention.mandatoryShare)} were in mandatory detention` : undefined}
            />
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Removals, returns, and expulsions since 1892"
            subtitle="DHS repatriations per fiscal year · events, not unique people"
            source={SOURCES.yearbook}
            table={seriesTable(d.enforcement.repatriations, "events")}
            className="lg:col-span-2"
          >
            <TimeSeriesChart
              series={d.enforcement.repatriations}
              type="column"
              unit="events"
              height={300}
              markers={[{ x: 1996, label: "1996 IIRIRA: expedited removal" }]}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Through the 1990s most departures were returns of people stopped at the border. The 1996 Illegal Immigration Reform and Immigrant
              Responsibility Act created expedited removal, and removals — with penalties on re-entry — replaced many returns.
            </p>
          </ChartCard>
          <ChartCard
            title="Removals by criminal status"
            subtitle="Per fiscal year · known criminal conviction at the time of removal"
            source={SOURCES.yearbook}
            table={seriesTable(d.enforcement.removalsByStatus, "events")}
          >
            <TimeSeriesChart series={d.enforcement.removalsByStatus} type="column" unit="events" />
          </ChartCard>
          <ChartCard
            title="Removals by country of nationality"
            subtitle={`${formatPeriod(d.enforcement.removalsByCountry.period)} · top 10`}
            source={SOURCES.yearbook}
            table={rankedTable(d.enforcement.removalsByCountry.items, "Nationality", "events")}
          >
            <RankedBars items={d.enforcement.removalsByCountry.items} unit="events" />
          </ChartCard>
        </div>

        <SubHeading title="Immigration detention" question="Who is held by ICE, and where?" />
        <Explainers
          items={[
            {
              title: <Term id="ice-detention">Civil, not criminal</Term>,
              body: (
                <>
                  ICE detention holds people while their immigration case is decided or their removal is arranged. It is not a criminal sentence:
                  being in the U.S. without status is a civil violation. People serving criminal sentences are in jails and prisons, not counted
                  here.
                </>
              ),
            },
            {
              title: <Term id="criminal-conviction">What “criminal conviction” means here</Term>,
              body: (
                <>
                  Any conviction on record counts, including immigration crimes such as illegal re-entry and minor offenses. “No criminal
                  conviction” can include people with pending charges. ICE rates people with convictions by <Term id="threat-level">threat level</Term>{" "}
                  1–3.
                </>
              ),
            },
            {
              title: <Term id="mandatory-detention">Mandatory detention</Term>,
              body: "Some people must be held by law — for example those with certain convictions or in expedited removal — and cannot be released on bond.",
            },
            {
              title: "Average daily population",
              body: "The average number of people held on any given day over the fiscal year. It is not the number of people who passed through detention, which is far larger.",
            },
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Average daily detained population" subtitle="By criminal conviction, per fiscal year (current year to date)" source={SOURCES.ice} table={seriesTable(d.enforcement.detention, "people")}>
            <TimeSeriesChart series={d.enforcement.detention} type="column" unit="people" />
          </ChartCard>
          <ChartCard
            title="Largest detention facilities"
            subtitle={`${formatPeriod(d.enforcement.facilities.period)} · average daily population · hover for location and average stay`}
            source={SOURCES.ice}
            table={rankedTable(d.enforcement.facilities.items, "Facility", "people")}
          >
            <RankedBars items={d.enforcement.facilities.items} unit="people" />
          </ChartCard>
        </div>
      </Section>

      {/* -------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      {/* ---------------------------------------------------- Related migration */}
      <Section id="related" title="Related migration" question="Moves between states and Americans living abroad — migration, but not immigration.">
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
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Largest net gains from other states" subtitle={`Year to July 1, ${d.domestic.period} · net domestic migration`} source={SOURCES.pep} table={rankedTable(d.domestic.gains, "State", "people")}>
            <RankedBars items={d.domestic.gains} unit="people" slot={3} />
          </ChartCard>
          <ChartCard title="Largest net losses to other states" subtitle={`Year to July 1, ${d.domestic.period} · more people moved out than in`} source={SOURCES.pep} table={rankedTable(d.domestic.losses, "State", "people")}>
            <RankedBars items={d.domestic.losses} unit="people" slot={2} />
          </ChartCard>
          <ChartCard title="Largest state-to-state moves" subtitle={`${d.domestic.flows.period} survey · people moving from one state to another`} source={SOURCES.flows} table={rankedTable(d.domestic.flows.corridors, "Move", "people")}>
            <RankedBars items={d.domestic.flows.corridors} unit="people" />
          </ChartCard>
          <ChartCard title="People who moved between states" subtitle="Per survey year, 50 states and DC" source={SOURCES.flows} table={seriesTable(d.domestic.interstate, "people")}>
            <TimeSeriesChart series={d.domestic.interstate} type="column" unit="people" />
          </ChartCard>
        </div>
        {d.domestic.flows.states.some((st) => st.origins.length) && <StateFlows states={d.domestic.flows.states} period={d.domestic.flows.period} />}

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
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="U.S.-born people living abroad" subtitle="Mid-year estimate" source={SOURCES.un} table={seriesTable(d.abroad.series, "people")} className="lg:col-span-2">
            <TimeSeriesChart series={d.abroad.series} type="column" unit="people" height={240} />
          </ChartCard>
          <ChartCard title="Where they live, by country" subtitle={`Mid-${d.abroad.byCountry.period} · top 10`} source={SOURCES.un} table={rankedTable(d.abroad.byCountry.items, "Country", "people")}>
            <RankedBars items={d.abroad.byCountry.items} unit="people" />
          </ChartCard>
          <ChartCard title="Where they live, by region" subtitle={`Mid-${d.abroad.byRegion.period}`} source={SOURCES.un} table={rankedTable(d.abroad.byRegion.items, "Region", "people")}>
            <RankedBars items={d.abroad.byRegion.items} unit="people" slot={2} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Glossary */}
      <Section id="glossary" title="Glossary" question="The terms used on this page. Underlined terms anywhere on Worldview show these definitions.">
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {glossary.map(([id, g]) => (
            <div key={id} id={`term-${id}`} className="scroll-mt-28">
              <dt className="font-semibold text-slate-950 dark:text-white">{g.term}</dt>
              <dd className="mt-0.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{g.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ------------------------------------------------------------- Sources */}
      <Section
        id="sources"
        title="Sources and methods"
        question="Every figure on this page comes from the datasets below, refreshed automatically from each publisher."
      >
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Open a dataset for its full methodology, coverage, and API access.{" "}
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>{" "}
          · <Link href="/datasets/publish" className="underline underline-offset-2">Publish your institution&apos;s data</Link>
        </p>
      </Section>
    </div>
  );
}
