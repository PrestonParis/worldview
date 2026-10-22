import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueEmpty, IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { loadEducation } from "@/lib/education/data";
import { formatPeriod } from "@/lib/format";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Education | Worldview",
  description:
    "Education in the United States with data: NAEP math and reading scores and proficiency since the 1990s, results by state, educational attainment, tuition prices, and student debt.",
};

const SECTIONS = [
  ["scores", "Test scores"],
  ["proficiency", "Proficiency"],
  ["attainment", "Attainment"],
  ["college", "College costs"],
  ["states", "States"],
] as const;

const SOURCE_SPECS = {
  naep: { label: "NAEP (Nation's Report Card)", href: "/datasets/naep" },
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-social" },
  fred: { label: "BLS and Federal Reserve via FRED", href: "/datasets/fred-education", by: "Bureau of Labor Statistics and Federal Reserve, via FRED" },
} satisfies Record<string, SourceSpec>;

const pre = { x: 2019, label: "Last test before the pandemic" };

export default async function EducationPage() {
  const d = await loadEducation();
  if (!d) return <IssueEmpty title="Education" />;
  const h = d.headline;

  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Education" />

      <ChartCard title="Math scores" subtitle="Average NAEP score, 0–500 scale" source={SOURCES.naep} table={seriesTable(d.math, "points")}>
        <TimeSeriesChart series={d.math} unit="points" height={340} fromZero={false} markers={[pre]} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Grade 8 math, Proficient" unit="percent" value={h.math8.point?.value ?? null} period={h.math8.point?.period} note="At or above NAEP Proficient, public schools" spark={h.math8.spark} />
          <StatTile label="Grade 4 reading, Proficient" unit="percent" value={h.reading4.point?.value ?? null} period={h.reading4.point?.period} note="At or above NAEP Proficient, public schools" spark={h.reading4.spark} />
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Bachelor's degree or more" unit="percent" value={h.ba.point?.value ?? null} period={h.ba.point?.period} note="Adults 25 and over" spark={h.ba.spark} />
        </div>
        <ChartCard title="Educational attainment" subtitle="Share of adults 25 and over" source={SOURCES.acs} table={seriesTable(d.attainment, "percent")}>
          <TimeSeriesChart series={d.attainment} unit="percent" height={260} />
        </ChartCard>
      </Section>

      <Section id="college" title="College costs" question="How much have tuition prices risen, and how much do Americans owe?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Student loans owed" unit="usd" value={h.loans.point?.value ?? null} period={h.loans.point ? formatPeriod(h.loans.point.period) : undefined} note="Outstanding, end of quarter" spark={h.loans.spark} />
        </div>
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

      <Section id="states" title="Across the states" question="How do the states compare?">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>
    </div>
  );
}
