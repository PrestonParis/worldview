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
import { loadGuns } from "@/lib/guns/data";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guns | Worldview",
  description:
    "Guns in the United States with data: firearm deaths by suicide and homicide since 1999, deaths by age, the share of homicides committed with a gun, gun ownership and opinion on gun laws since 1959, and every state.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["deaths", "Deaths"],
  ["who", "Who dies"],
  ["ownership", "Ownership"],
  ["opinion", "Opinion"],
  ["states", "States"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  cdc: { label: "CDC NCHS death certificates", href: "/datasets/cdc-violent-deaths" },
  cdcOld: { label: "CDC NCHS injury mortality", href: "/datasets/cdc-injury-mortality" },
  gallup: { label: "Gallup", href: "/datasets/gallup-guns" },
};

const USES: Record<string, string> = {
  "cdc-violent-deaths": "firearm deaths, suicides, and homicides since 2019, nationally and by state",
  "cdc-injury-mortality": "firearm deaths by intent and age, 1999–2016",
  "gallup-guns": "gun ownership and opinion on gun laws",
};

export default async function GunsPage() {
  const d = await loadGuns();
  if (!d) return <IssueEmpty title="Guns" />;
  const h = d.headline;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="Guns">
        How many Americans die from gunshot wounds and how, who owns guns, and what Americans think gun laws should be — from death certificates and
        six decades of polling.
      </IssueHeader>

      <ChartCard title="Firearm deaths" subtitle="By intent, since 1999" source={SOURCES.cdc} table={seriesTable(d.deaths, "deaths")}>
        <TimeSeriesChart series={d.deaths} unit="deaths" height={340} gapOver={1} />
      </ChartCard>

      <SectionNav sections={SECTIONS} />

      <section id="overview" className="scroll-mt-28 space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Firearm deaths" unit="deaths" value={h.deaths.point?.value ?? null} period={h.deaths.point?.period} note="All intents" spark={h.deaths.spark} />
          <StatTile label="Suicides" unit="percent" value={h.suicideShare?.value ?? null} period={h.suicideShare?.period} note="Share of firearm deaths" />
          <StatTile label="Gun in the home" unit="percent" value={h.home.point?.value ?? null} period={h.home.point?.period} note="Adults, Gallup" spark={h.home.spark} />
          <StatTile label="Want stricter gun laws" unit="percent" value={h.strict.point?.value ?? null} period={h.strict.point?.period} note="Laws on gun sales, Gallup" spark={h.strict.spark} />
        </div>
        <KeyFindings findings={d.findings} />
      </section>

      <Section id="deaths" title="Firearm deaths" question="How many Americans die from guns, and how many of those deaths are suicides or homicides?">
        <Prose>
          <p>
            Deaths are counted from death certificates by the cause the medical examiner or coroner records. Through 2016 they come from CDC&apos;s final
            injury mortality tables; from 2019 they come from CDC&apos;s injury dashboard, with the latest year provisional. CDC publishes neither series
            for 2017 and 2018, so the lines break there. Rates are deaths per 100,000 residents.
          </p>
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Firearm death rate" subtitle="Per 100,000 residents" source={SOURCES.cdc} table={seriesTable(d.rates, "per_100k")}>
            <TimeSeriesChart series={d.rates} unit="per_100k" height={280} gapOver={1} />
          </ChartCard>
          <ChartCard title="Homicides committed with a gun" subtitle="Share of all homicides" source={SOURCES.cdc} table={seriesTable(d.gunShare, "percent")}>
            <TimeSeriesChart series={d.gunShare} unit="percent" height={240} fromZero={false} />
          </ChartCard>
          <ChartCard title="Firearm deaths by intent" subtitle={d.intentYear ?? ""} source={SOURCES.cdcOld} table={rankedTable(d.intentItems, "Intent", "deaths")}>
            <RankedBars items={d.intentItems} unit="deaths" />
          </ChartCard>
        </div>
      </Section>

      <Section id="who" title="Who dies" question="How does the firearm death rate vary with age?">
        <ChartCard title="Firearm death rate by age" subtitle={`All intents, per 100,000 people in each age group, ${d.ageYear ?? ""}`} source={SOURCES.cdcOld} table={rankedTable(d.byAge, "Age", "per_100k")}>
          <RankedBars items={d.byAge} unit="per_100k" slot={2} />
        </ChartCard>
      </Section>

      <Section id="ownership" title="Gun ownership" question="How many Americans own a gun or live with one?">
        <Prose>
          <p>Ownership is self-reported in Gallup&apos;s annual crime poll, so it counts households and adults, not the number of guns.</p>
        </Prose>
        <ChartCard title="Gun ownership" subtitle="Share of adults" source={SOURCES.gallup} table={seriesTable(d.ownership, "percent")}>
          <TimeSeriesChart series={d.ownership} unit="percent" height={280} />
        </ChartCard>
      </Section>

      <Section id="opinion" title="Opinion on gun laws" question="Do Americans want stricter or looser gun laws?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Laws covering the sale of firearms should be…" subtitle="Share of adults" source={SOURCES.gallup} table={seriesTable(d.laws, "percent")}>
            <TimeSeriesChart series={d.laws} unit="percent" height={280} />
          </ChartCard>
          <ChartCard title="Ban possession of handguns except by police" subtitle="Share in favor" source={SOURCES.gallup} table={seriesTable(d.bans, "percent")}>
            <TimeSeriesChart series={d.bans} unit="percent" height={280} />
          </ChartCard>
        </div>
      </Section>

      <Section id="states" title="Across the states" question="How do the states compare? Pick a measure to map it; sort the table by any column.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Highest firearm death rates" subtitle={`States, per 100,000, ${d.states.metrics[0]?.period ?? ""}`} source={SOURCES.cdc} table={rankedTable(d.rateHigh, "State", "per_100k")}>
            <RankedBars items={d.rateHigh} unit="per_100k" slot={2} />
          </ChartCard>
          <ChartCard title="Lowest firearm death rates" subtitle={`States, per 100,000, ${d.states.metrics[0]?.period ?? ""}`} source={SOURCES.cdc} table={rankedTable(d.rateLow, "State", "per_100k")}>
            <RankedBars items={d.rateLow} unit="per_100k" />
          </ChartCard>
        </div>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </Section>

      <Section id="sources" title="Sources and methods" question="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={d.datasets} uses={USES} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Murders and other crimes reported to police are on{" "}
          <Link href="/crime" className="underline underline-offset-2">
            Crime
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
