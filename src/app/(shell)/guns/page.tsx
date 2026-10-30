import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { ChartCard, type ChartSource } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { MeasureChartCard } from "@/components/charts/measure-chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ViewTabs } from "@/components/crime/crime-views";
import { IssueEmpty, IssueHeader } from "@/components/data/issue-layout";
import { CourtMap } from "@/components/guns/court-map";
import { EvidenceMatrix } from "@/components/guns/evidence-matrix";
import { GunViews, type GunView } from "@/components/guns/gun-views";
import { PolicyExplorer, type LawsFile, type StateOutcomes } from "@/components/guns/policy-explorer";
import { GunSelectionProvider } from "@/components/guns/selection";
import { formatValue } from "@/lib/format";
import { loadStatePaths } from "@/lib/geo/state-paths";
import { STATES_51 } from "@/lib/geo/states";
import { COURT_ITEMS } from "@/lib/guns/courts";
import { EVIDENCE_ROWS } from "@/lib/guns/evidence";
import { loadGuns } from "@/lib/guns/data";
import { loadCourtComposition } from "@/lib/people/court";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guns in America | Worldview",
  description:
    "Who owns firearms, what each state's law allows, how firearms are used, and what research finds about gun policy: the Firearm Policy Explorer, RAND's evidence ratings, constitutional rulings, and firearm deaths.",
};

const SOURCE_SPECS = {
  cdc: { label: "CDC NCHS death certificates", href: "/datasets/cdc-violent-deaths" },
  cdcOld: { label: "CDC NCHS injury mortality", href: "/datasets/cdc-injury-mortality" },
  gallup: { label: "Gallup", href: "/datasets/gallup-guns" },
  nics: { label: "FBI NICS", href: "/datasets/fbi-nics" },
  cdcq: { label: "CDC NCHS provisional mortality", href: "/datasets/cdc-quarterly-mortality" },
  pew: { label: "Pew Research Center", href: "/datasets/pew-guns" },
} satisfies Record<string, SourceSpec>;

const CDC_FINAL_2017: ChartSource = {
  label: "CDC NCHS, final mortality tables for 2017",
  href: "https://www.cdc.gov/nchs/data/nvsr/nvsr68/nvsr68_09-508.pdf",
};

const CDC_FINAL_2018: ChartSource = {
  label: "CDC NCHS, final mortality tables for 2018",
  href: "https://www.cdc.gov/nchs/data/nvsr/nvsr69/nvsr69-13-tables-508.pdf",
};

async function loadLaws(): Promise<LawsFile | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public/data/guns/laws.json"), "utf8"));
  } catch {
    return null;
  }
}

// Sitting justices' profile links by surname, for opinion authors.
async function justiceLinks(): Promise<Record<string, string>> {
  const court = await loadCourtComposition().catch(() => null);
  return Object.fromEntries((court?.justices ?? []).map((j) => [j.name.split(" ").at(-1)!, j.href]));
}

