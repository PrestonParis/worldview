import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { IssueEmpty, IssueHeader, KeyFindings, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { loadEducation } from "@/lib/education/data";
import { formatPeriod } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Education | Worldview",
  description:
    "Education in the United States with data: NAEP math and reading scores and proficiency since the 1990s, results by state, educational attainment, tuition prices, and student debt.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["scores", "Test scores"],
  ["proficiency", "Proficiency"],
  ["attainment", "Attainment"],
  ["college", "College costs"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  naep: { label: "NAEP (Nation's Report Card)", href: "/datasets/naep" },
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-social" },
  fred: { label: "BLS and Federal Reserve via FRED", href: "/datasets/fred-education" },
};

const USES: Record<string, string> = {
  naep: "math and reading scores and proficiency, nationally and by state",
  "census-acs1-social": "high school and college attainment, nationally and by state",
  "fred-education": "tuition prices and student loans",
  "fred-economy": "overall consumer prices, to compare with tuition",
};

const pre = { x: 2019, label: "Last test before the pandemic" };

export default async function EducationPage() {
  const d = await loadEducation();
  if (!d) return <IssueEmpty title="Education" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Education">
        How well American students read and do math, how many adults finish high school and college, and what college costs — from the Nation&apos;s
        Report Card, the Census Bureau, and the Federal Reserve.
      </IssueHeader>

      <ChartCard title="Math scores" subtitle="Average NAEP score, 0–500 scale" source={SOURCES.naep} table={seriesTable(d.math, "points")}>
        <TimeSeriesChart series={d.math} unit="points" height={340} fromZero={false} markers={[pre]} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Grade 8 math, Proficient" unit="percent" value={h.math8.point?.value ?? null} period={h.math8.point?.period} note="At or above NAEP Proficient, public schools" spark={h.math8.spark} />
          <StatTile label="Grade 4 reading, Proficient" unit="percent" value={h.reading4.point?.value ?? null} period={h.reading4.point?.period} note="At or above NAEP Proficient, public schools" spark={h.reading4.spark} />
          <StatTile label="Bachelor's degree or more" unit="percent" value={h.ba.point?.value ?? null} period={h.ba.point?.period} note="Adults 25 and over" spark={h.ba.spark} />
          <StatTile label="Student loans owed" unit="usd" value={h.loans.point?.value ?? null} period={h.loans.point ? formatPeriod(h.loans.point.period) : undefined} note="Outstanding, end of quarter" spark={h.loans.spark} />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="scores" title="Test scores" question="Are students reading and doing math better or worse than before?">
        <Prose>
          <p>
            The National Assessment of Educational Progress tests samples of fourth and eighth graders in every state on the same scales over time,
            so scores can be compared across years and states. Figures are for public schools.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Reading scores" subtitle="Average, 0–500 scale" source={SOURCES.naep} table={seriesTable(d.reading, "points")} className="lg:col-span-2">
            <TimeSeriesChart series={d.reading} unit="points" height={280} fromZero={false} markers={[pre]} />
          </ChartCard>
        </div>
      </Section>

      <Section id="proficiency" title="Proficiency" question="What share of students meet NAEP's Proficient benchmark?">
        <Prose>
          <p>
            NAEP Proficient means solid command of challenging grade-level material. It is a higher bar than most states&apos; own definitions of
            grade level, so these shares are lower than state test results.
          </p>
        </Prose>
        <ChartCard title="At or above Proficient" subtitle="Share of public school students" source={SOURCES.naep} table={seriesTable(d.proficient, "percent")}>
          <TimeSeriesChart series={d.proficient} unit="percent" height={280} />
        </ChartCard>
      </Section>

      <Section id="attainment" title="Educational attainment" question="How many adults have finished high school and college?">
        <ChartCard title="Educational attainment" subtitle="Share of adults 25 and over" source={SOURCES.acs} table={seriesTable(d.attainment, "percent")}>
          <TimeSeriesChart series={d.attainment} unit="percent" height={260} />
        </ChartCard>
      </Section>

      <Section id="college" title="College costs" question="How much have tuition prices risen, and how much do Americans owe?">
        <Prose>
          <p>
            The tuition index tracks published prices for college tuition, school fees, and child care, before grants and scholarships. Student
            loans include federal and private loans.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Tuition against all prices" subtitle="Price index, 1980 = 100" source={SOURCES.fred} table={seriesTable(d.tuitionVsPrices, "index")}>
            <TimeSeriesChart series={d.tuitionVsPrices} unit="index" height={280} />
          </ChartCard>
          <ChartCard title="Student loans outstanding" subtitle="Quarterly, nominal dollars" source={SOURCES.fred} table={seriesTable(d.loans, "usd")}>
            <TimeSeriesChart series={d.loans} unit="usd" height={280} />
          </ChartCard>
        </div>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Grade 8 math, most Proficient" subtitle={`States, ${d.states.metrics.find((m) => m.key === "math_8_proficient")?.period ?? ""}`} source={SOURCES.naep} table={rankedTable(d.math8Top, "State", "percent")}>
            <RankedBars items={d.math8Top} unit="percent" />
          </ChartCard>
          <ChartCard title="Grade 8 math, largest declines" subtitle={`States, points lost on the average score, ${d.mathPeriod}`} source={SOURCES.naep} table={rankedTable(d.mathDecline, "State", "points")}>
            <RankedBars items={d.mathDecline} unit="points" slot={2} />
          </ChartCard>
        </div>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Education by race, language, and income is on{" "}
          <Link href="/demographics" className="underline underline-offset-2">
            Demographics
          </Link>
          .{" "}
          <Link href="/datasets" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Browse all datasets
          </Link>
        </p>
      </Section>
    </div>
  );
}
