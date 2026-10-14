import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { SectionNav } from "@/components/data/section-nav";
import { loadFamily } from "@/lib/family/data";
import { pctChange } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Family | Worldview",
  description:
    "Family in the United States with data: fertility and births since 1909, marriage and divorce, age at first marriage, births to unmarried mothers, household types, and the families children live in, nationally and by state.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["fertility", "Fertility"],
  ["marriage", "Marriage"],
  ["children", "Children"],
  ["households", "Households"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  nchs: { label: "NCHS births and fertility rates", href: "/datasets/cdc-natality" },
  wb: { label: "World Bank, total fertility rate", href: "/datasets/world-bank-fertility" },
  acs: { label: "American Community Survey 1-year", href: "/datasets/census-acs1-family" },
  pep: { label: "Census population estimates", href: "/datasets/census-pep" },
};

const USES: Record<string, string> = {
  "cdc-natality": "births and the general fertility rate since 1909",
  "world-bank-fertility": "births per woman in the U.S. and other countries since 1960",
  "census-acs1-family": "marriage, divorce, recent births, households, and children's families, nationally and by state since 2008",
  "census-pep": "births each year by state",
};

const REPLACEMENT = { value: 2.1, label: "Replacement level (2.1)" };

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

export default async function FamilyPage() {
  const d = await loadFamily();
  if (!d) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Family</h1>
        <p className="mt-4 text-slate-500">No family data is loaded yet.</p>
      </div>
    );
  }
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">Family</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
          How many children Americans have, when and whether they marry, and the households children grow up in — nationally back to
          1909 and by state since 2008.
        </p>
      </header>

      <SectionNav sections={SECTIONS} />

      {/* ------------------------------------------------------------ Overview */}
      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Births per woman"
            unit="per_woman"
            value={h.tfr.point?.value ?? null}
            period={h.tfr.point?.period}
            note="Total fertility rate · replacement is about 2.1"
            spark={h.tfr.spark}
          />
          <StatTile
            label="Births per year"
            unit="births"
            value={h.births.point?.value ?? null}
            period={h.births.point?.period}
            note="12 months to July 1"
            change={pctChange(h.births.point?.value, h.births.prior?.value)}
            compareLabel={h.births.prior ? `vs ${h.births.prior.period}` : undefined}
            spark={h.births.spark}
          />
          <StatTile
            label="Marriage rate"
            unit="per_1000"
            value={h.marriage.point?.value ?? null}
            period={h.marriage.point?.period}
            note="Women married in the past year, per 1,000 women 15+"
            spark={h.marriage.spark}
          />
          <StatTile
            label="Children with married parents"
            unit="percent"
            value={h.kids.point?.value ?? null}
            period={h.kids.point?.period}
            note="Own children under 18"
            spark={h.kids.spark}
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

      {/* ----------------------------------------------------------- Fertility */}
      <Section id="fertility" title="Fertility and births" question="How many children are Americans having, and how does that compare with other countries?">
        <Prose>
          <p>
            The total fertility rate is how many children a woman would have over her life at today&apos;s birth rates by age. About 2.1 keeps a
            population steady without migration. The general fertility rate counts births per 1,000 women aged 15–44 in a single year.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Births per woman" subtitle="Total fertility rate, since 1960" source={SOURCES.wb} table={seriesTable(d.tfrCompare, "per_woman")}>
            <TimeSeriesChart series={d.tfrCompare} unit="per_woman" height={280} reference={REPLACEMENT} />
          </ChartCard>
          <ChartCard title="Births per woman by country" subtitle={d.tfrYear ?? ""} source={SOURCES.wb} table={rankedTable(d.tfrRanking, "Country", "per_woman")}>
            <RankedBars items={d.tfrRanking} unit="per_woman" />
          </ChartCard>
          <ChartCard title="General fertility rate since 1909" subtitle="Births per 1,000 women aged 15–44" source={SOURCES.nchs} table={seriesTable(d.gfr, "per_1000")}>
            <TimeSeriesChart series={d.gfr} unit="per_1000" height={280} />
          </ChartCard>
          <ChartCard title="Births per year" subtitle="United States" source={SOURCES.nchs} table={seriesTable(d.births, "births")}>
            <TimeSeriesChart series={d.births} unit="births" height={280} endLabels={false} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Marriage */}
      <Section id="marriage" title="Marriage and divorce" question="Are Americans marrying less, later, and divorcing less?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Marriage and divorce rates" subtitle="Per 1,000 women 15 and over, past 12 months" source={SOURCES.acs} table={seriesTable(d.marriageRates, "per_1000")}>
            <TimeSeriesChart series={d.marriageRates} unit="per_1000" height={260} />
          </ChartCard>
          <ChartCard title="Median age at first marriage" subtitle="Years" source={SOURCES.acs} table={seriesTable(d.firstMarriage, "years")}>
            <TimeSeriesChart series={d.firstMarriage} unit="years" height={260} fromZero={false} />
          </ChartCard>
          <ChartCard
            title="Marital status"
            subtitle="Share of people 15 and over"
            source={SOURCES.acs}
            table={seriesTable(d.maritalStatus, "percent")}
            className="lg:col-span-2"
          >
            <TimeSeriesChart series={d.maritalStatus} unit="percent" height={260} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Children */}
      <Section id="children" title="Children's families" question="What share of children live with married parents, and how many births are to unmarried mothers?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Who children live with" subtitle="Own children under 18, by family type" source={SOURCES.acs} table={seriesTable(d.children, "percent")}>
            <TimeSeriesChart series={d.children} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Births to unmarried mothers" subtitle="Share of women with a birth in the past 12 months" source={SOURCES.acs} table={seriesTable(d.unmarried, "percent")}>
            <TimeSeriesChart series={d.unmarried} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Most children with married parents" subtitle="States" source={SOURCES.acs} table={rankedTable(d.marriedKidsHigh, "State", "percent")}>
            <RankedBars items={d.marriedKidsHigh} unit="percent" />
          </ChartCard>
          <ChartCard title="Fewest children with married parents" subtitle="States" source={SOURCES.acs} table={rankedTable(d.marriedKidsLow, "State", "percent")}>
            <RankedBars items={d.marriedKidsLow} unit="percent" slot={2} />
          </ChartCard>
        </div>
      </Section>

      {/* ---------------------------------------------------------- Households */}
      <Section id="households" title="Households" question="How are American households made up?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Household types" subtitle="Share of households" source={SOURCES.acs} table={seriesTable(d.households, "percent")}>
            <TimeSeriesChart series={d.households} unit="percent" height={260} />
          </ChartCard>
          <ChartCard title="Highest birth rates" subtitle="Births per 1,000 residents · states" source={SOURCES.pep} table={rankedTable(d.birthRateTop, "State", "per_1000")}>
            <RankedBars items={d.birthRateTop} unit="per_1000" slot={3} />
          </ChartCard>
        </div>
      </Section>

      {/* -------------------------------------------------------------- States */}
      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      {/* ------------------------------------------------------------- Sources */}
      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Abortion figures are on{" "}
          <Link href="/abortion" className="underline underline-offset-2">
            Abortion
          </Link>
          ; population by age and sex on{" "}
          <Link href="/demographics?dim=age" className="underline underline-offset-2">
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