export default async function GunsPage() {
  const [d, map, laws, justices] = await Promise.all([loadGuns(), loadStatePaths(), loadLaws(), justiceLinks()]);
  if (!d || !laws) return <IssueEmpty title="Guns" />;
  const h = d.headline;
  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);
  const mortalitySources = [SOURCES.cdcOld, CDC_FINAL_2017, CDC_FINAL_2018, SOURCES.cdc];

  const metric = (key: string) => d.states.metrics.find((m) => m.key === key);
  const outcomes: StateOutcomes = {
    period: metric("firearm_deaths_rate")?.period ?? "",
    values: Object.fromEntries(
      d.states.rows.map((r) => [
        r.abbr,
        {
          all: r.values.firearm_deaths_rate ?? null,
          suicide: r.values.firearm_suicide_rate ?? null,
          homicide: r.values.firearm_homicide_rate ?? null,
        },
      ]),
    ),
  };
  const stateNames = Object.fromEntries(STATES_51.map((s) => [s.abbr, s.name]));
  const latestRuling = [...COURT_ITEMS].filter((i) => i.kind === "ruling").sort((a, b) => b.date.localeCompare(a.date))[0];

  const views: GunView[] = [
    {
      id: "ownership",
      label: "Ownership & commerce",
      kicker: "Who owns guns, how they're bought",
      figure: h.own.point ? formatValue(h.own.point.value, "percent") : "—",
      caption: h.own.point ? `of adults personally own a gun · ${h.own.point.period}` : "Gallup",
      scope: "Gallup trend surveys · Pew Research Center, June 2023 · FBI NICS background checks, 1998 onward",
      content: (
        <ViewTabs
          label="Ownership view"
          tabs={[
            {
              id: "trend",
              label: "Ownership",
              content: (
                <ChartCard
                  title="Personal ownership and household exposure"
                  subtitle="Share of U.S. adults · “gun in the home” includes adults who don't own the gun themselves"
                  source={SOURCES.gallup}
                  table={seriesTable(d.ownership, "percent")}
                >
                  <TimeSeriesChart series={d.ownership} unit="percent" height={300} />
                </ChartCard>
              ),
            },
            {
              id: "owners",
              label: "Who owns",
              content: (
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard
                    title="Who personally owns a gun"
                    subtitle={`Share of each group of U.S. adults · ${d.pewYear ?? ""} survey`}
                    source={SOURCES.pew}
                    table={rankedTable(d.owners, "Group", "percent")}
                  >
                    <RankedBars items={d.owners} unit="percent" slot={1} limit={d.owners.length} />
                  </ChartCard>
                  <ChartCard
                    title="Why owners have a gun"
                    subtitle={`Share of gun owners calling each a major reason · ${d.pewYear ?? ""} survey`}
                    source={SOURCES.pew}
                    table={rankedTable(d.reasons, "Reason", "percent")}
                  >
                    <RankedBars items={d.reasons} unit="percent" slot={2} />
                  </ChartCard>
                </div>
              ),
            },
            {
              id: "checks",
              label: "Background checks",
              content: (
                <div className="space-y-6">
                  <ChartCard
                    title="Firearm background checks each month"
                    subtitle="Checks run through NICS, all transaction types · a check is not a sale"
                    source={SOURCES.nics}
                    table={seriesTable(d.checksMonthly, "checks")}
                  >
                    <TimeSeriesChart series={d.checksMonthly} unit="checks" height={300} markers={[{ x: 2020.2, label: "COVID-19 pandemic" }]} />
                  </ChartCard>
                  <ChartCard
                    title="Background checks by type"
                    subtitle="Annual · permit checks replace point-of-sale checks in some states"
                    source={SOURCES.nics}
                    table={seriesTable(d.checksByType, "checks")}
                  >
                    <TimeSeriesChart series={d.checksByType} unit="checks" height={300} />
                  </ChartCard>
                </div>
              ),
            },
          ]}
        />
      ),
    },
    {
      id: "outcomes",
      label: "Firearm outcomes",
      kicker: "Deaths by intent",
      figure: h.deaths.point ? formatValue(h.deaths.point.value, "deaths") : "—",
      caption: h.deaths.point ? `firearm deaths · ${h.deaths.point.period}` : "CDC NCHS",
      scope: "CDC NCHS death certificates, 1999 onward · newest periods provisional",
      content: (
        <ViewTabs
          label="Outcome view"
          tabs={[
            {
              id: "intent",
              label: "By intent",
              content: (
                <div className="space-y-6">
                  <MeasureChartCard
                    title="Firearm deaths by intent"
                    source={mortalitySources}
                    measures={[
                      { label: "Deaths", subtitle: "Annual counts since 1999", series: d.deaths, unit: "deaths" },
                      { label: "Rate", subtitle: "Deaths per 100,000 residents since 1999", series: d.rates, unit: "per_100k" },
                    ]}
                    height={340}
                    markers={[{ x: 2020.2, label: "COVID-19 pandemic" }]}
                  />
                  <ChartCard
                    title="Every recorded intent"
                    subtitle="Final firearm deaths by intent, 2018 · the latest year with all five intents in one release"
                    source={CDC_FINAL_2018}
                    table={rankedTable(d.intentBreakdown, "Intent", "deaths")}
                  >
                    <RankedBars items={d.intentBreakdown} unit="deaths" slot={1} limit={5} />
                  </ChartCard>
                </div>
              ),
            },
            {
              id: "homicide",
              label: "Homicide",
              content: (
                <div className="space-y-6">
                  <ChartCard
                    title="Homicides committed with a firearm"
                    subtitle="Share of all homicide deaths · annual"
                    source={SOURCES.cdc}
                    table={seriesTable(d.gunShare, "percent")}
                  >
                    <TimeSeriesChart series={d.gunShare} unit="percent" height={260} fromZero={false} />
                  </ChartCard>
                  <p className="text-sm">
                    <a href="/crime?offense=homicide" className="text-red-700 hover:underline dark:text-red-400">
                      Homicide by state, city, and year on Crime →
                    </a>
                  </p>
                </div>
              ),
            },
            {
              id: "age",
              label: "Age & sex",
              content: (
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard
                    title="Firearm death rate by age"
                    subtitle={`All intents, per 100,000 people in each age group · ${d.ageYear ?? "year unavailable"}`}
                    source={d.ageSource === "cdc-quarterly-mortality" ? SOURCES.cdcq : SOURCES.cdcOld}
                    table={rankedTable(d.byAge, "Age", "per_100k")}
                  >
                    <RankedBars items={d.byAge} unit="per_100k" slot={2} />
                  </ChartCard>
                  {d.bySex.length > 0 && (
                    <ChartCard
                      title="Firearm death rate by sex"
                      subtitle={`All intents, per 100,000 people · ${d.ageYear ?? ""}`}
                      source={SOURCES.cdcq}
                      table={rankedTable(d.bySex, "Sex", "per_100k")}
                    >
                      <RankedBars items={d.bySex} unit="per_100k" slot={3} />
                    </ChartCard>
                  )}
                </div>
              ),
            },
            {
              id: "states",
              label: "States",
              content: <StateExplorer metrics={d.states.metrics} rows={d.states.rows} color="#b91c1c" />,
            },
          ]}
        />
      ),
    },
    {
      id: "courts",
      label: "Constitution & courts",
      kicker: "Rulings, statutes, rules",
      figure: latestRuling.title,
      caption: `latest ruling · ${new Date(`${latestRuling.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`,
      scope: `${COURT_ITEMS.length} rulings, federal statutes, and ATF rules, 1791–${latestRuling.date.slice(0, 4)}`,
      content: <CourtMap justices={justices} />,
    },
    {
      id: "research",
      label: "Policy research",
      kicker: "What studies find",
      figure: "171 studies",
      caption: `behind ${EVIDENCE_ROWS.length} policy ratings · RAND, 2026`,
      scope: "RAND, The Science of Gun Policy, 5th ed. (January 2026) · Gallup",
      content: (
        <div className="space-y-6">
          <EvidenceMatrix />
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Preferred direction for gun-sale laws"
              subtitle="Share of U.S. adults · more strict, less strict, or kept as now"
              source={SOURCES.gallup}
              table={seriesTable(d.opinion, "percent")}
            >
              <TimeSeriesChart series={d.opinion} unit="percent" height={260} />
            </ChartCard>
            {d.proposals.length > 0 && (
              <ChartCard
                title="Support for specific bans"
                subtitle="Share of U.S. adults in favor"
                source={SOURCES.gallup}
                table={seriesTable(d.proposals, "percent")}
              >
                <TimeSeriesChart series={d.proposals} unit="percent" height={260} />
              </ChartCard>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <GunSelectionProvider states={STATES_51.map((s) => s.abbr)}>
      <div className="mx-auto max-w-7xl space-y-10">
        <IssueHeader title="Guns in America">
          <p className="mt-4 text-lg leading-7 text-slate-600 dark:text-slate-300">
            Who owns firearms, what the law allows in each state, how firearms are used, and what research finds about
            regulation.
          </p>
        </IssueHeader>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatTile
            compact
            href="#outcomes"
            label="Firearm deaths"
            unit="deaths"
            value={h.deaths.point?.value ?? null}
            tag={h.deaths.point ? { label: h.deaths.point.period, latest: true } : undefined}
            spark={h.deaths.spark}
          />
          <StatTile
            compact
            href="#outcomes"
            label="Share that were suicides"
            unit="percent"
            value={h.suicideShare?.value ?? null}
            tag={h.suicideShare ? { label: h.suicideShare.period, latest: true } : undefined}
          />
          <StatTile
            compact
            href="#ownership"
            label="Personally own a gun"
            unit="percent"
            value={h.own.point?.value ?? null}
            tag={h.own.point ? { label: `${h.own.point.period} survey`, latest: true } : undefined}
            spark={h.own.spark}
          />
          <StatTile
            compact
            href="#ownership"
            label="Background checks"
            unit="checks"
            value={h.checks.point?.value ?? null}
            tag={h.checks.point ? { label: h.checks.point.period, latest: true } : undefined}
            spark={h.checks.spark}
          />
          <StatTile
            compact
            href="#research"
            label="Want stricter gun-sale laws"
            unit="percent"
            value={h.strict.point?.value ?? null}
            tag={h.strict.point ? { label: `${h.strict.point.period} survey`, latest: true } : undefined}
            spark={h.strict.spark}
          />
        </div>

        <section id="explorer" className="scroll-mt-28 space-y-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-red-700 uppercase dark:text-red-400">01 · Firearm Policy Explorer</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              What the law allows, state by state
            </h2>
          </div>
          <PolicyExplorer map={map} laws={laws} outcomes={outcomes} stateNames={stateNames} />
        </section>

        <section className="space-y-5 border-t border-slate-200 pt-8 dark:border-slate-800">
          <GunViews views={views} />
        </section>
      </div>
    </GunSelectionProvider>
  );
}
