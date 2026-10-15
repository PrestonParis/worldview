import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { SectionNav } from "@/components/data/section-nav";
import { DemographicsForecast } from "@/components/demographics/demographics-forecast";
import { loadReligion, type GroupProfile } from "@/lib/religion/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Religion | Worldview",
  description:
    "Religion in the United States with data: affiliation by state with projections, attendance at services, Christian traditions and denominations, belief and prayer, and party identification by religious group.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["affiliation", "Affiliation"],
  ["attendance", "Attendance"],
  ["traditions", "Traditions"],
  ["belief", "Belief"],
  ["politics", "Politics"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  pew: { label: "Pew Research Center, Religious Landscape Study", href: "/datasets/pew-rls" },
  gallup: { label: "Gallup religion trends", href: "/datasets/gallup-religion" },
};

const USES: Record<string, string> = {
  "pew-rls": "affiliation, attendance, belief, and party by state and by religious group, 2007, 2014, and 2023–24",
  "gallup-religion": "yearly national trends in membership, attendance, religious preference, and importance of religion",
};

const whole = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

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

export default async function ReligionPage() {
  const d = await loadReligion();
  if (!d) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Religion</h1>
        <p className="mt-4 text-slate-500">No religion data is loaded yet.</p>
      </div>
    );
  }
  const h = d.headline;
  const n = d.national;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">Religion</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
          What Americans believe and how they practice it: religious identity by state with projections, who attends services and how
          often, the size of each Christian tradition and denomination, and how each group leans politically.
        </p>
      </header>

      <ChartCard title="Membership and attendance" subtitle="Share of U.S. adults, yearly" source={SOURCES.gallup} table={seriesTable(d.attendance, "percent")}>
        <TimeSeriesChart series={d.attendance} unit="percent" height={340} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      {/* ------------------------------------------------------------ Overview */}
      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Christian"
            unit="percent"
            value={h.christian.value}
            period="2023–24"
            note={h.christian.then !== null ? `${whole(h.christian.then)} in 2007 · share of adults` : "Share of adults"}
          />
          <StatTile
            label="Religiously unaffiliated"
            unit="percent"
            value={h.nones.value}
            period="2023–24"
            note={h.nones.then !== null ? `${whole(h.nones.then)} in 2007 · atheist, agnostic, or nothing in particular` : undefined}
          />
          <StatTile
            label="Attend services weekly"
            unit="percent"
            value={h.weekly.value}
            period="2023–24"
            note={n.seldom !== null ? `${whole(n.seldom)} seldom or never attend` : undefined}
          />
          <StatTile
            label="Church, synagogue, or mosque members"
            unit="percent"
            value={h.member.point?.value ?? null}
            period={h.member.point?.period}
            note="Gallup · say they belong to a congregation"
            spark={h.member.spark}
          />
        </div>
        <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Key findings</h3>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {d.findings.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- Affiliation */}
      <Section id="affiliation" title="Religious affiliation" question="How Christian is each state, how fast are the unaffiliated growing, and where is that heading?">
        <Prose>
          <p>
            The same affiliation view as on{" "}
            <Link href="/demographics?dim=religion" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
              Demographics
            </Link>
            : pick a state on the map, a group, and a year. Values after the latest survey are projections.
          </p>
        </Prose>
        <Suspense>
          <DemographicsForecast lockedDimension="religion" />
        </Suspense>
      </Section>

      {/* ----------------------------------------------------------- Attendance */}
      <Section id="attendance" title="Attendance at services" question="How many Americans go to religious services, and how has that changed?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Weekly attendance by tradition"
            subtitle="2023–24 · attend at least once a week"
            source={SOURCES.pew}
            table={rankedTable(d.attendanceByGroup, "Tradition", "percent")}
          >
            <RankedBars items={d.attendanceByGroup} unit="percent" limit={d.attendanceByGroup.length} />
          </ChartCard>
          <ChartCard title="Highest weekly attendance" subtitle="2023–24 · states" source={SOURCES.pew} table={rankedTable(d.attendanceTop, "State", "percent")}>
            <RankedBars items={d.attendanceTop} unit="percent" />
          </ChartCard>
          <ChartCard title="Lowest weekly attendance" subtitle="2023–24 · states" source={SOURCES.pew} table={rankedTable(d.attendanceBottom, "State", "percent")}>
            <RankedBars items={d.attendanceBottom} unit="percent" slot={2} />
          </ChartCard>
          <ChartCard
            title="Largest declines since 2007"
            subtitle="Percentage points of adults attending weekly"
            source={SOURCES.pew}
            table={rankedTable(d.attendanceDrop, "State", "points")}
            className="lg:col-span-2"
          >
            <RankedBars items={d.attendanceDrop} unit="points" slot={2} />
          </ChartCard>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pew&apos;s 2023–24 survey was answered mostly online and on paper; earlier surveys were by phone, where people tend to report more
          attendance. Gallup&apos;s yearly figures are all by phone.
        </p>
      </Section>

      {/* ----------------------------------------------------------- Traditions */}
      <Section id="traditions" title="Traditions and denominations" question="How large is each religious tradition, and which are growing or shrinking?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Religious composition" subtitle="Share of U.S. adults, 2023–24" source={SOURCES.pew} table={rankedTable(d.composition, "Tradition", "percent")}>
            <RankedBars items={d.composition} unit="percent" limit={d.composition.length} />
          </ChartCard>
          <ChartCard title="Largest denominations" subtitle="Share of U.S. adults, 2023–24" source={SOURCES.pew} table={rankedTable(d.denominations, "Denomination", "percent")}>
            <RankedBars items={d.denominations} unit="percent" slot={3} />
          </ChartCard>
          <ChartCard
            title="Religious preference since 1948"
            subtitle="Share of U.S. adults, yearly"
            source={SOURCES.gallup}
            table={seriesTable(d.preference, "percent")}
            className="lg:col-span-2"
          >
            <TimeSeriesChart series={d.preference} unit="percent" height={300} />
          </ChartCard>
        </div>
        <GroupTable groups={d.groups} />
      </Section>

      {/* --------------------------------------------------------------- Belief */}
      <Section id="belief" title="Belief and practice" question="How important is religion to Americans, and how many pray or are certain God exists?">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Religion very important" unit="percent" value={n.importance} period="2023–24" note="Pew · share of adults" />
          <StatTile label="Pray at least daily" unit="percent" value={n.prayDaily} period="2023–24" note="Pew · share of adults" />
          <StatTile label="Absolutely certain God exists" unit="percent" value={n.godCertain} period="2023–24" note="Pew · God or a universal spirit" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Religion very important in life" subtitle="Share of U.S. adults, yearly" source={SOURCES.gallup} table={seriesTable(d.importance, "percent")}>
            <TimeSeriesChart series={d.importance} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Confidence in organized religion" subtitle="Great deal or quite a lot · share of U.S. adults" source={SOURCES.gallup} table={seriesTable(d.confidence, "percent")}>
            <TimeSeriesChart series={d.confidence} unit="percent" height={260} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------- Politics */}
      <Section id="politics" title="Religion and party" question="Which religious groups lean Republican or Democratic, and how has that moved?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Republican or lean Republican" subtitle="2023–24 · share of each group" source={SOURCES.pew} table={rankedTable(d.partyLean, "Tradition", "percent")}>
            <RankedBars items={d.partyLean} unit="percent" />
          </ChartCard>
          <ChartCard title="Republican lean since 2007" subtitle="Share of each group · 2007, 2014, 2023–24" source={SOURCES.pew} table={seriesTable(d.partyShift, "percent")}>
            <TimeSeriesChart series={d.partyShift} unit="percent" height={280} fromZero={false} xTickValues={[2007, 2014, 2024]} />
          </ChartCard>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Bars are red where Republicans and Republican leaners outnumber Democrats and Democratic leaners, blue otherwise. Votes by party in
          each state are on{" "}
          <Link href="/elections" className="underline underline-offset-2">
            Elections
          </Link>
          .
        </p>
      </Section>

      {/* --------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      {/* -------------------------------------------------------------- Sources */}
      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Open a dataset for its full methodology, coverage, and API access.{" "}
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>
        </p>
      </Section>
    </div>
  );
}

// Who belongs to each tradition: one row per group, the latest survey.
function GroupTable({ groups }: { groups: GroupProfile[] }) {
  const cols = [
    ["share_of_adults", "Share of adults"],
    ["attendance_weekly", "Attend weekly"],
    ["age_18_29", "Under 30"],
    ["age_65plus", "65 and over"],
    ["race_white", "White"],
    ["race_hispanic", "Hispanic"],
    ["race_black", "Black"],
    ["educ_college", "College graduate"],
  ] as const;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="px-4 pt-4 pb-2 text-left">
          <span className="block font-semibold text-slate-950 dark:text-white">Who belongs to each tradition</span>
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
            2023–24 · share of each group&apos;s adults · &ldquo;College graduate&rdquo; excludes postgraduates
          </span>
        </caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Tradition</th>
            {cols.map(([, label]) => (
              <th key={label} className="px-3 py-2 text-right font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.slug} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
              <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{g.label}</td>
              {cols.map(([key]) => (
                <td key={key} className="px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                  {whole(g.latest[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
