import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { SectionNav } from "@/components/data/section-nav";
import { loadSpending } from "@/lib/spending/data";
import { IssueHeader } from "@/components/data/issue-layout";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Government Spending | Worldview",
  description:
    "Federal spending with data: where the money goes by function and program, receipts and deficits since 1901, the national debt and interest costs, benefit programs, grants to states, improper payments, and federal awards by state and congressional district.",
};

const SECTIONS = [
  ["where", "Where it goes"],
  ["trends", "Over time"],
  ["debt", "Debt & interest"],
  ["this-year", "This year"],
  ["programs", "Programs"],
  ["states", "States"],
] as const;

const SOURCE_SPECS = {
  omb: { label: "OMB Historical Tables", href: "/datasets/omb-historical-tables" },
  treasury: { label: "Treasury Fiscal Data", href: "/datasets/treasury-fiscal-data" },
  accuracy: { label: "PaymentAccuracy.gov", href: "/datasets/payment-accuracy" },
  awards: { label: "USAspending.gov", href: "/datasets/usaspending" },
} satisfies Record<string, SourceSpec>;


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

export default async function SpendingPage() {
  const d = await loadSpending();
  if (!d) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Government Spending</h1>
        <p className="mt-4 text-slate-500">No budget data is loaded yet.</p>
      </div>
    );
  }
  const h = d.headline;

  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Government Spending" />

      <ChartCard title="Receipts and outlays" subtitle="Share of GDP, since 1930" source={SOURCES.omb} table={seriesTable(d.balance, "percent")}>
        <TimeSeriesChart
          series={d.balance}
          unit="percent"
          height={340}
          markers={[
            { x: 2007, to: 2009.5, label: "Financial crisis" },
            { x: 2020, label: "Pandemic relief" },
          ]}
        />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      {/* -------------------------------------------------------- Where it goes */}
      <Section id="where" title="Where the money goes" question={`What did the federal government spend its money on in ${d.fy}?`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Federal spending"
            unit="usd"
            value={h.outlays.value}
            period={h.fy}
            extra={h.outlays.share !== null ? ` · ${h.outlays.share.toFixed(1)}% of GDP` : undefined}
            change={h.outlays.change}
            compareLabel="vs prior year"
            spark={h.outlays.spark}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Spending by budget function" subtitle={`${d.fy} · outlays`} source={SOURCES.omb} table={rankedTable(d.byFunction, "Function", "usd")}>
            <RankedBars items={d.byFunction} unit="usd" limit={d.byFunction.length} />
          </ChartCard>
          <ChartCard title="Largest benefit programs" subtitle={`${d.fy} · payments for individuals`} source={SOURCES.omb} table={rankedTable(d.byProgram, "Program", "usd")}>
            <RankedBars items={d.byProgram} unit="usd" slot={3} limit={d.byProgram.length} />
          </ChartCard>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Budget functions group spending by purpose regardless of agency. Refundable tax credits count only the part paid out beyond the
          tax a family owes.
        </p>
      </Section>

      {/* ------------------------------------------------------------ Over time */}
      <Section id="trends" title="Spending, taxes, and deficits over time" question="How have federal spending and revenue changed relative to the economy?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Deficit"
            unit="usd"
            value={h.deficit.value}
            period={h.fy}
            extra={h.deficit.share !== null ? ` · ${h.deficit.share.toFixed(1)}% of GDP` : undefined}
            note="Spending minus receipts"
            spark={h.deficit.spark}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Deficit" subtitle="Share of GDP · negative is a surplus" source={SOURCES.omb} table={seriesTable(d.deficitShare, "percent")}>
            <TimeSeriesChart series={d.deficitShare} unit="percent" height={280} fromZero={false} reference={{ value: 0, label: "Balanced" }} />
          </ChartCard>
          <ChartCard title="Social Security, defense, and interest" subtitle="Share of GDP, since 1940" source={SOURCES.omb} table={seriesTable(d.bigThree, "percent")}>
            <TimeSeriesChart series={d.bigThree} unit="percent" height={280} />
          </ChartCard>
          <ChartCard title="Healthcare and the safety net" subtitle="Share of GDP, since 1940" source={SOURCES.omb} table={seriesTable(d.healthSeries, "percent")}>
            <TimeSeriesChart series={d.healthSeries} unit="percent" height={280} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------- Debt & interest */}
      <Section id="debt" title="Debt and interest" question="How large is the national debt, and what does it cost to carry?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="National debt"
            unit="usd"
            value={h.debt.point?.value ?? null}
            period={h.debt.asOf ? `as of ${new Date(`${h.debt.asOf}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : undefined}
            note="Total public debt outstanding"
            spark={h.debt.spark}
          />
          <StatTile label="Interest on the debt" unit="usd" value={h.interest.value} period={h.fy} note="Net interest outlays" spark={h.interest.spark} />
        </div>
        <Prose>
          <p>
            Debt held by the public is what the government owes to investors, including the Federal Reserve and foreign governments. Gross
            debt adds what the Treasury owes its own trust funds, such as Social Security&apos;s.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Federal debt" subtitle="Share of GDP at the end of each fiscal year, since 1940" source={SOURCES.omb} table={seriesTable(d.debtShare, "percent")}>
            <TimeSeriesChart series={d.debtShare} unit="percent" height={280} />
          </ChartCard>
          <ChartCard title="Debt outstanding" subtitle="End of each month, since 1993" source={SOURCES.treasury} table={seriesTable(d.debtMonthly, "usd")}>
            <TimeSeriesChart series={d.debtMonthly} unit="usd" height={280} endLabels={false} />
          </ChartCard>
          <ChartCard title="Interest, defense, and Medicaid" subtitle="Outlays, nominal dollars, since 2000" source={SOURCES.omb} table={seriesTable(d.interestVsDefense, "usd")}>
            <TimeSeriesChart series={d.interestVsDefense} unit="usd" height={280} endLabels={false} />
          </ChartCard>
          <ChartCard title="Interest rate on the debt" subtitle="Average rate on interest-bearing Treasury debt, monthly" source={SOURCES.treasury} table={seriesTable(d.interestRate, "percent")}>
            <TimeSeriesChart series={d.interestRate} unit="percent" height={280} />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------------ This year */}
      <Section id="this-year" title="This fiscal year" question="How is the current year's budget tracking, month by month?">
        {d.ytd && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Deficit so far" unit="usd" value={d.ytd.deficit} period={`${d.ytd.fy} through ${d.ytd.through}`} note={`${d.ytd.deficitLabel}, against ${d.ytd.priorLabel} over the same months of ${d.ytd.prior}`} />
            <StatTile label="Receipts so far" unit="usd" value={d.ytd.receipts} period={`${d.ytd.fy} through ${d.ytd.through}`} />
            <StatTile label="Outlays so far" unit="usd" value={d.ytd.outlays} period={`${d.ytd.fy} through ${d.ytd.through}`} />
          </div>
        )}
        <ChartCard title="Monthly receipts and outlays" subtitle="Last 36 months" source={SOURCES.treasury} table={seriesTable(d.monthly, "usd")}>
          <TimeSeriesChart series={d.monthly} unit="usd" height={280} endLabels={false} />
        </ChartCard>
      </Section>

      {/* ------------------------------------------------------------- Programs */}
      <Section id="programs" title="Grants and payment accuracy" question="How much flows through state governments, and how much is paid in error?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Grants to state and local governments" subtitle="Nominal dollars, since 1980" source={SOURCES.omb} table={seriesTable(d.grants, "usd")}>
            <TimeSeriesChart series={d.grants} type="column" unit="usd" height={280} />
          </ChartCard>
          <ChartCard title="Improper payments" subtitle="Share of outlays in programs prone to payment errors" source={SOURCES.accuracy} table={seriesTable(d.improper, "percent")}>
            <TimeSeriesChart series={d.improper} type="column" unit="percent" height={280} />
          </ChartCard>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Improper payments include overpayments, underpayments, and payments made without required documentation even when the amount was
          right.
        </p>
      </Section>

      {/* --------------------------------------------------------------- States */}
      <Section id="states" title="Where federal money lands" question="How much federal money goes to each state and district?">
        <Prose>
          <p>
            Awards are counted by place of performance as recorded on USAspending.gov. Grants mostly go to state and local governments;
            contracts follow where the work is done, so districts with large defense or healthcare contractors rank high. Direct payments
            are recorded where USAspending places the payment, which puts very large totals in a few states.
          </p>
        </Prose>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} initial="federal_grants_per_capita" />
        <ChartCard
          title="Federal contracts by congressional district"
          subtitle={`${d.awardYear} · largest 15, by where the work is performed`}
          source={SOURCES.awards}
          table={rankedTable(d.topDistricts, "District", "usd")}
        >
          <RankedBars items={d.topDistricts} unit="usd" limit={d.topDistricts.length} slot={3} />
        </ChartCard>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your own district&apos;s representatives are on{" "}
          <Link href="/my-government" className="underline underline-offset-2">
            My Government
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
