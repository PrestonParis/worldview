import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { MeasureChartCard } from "@/components/charts/measure-chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueEmpty, IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { loadGuns } from "@/lib/guns/data";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guns | Worldview",
  description:
    "Guns in the United States with data: firearm deaths by suicide and homicide since 1999, deaths by age, the share of homicides committed with a gun, gun ownership since 1959, and every state.",
};

const SECTIONS = [
  ["deaths", "Deaths"],
  ["who", "Who dies"],
  ["ownership", "Ownership"],
  ["states", "States"],
] as const;

const SOURCE_SPECS = {
  cdc: { label: "CDC NCHS death certificates", href: "/datasets/cdc-violent-deaths" },
  cdcOld: { label: "CDC NCHS injury mortality", href: "/datasets/cdc-injury-mortality" },
  gallup: { label: "Gallup", href: "/datasets/gallup-guns" },
} satisfies Record<string, SourceSpec>;

export default async function GunsPage() {
  const d = await loadGuns();
  if (!d) return <IssueEmpty title="Guns" />;
  const h = d.headline;

  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  return (
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[minmax(0,1fr)_10rem] lg:gap-10">
      <aside className="contents lg:order-2 lg:block">
        <SectionNav sections={SECTIONS} side />
      </aside>
      <div className="min-w-0 space-y-14 pt-8 lg:pt-0">
        <IssueHeader title="Guns" />

        <MeasureChartCard
          title="Firearm deaths"
          source={SOURCES.cdc}
          measures={[
            { label: "Deaths", subtitle: "By intent, since 1999", series: d.deaths, unit: "deaths" },
            {
              label: "Rate",
              subtitle: "By intent, per 100,000 residents, since 1999",
              series: d.rates,
              unit: "per_100k",
            },
          ]}
          height={340}
          gapOver={1}
          markers={[{ x: 2020.2, label: "COVID-19 pandemic" }]}
        />

        <Section id="deaths" title="Firearm deaths" question="How many Americans die from guns, and how?">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Firearm deaths"
              unit="deaths"
              value={h.deaths.point?.value ?? null}
              period={h.deaths.point?.period}
              note="All intents"
              spark={h.deaths.spark}
            />
            <StatTile
              label="Suicides"
              unit="percent"
              value={h.suicideShare?.value ?? null}
              period={h.suicideShare?.period}
              note="Share of firearm deaths"
            />
          </div>
          <Prose>
            <p>
              Deaths are counted from death certificates by the cause the medical examiner or coroner records. Through
              2016 they come from CDC&apos;s final injury mortality tables; from 2019 they come from CDC&apos;s injury
              dashboard, with the latest year provisional. CDC publishes neither series for 2017 and 2018, so the lines
              break there. Rates are deaths per 100,000 residents.
            </p>
          </Prose>
          <ChartCard
            title="Homicides committed with a gun"
            subtitle="Share of all homicides"
            source={SOURCES.cdc}
            table={seriesTable(d.gunShare, "percent")}
          >
            <TimeSeriesChart series={d.gunShare} unit="percent" height={240} fromZero={false} />
          </ChartCard>
        </Section>

        <Section id="who" title="Who dies" question="How does the firearm death rate vary with age?">
          <ChartCard
            title="Firearm death rate by age"
            subtitle={`All intents, per 100,000 people in each age group, ${d.ageYear ?? ""}`}
            source={SOURCES.cdcOld}
            table={rankedTable(d.byAge, "Age", "per_100k")}
          >
            <RankedBars items={d.byAge} unit="per_100k" slot={2} />
          </ChartCard>
        </Section>

        <Section id="ownership" title="Gun ownership" question="How many Americans own a gun or live with one?">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Gun in the home"
              unit="percent"
              value={h.home.point?.value ?? null}
              period={h.home.point?.period}
              note="Adults, Gallup"
              spark={h.home.spark}
            />
            <StatTile
              label="Want stricter gun laws"
              unit="percent"
              value={h.strict.point?.value ?? null}
              period={h.strict.point?.period}
              note="Laws on gun sales, Gallup"
              spark={h.strict.spark}
            />
          </div>
          <Prose>
            <p>
              Ownership is self-reported in Gallup&apos;s annual crime poll, so it counts households and adults, not the
              number of guns.
            </p>
          </Prose>
          <ChartCard
            title="Gun ownership"
            subtitle="Share of adults"
            source={SOURCES.gallup}
            table={seriesTable(d.ownership, "percent")}
          >
            <TimeSeriesChart series={d.ownership} unit="percent" height={280} />
          </ChartCard>
        </Section>

        <Section id="states" title="Across the states" question="How do the states compare?">
          <StateExplorer metrics={d.states.metrics} rows={d.states.rows} color="#b91c1c" />
        </Section>
      </div>
    </div>
  );
}
