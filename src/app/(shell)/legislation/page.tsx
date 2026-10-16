import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard, type TableView } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import { SortableTable } from "@/components/data/sortable-table";
import { DatasetList } from "@/components/data/dataset-list";
import { StatusPill } from "@/components/legislation/bill-status";
import { DataFreshness } from "@/components/legislation/data-freshness";
import { IdeologyHistogram, RollCallList } from "@/components/legislation/overview-charts";
import { datasetCoverage, listDatasets } from "@/lib/db/stats";
import { formatValue } from "@/lib/format";
import { loadLegislation } from "@/lib/legislation/overview";
import { FeatureList } from "@/components/ui/feature-list";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Legislation & Courts | Worldview",
  description:
    "Congress, the Supreme Court, and the executive in numbers: bills and roll-call votes, party polarization since 1977, every Supreme Court decision since 1946, and executive orders.",
};

const SECTIONS = [
  ["congress", "Congress"],
  ["polarization", "Polarization"],
  ["court", "Supreme Court"],
  ["executive", "Executive orders"],
  ["sources", "Sources"],
] as const;

const SOURCES = {
  bills: { label: "Congress.gov", href: "/datasets/congress-bills" },
  votes: { label: "Congress.gov roll-call votes", href: "/datasets/congress-votes" },
  voteview: { label: "Voteview DW-NOMINATE", href: "/datasets/voteview" },
  scdb: { label: "The Supreme Court Database", href: "/datasets/scdb" },
  fr: { label: "Federal Register", href: "/datasets/federal-register" },
};

const DATASET_SLUGS = ["congress-bills", "congress-votes", "voteview", "scdb", "federal-register"];

const shortDate = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

function seriesTable(series: Series[], unit: string): TableView {
  const xs = [...new Map(series.flatMap((s) => s.points.map((p) => [p.x, p.label] as const))).entries()].sort((a, b) => b[0] - a[0]);
  const maps = series.map((s) => new Map(s.points.map((p) => [p.x, p.value])));
  return {
    columns: ["Period", ...series.map((s) => s.label)],
    rows: xs.map(([x, label]) => [label, ...maps.map((m) => formatValue(m.get(x), unit))]),
  };
}

function rankedTable(items: RankedItem[], label: string, unit: string): TableView {
  return { columns: [label, "Value", ""], rows: items.map((i) => [i.label, formatValue(i.value, unit), i.note ?? ""]) };
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export default async function LegislationPage() {
  const [{ congress, polarization, court, executive }, datasets] = await Promise.all([
    loadLegislation(),
    listDatasets().then((all) => all.filter((d) => DATASET_SLUGS.includes(d.slug))),
  ]);
  const coverage = await datasetCoverage(datasets.map((d) => d.slug));
  const gapNow = polarization.houseGapNow;
  const gapFirst = polarization.houseGapFirst;

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl text-slate-950 dark:text-white">Legislation &amp; Courts</h1>
        <FeatureList
          className="mt-4"
          items={[
            "Bills and roll-call votes in Congress",
            "How far apart the parties vote",
            "Every Supreme Court decision since 1946",
            "Presidential executive orders",
          ]}
        />
        <DataFreshness sources={["congress-bills", "congress-votes"]} className="mt-3" />
      </header>

      <ChartCard
        title="How far apart the parties vote"
        subtitle="Republican average minus Democratic average ideology score, per Congress"
        source={SOURCES.voteview}
        table={seriesTable(polarization.gap, "score")}
      >
        <TimeSeriesChart series={polarization.gap} unit="score" height={320} endLabels={false} />
      </ChartCard>

      <nav aria-label="Sections" className="sticky top-14 z-10 -mx-4 sm:-mx-8 overflow-x-auto border-y border-slate-100 bg-white/90 px-4 sm:px-8 py-2 backdrop-blur dark:border-slate-900 dark:bg-slate-950/90">
        <ul className="flex gap-1 text-sm whitespace-nowrap">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="rounded-md px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {congress.partyLineShare !== null && (
          <StatTile
            label="Roll calls decided on party lines"
            unit="percent"
            value={congress.partyLineShare * 100}
            period={`${congress.rollCallCount} roll calls · ${shortDate(congress.rollCallSpan?.first ?? null)} – ${shortDate(congress.rollCallSpan?.last ?? null)}`}
          />
        )}
        {gapNow && (
          <StatTile
            label="Ideological gap between the parties, House"
            unit="score"
            value={gapNow.value}
            period={polarization.latestLabel}
            change={gapFirst ? ((gapNow.value - gapFirst.value) / gapFirst.value) * 100 : null}
            compareLabel={gapFirst ? `vs ${gapFirst.label}` : undefined}
            spark={polarization.gap[0].points.map((p) => p.value)}
          />
        )}
        {executive.current && (
          <StatTile
            label="Executive orders this term"
            unit="count"
            value={executive.current.count}
            period={`${executive.current.president} · since ${shortDate(executive.current.since)}`}
          />
        )}
        {court.stats && (
          <>
            <StatTile label="Supreme Court decisions" unit="count" value={court.stats.decisions} period={`${court.stats.term} term`} spark={court.decisions[0].points.slice(-20).map((p) => p.value)} />
            <StatTile
              label="Decided unanimously"
              unit="percent"
              value={court.stats.unanimousShare}
              period={`${court.stats.term} term · ${formatValue(court.stats.decadeUnanimousShare, "percent")} over the last 10 terms`}
            />
            <StatTile
              label="Decided 5–4"
              unit="percent"
              value={court.stats.closeShare}
              period={`${court.stats.term} term · ${formatValue(court.stats.decadeCloseShare, "percent")} over the last 10 terms`}
            />
          </>
        )}
      </div>

      <Section
        id="congress"
        title="Congress"
        intro="A roll call is a recorded vote where every member's position is listed. It counts as a party-line vote when most Democrats and most Republicans voted on opposite sides."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ChartCard title="Recent roll-call votes" subtitle="Yeas and nays by party · bar filled = share voting yea" source={SOURCES.votes}>
            <RollCallList rollCalls={congress.rollCalls} />
          </ChartCard>
          <ChartCard title="Latest bills" subtitle={`${congress.billCount.toLocaleString("en-US")} bills tracked`} source={SOURCES.bills}>
            {congress.latestBills.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {congress.latestBills.map((b) => (
                  <li key={b.id} className="py-3">
                    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {b.billNumber} <StatusPill status={b.status} />
                    </p>
                    <Link href={`/legislation/${b.id}`} className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-900 hover:underline dark:text-white">
                      {b.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {[b.sponsor, b.chamber, shortDate(b.introducedDate)].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">No bills loaded yet.</p>
            )}
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
              <Link href="/legislation/bills" className="text-slate-900 underline underline-offset-2 dark:text-white">
                All bills →
              </Link>
              <Link href="/legislation/compare" className="text-slate-500 underline underline-offset-2 dark:text-slate-400">
                Compare two members&apos; votes
              </Link>
            </p>
          </ChartCard>
        </div>
      </Section>

      <Section
        id="polarization"
        title="Polarization"
        intro="DW-NOMINATE places every member of Congress on a scale from −1 (most liberal) to +1 (most conservative), estimated from their whole roll-call record. The distance between the two parties' averages is the standard measure of how polarized Congress is."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="House: party averages" subtitle="Mean ideology score per Congress" source={SOURCES.voteview} table={seriesTable(polarization.house, "score")}>
            <TimeSeriesChart series={polarization.house} unit="score" />
          </ChartCard>
          <ChartCard title="Senate: party averages" subtitle="Mean ideology score per Congress" source={SOURCES.voteview} table={seriesTable(polarization.senate, "score")}>
            <TimeSeriesChart series={polarization.senate} unit="score" />
          </ChartCard>
          <ChartCard className="lg:col-span-2" title={`Where members sit, ${polarization.latestLabel}`} subtitle="Members by ideology score, House and Senate" source={SOURCES.voteview}>
            <div className="space-y-6">
              {(["House", "Senate"] as const).map((chamber) => (
                <div key={chamber}>
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{chamber}</p>
                  <IdeologyHistogram bins={polarization.histogram[chamber]} />
                </div>
              ))}
              <ul className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-(--viz-dem)" />Democrats</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-(--viz-rep)" />Republicans</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-(--viz-muted)" />Independents</li>
              </ul>
            </div>
          </ChartCard>
        </div>
      </Section>

      <Section
        id="court"
        title="Supreme Court"
        intro="Every decision since the 1946 term. Outcome direction follows the Supreme Court Database's coding: for example, a ruling for a criminal defendant, a civil-rights claimant, or a union is coded liberal; the reverse is coded conservative."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="How the Court divides" subtitle="Decisions per term by vote margin" source={SOURCES.scdb} table={seriesTable(court.splits, "count")}>
            <TimeSeriesChart series={court.splits} type="column" unit="count" />
          </ChartCard>
          <ChartCard title="Conservative outcomes" subtitle="Share of decisions with a conservative outcome, per term" source={SOURCES.scdb} table={seriesTable(court.conservativeShare, "percent")}>
            <TimeSeriesChart series={court.conservativeShare} unit="percent" />
          </ChartCard>
          <ChartCard title="The current justices" subtitle="Share of each justice's votes in the conservative direction, whole tenure" source={SOURCES.scdb} table={rankedTable(court.justices, "Justice", "percent")}>
            <RankedBars items={court.justices} unit="percent" color="var(--viz-rep)" />
          </ChartCard>
          <ChartCard title="What the Court decides" subtitle={`Decisions by issue area · ${court.issueWindow}`} source={SOURCES.scdb} table={rankedTable(court.issues, "Issue area", "count")}>
            <RankedBars items={court.issues} unit="count" />
          </ChartCard>
        </div>
        <ChartCard title="Latest decisions" subtitle={court.latestTerm ? `Through the ${court.latestTerm} term` : undefined} source={SOURCES.scdb}>
          <div className="overflow-x-auto">
            <SortableTable
              className="w-full min-w-xl text-sm"
              theadClassName="text-left text-xs text-slate-500 dark:text-slate-400"
              thClassName="py-2 pr-3 font-medium"
              columns={[{ label: "Decided" }, { label: "Case" }, { label: "Issue" }, { label: "Outcome" }, { label: "Vote", align: "right" }]}
              rows={court.latest.map((c) => ({
                key: `${c.name}-${c.decided}`,
                cells: [
                  { content: shortDate(c.decided), sort: c.decided ? Date.parse(c.decided) : null, className: "py-2 pr-3 whitespace-nowrap text-slate-500 dark:text-slate-400" },
                  {
                    content: (
                      <>
                        {c.name}
                        {c.citation && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{c.citation}</span>}
                      </>
                    ),
                    sort: c.name.toLowerCase(),
                    className: "py-2 pr-3 text-slate-900 dark:text-white",
                  },
                  { content: c.issue, className: "py-2 pr-3 text-slate-600 dark:text-slate-300" },
                  { content: c.direction, className: "py-2 pr-3 text-slate-600 capitalize dark:text-slate-300" },
                  {
                    content: c.majority !== null && c.minority !== null ? `${c.majority}–${c.minority}` : "",
                    sort: c.majority !== null && c.minority !== null ? c.majority - c.minority : null,
                    className: "py-2 text-slate-900 tabular-nums dark:text-white",
                  },
                ],
              }))}
            />
          </div>
        </ChartCard>
      </Section>

      <Section
        id="executive"
        title="Executive orders"
        intro="Executive orders direct how federal agencies carry out the law. They are numbered and published in the Federal Register; a later president can revoke them."
      >
        <ChartCard title="Executive orders per year" subtitle={`By signing date, ${executive.firstYear ?? ""} onward (the Federal Register's online record)`} source={SOURCES.fr} table={seriesTable(executive.perYear, "count")}>
          <TimeSeriesChart
            series={executive.perYear}
            type="column"
            unit="count"
            height={260}
            markers={[
              { x: 2001, label: "Bush" },
              { x: 2009, label: "Obama" },
              { x: 2017, label: "Trump" },
              { x: 2021, label: "Biden" },
              { x: 2025, label: "Trump" },
            ]}
          />
        </ChartCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Orders by president" subtitle="Hover a bar for the yearly rate" source={SOURCES.fr} table={rankedTable(executive.presidents, "President", "count")}>
            <RankedBars items={executive.presidents} unit="count" />
          </ChartCard>
          <ChartCard title="Latest executive orders" source={SOURCES.fr}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {executive.latest.map((eo) => (
                <li key={`${eo.eo}-${eo.title}`} className="py-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {eo.eo ? `EO ${eo.eo} · ` : ""}
                    {shortDate(eo.signed)}
                  </p>
                  {eo.url ? (
                    <a href={eo.url} className="mt-0.5 line-clamp-2 text-sm text-slate-900 hover:underline dark:text-white">
                      {eo.title}
                    </a>
                  ) : (
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-900 dark:text-white">{eo.title}</p>
                  )}
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </Section>

      <Section id="sources" title="Sources" intro="Every figure on this page comes from the datasets below.">
        <DatasetList datasets={datasets.map((d) => ({ ...d, coverage: coverage[d.slug] ?? null }))} />
      </Section>
    </div>
  );
}
