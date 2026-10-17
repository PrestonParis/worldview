"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import {
  defaultFocusView,
  focusHasView,
  IMMIGRATION_FOCI,
  IMMIGRATION_FOCUS_VIEWS,
  isImmigrationFocus,
  type GreenCardView,
  type ImmigrationFocus,
} from "@/components/immigration/green-card-views";
import { ImmigrationFlow } from "@/components/immigration/primer";
import { formatPeriod } from "@/lib/format";

type Figure = {
  value: number | null | undefined;
  unit?: string;
  period?: string;
  spark?: number[];
  change?: number | null;
  compare?: string;
  note?: string;
};

export interface ImmigrationFlowData {
  encounters: Figure;
  temporary: Figure;
  humanitarian: Figure;
  greenCards: Figure;
  adjustmentShare: number | null | undefined;
  naturalizations: Figure;
  netMigration: Figure;
  naturalized: number | null | undefined;
  noncitizen: number | null | undefined;
  foreignBorn: Figure;
  unauthorized: Figure;
}

export interface GreenCardData {
  total: number | null;
  period: string;
  change?: number | null;
  compare?: string;
  adjustmentShare: number | null;
  history: Series[];
  split: Series[];
  pathways: { period: string; items: RankedItem[] };
  countries: { period: string; items: RankedItem[] };
  naturalizations: Series[];
  naturalizedShare: Series[];
  naturalizationCountries: { period: string; items: RankedItem[] };
}

export interface ImmigrationExplorerData {
  border: { latest: Figure; trailing: Figure; peak: Figure; trend: Series[]; states: RankedItem[]; citizenship: RankedItem[]; offices: RankedItem[]; period: string };
  temporary: { recorded: Figure; all: Figure; purpose: RankedItem[]; trend: Series[]; work: RankedItem[]; period: string };
  humanitarian: { total: Figure; refugees: Figure; asylum: Figure; refugeeTrend: Series[]; asylumTrend: Series[]; refugeeCountries: { period: string; items: RankedItem[] }; asylumCountries: { period: string; items: RankedItem[] } };
  greenCards: GreenCardData;
  naturalizations: { total: Figure; history: Series[]; countries: { period: string; items: RankedItem[] }; share: Series[] };
  population: { total: Figure; share: Figure; unauthorized: Figure; citizenship: Series[]; shareHistory: Series[]; countries: { period: string; items: RankedItem[] }; regions: { period: string; items: RankedItem[] } };
  netMigration: { total: Figure; trend: Series[]; growth: Series[] };
}

type TopicViews = Partial<Record<ImmigrationFocus, string>>;

interface ExplorerState {
  focus: ImmigrationFocus | null;
  getView: (focus: ImmigrationFocus) => string;
  setFocus: (focus: ImmigrationFocus | null) => void;
  setView: (focus: ImmigrationFocus, view: string) => void;
}

const ExplorerContext = createContext<ExplorerState | null>(null);

// The page is cached as one static render, so ?focus= and ?view= are read
// here after hydration rather than on the server.
export function ImmigrationExplorerProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<ImmigrationFocus | null>(null);
  const [views, setViews] = useState<TopicViews>(() =>
    Object.fromEntries(IMMIGRATION_FOCI.map((topic) => [topic, defaultFocusView(topic)])),
  );
  const getView = (topic: ImmigrationFocus) => views[topic] ?? defaultFocusView(topic);
  const syncUrl = (nextFocus: ImmigrationFocus | null, nextView?: string) => {
    const url = new URL(window.location.href);
    if (nextFocus) {
      url.searchParams.set("focus", nextFocus);
      url.searchParams.set("view", nextView ?? getView(nextFocus));
    } else {
      url.searchParams.delete("focus");
      url.searchParams.delete("view");
    }
    window.history.pushState(null, "", url);
  };
  const setFocus = (nextFocus: ImmigrationFocus | null) => {
    setFocusState(nextFocus);
    syncUrl(nextFocus);
  };
  const setView = (topic: ImmigrationFocus, nextView: string) => {
    if (!focusHasView(topic, nextView)) return;
    setViews((current) => ({ ...current, [topic]: nextView }));
    if (focus === topic) syncUrl(topic, nextView);
  };
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextFocus = params.get("focus");
      if (!isImmigrationFocus(nextFocus)) {
        setFocusState(null);
        return;
      }
      const nextView = params.get("view");
      setFocusState(nextFocus);
      if (focusHasView(nextFocus, nextView)) setViews((current) => ({ ...current, [nextFocus]: nextView }));
    };
    onPopState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  return <ExplorerContext value={{ focus, getView, setFocus, setView }}>{children}</ExplorerContext>;
}

function useExplorer() {
  const value = useContext(ExplorerContext);
  if (!value) throw new Error("Immigration explorer must be inside ImmigrationExplorerProvider");
  return value;
}

const TOPICS: Record<ImmigrationFocus, { eyebrow: string; title: string; description: string; section: string; sectionLabel: string }> = {
  border: { eyebrow: "Arrival and enforcement", title: "Stopped at the border", description: "Encounters are enforcement events, not unique people. See the national trend and where CBP recorded them.", section: "border", sectionLabel: "border section" },
  temporary: { eyebrow: "Temporary entry", title: "Visiting, studying, working", description: "Admissions count entries, not people. Compare the purposes of travel, the recent trend, and the largest work classes.", section: "temporary", sectionLabel: "Temporary visas section" },
  humanitarian: { eyebrow: "Humanitarian protection", title: "Refugees and asylum", description: "Refugees are counted when they arrive; asylees when protection is granted. They are separate routes measured at different moments.", section: "humanitarian", sectionLabel: "Refugees and asylum section" },
  "green-cards": { eyebrow: "Permanent residence", title: "Green cards", description: "A green card is a change in legal status, not necessarily a new arrival. Compare the total, route, prior location, and what follows.", section: "legal", sectionLabel: "Green Cards section" },
  naturalizations: { eyebrow: "Citizenship", title: "Naturalizations", description: "Naturalization is the path from permanent residence to citizenship, usually after five years and an application process.", section: "legal", sectionLabel: "Green Cards and citizenship section" },
  population: { eyebrow: "Population stock", title: "Foreign-born residents", description: "This is everyone living in the U.S. who was not a citizen at birth, across legal statuses and years of arrival.", section: "population", sectionLabel: "Immigration and population section" },
  "net-migration": { eyebrow: "Population change", title: "Net international migration", description: "This is everyone moving in from abroad minus everyone moving abroad, including U.S. citizens—not green cards minus deportations.", section: "population", sectionLabel: "Immigration and population section" },
};

const VIEW_LABELS: Record<ImmigrationFocus, Record<string, string>> = {
  border: { trend: "Trend", states: "States", citizenship: "Citizenship", offices: "Offices" },
  temporary: { purpose: "Purpose", trend: "Trend", work: "Work classes" },
  humanitarian: { trend: "Trends", nationalities: "Nationalities" },
  "green-cards": { trend: "Trend", pathways: "Pathways", status: "Already here or arriving", countries: "Countries", citizenship: "Citizenship" },
  naturalizations: { trend: "Applications and citizens", countries: "Countries", share: "Citizen share" },
  population: { citizenship: "Citizenship", share: "Population share", countries: "Countries", regions: "Regions" },
  "net-migration": { trend: "Trend", growth: "Share of growth" },
};

const SOURCES = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
};

function ViewTabs({ focus, panelId }: { focus: ImmigrationFocus; panelId: string }) {
  const { getView, setView } = useExplorer();
  const view = getView(focus);
  return (
    <div className="-mx-1 overflow-x-auto px-1" role="tablist" aria-label={`${TOPICS[focus].title} views`}>
      <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {IMMIGRATION_FOCUS_VIEWS[focus].map((item) => (
          <button key={item} type="button" role="tab" id={`${panelId}-tab-${item}`} aria-selected={view === item} aria-controls={panelId} onClick={() => setView(focus, item)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${view === item ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
            {VIEW_LABELS[focus][item]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FigureTile({ label, figure, unit = "people" }: { label: string; figure: Figure; unit?: string }) {
  return <StatTile label={label} value={figure.value ?? null} unit={unit} period={figure.period} change={figure.change} compareLabel={figure.compare} note={figure.note} spark={figure.spark} />;
}

function GreenCardSummary({ data }: { data: GreenCardData }) {
  const adjusted = data.adjustmentShare;
  return <div className="grid gap-3 sm:grid-cols-3"><StatTile label="Green cards" value={data.total} unit="people" period={data.period} change={data.change} compareLabel={data.compare} /><StatTile label="Already lived in the U.S." value={adjusted} unit="percent" period="Adjusted status" note="Received permanent residence without arriving that year" /><StatTile label="Arrived from abroad" value={adjusted === null ? null : 100 - adjusted} unit="percent" period="Immigrant visa" note="Became a permanent resident on entry" /></div>;
}

function TopicSummary({ focus, data }: { focus: ImmigrationFocus; data: ImmigrationExplorerData }) {
  if (focus === "green-cards") return <GreenCardSummary data={data.greenCards} />;
  if (focus === "border") return <div className="grid gap-3 sm:grid-cols-3"><FigureTile label="Latest month" figure={data.border.latest} unit="encounters" /><FigureTile label="Last 12 months" figure={data.border.trailing} unit="encounters" /><FigureTile label="Peak month since FY 2020" figure={data.border.peak} unit="encounters" /></div>;
  if (focus === "temporary") return <div className="grid gap-3 sm:grid-cols-2"><FigureTile label="Recorded on Form I-94" figure={data.temporary.recorded} unit="admissions" /><FigureTile label="All temporary admissions" figure={data.temporary.all} unit="admissions" /></div>;
  if (focus === "humanitarian") return <div className="grid gap-3 sm:grid-cols-3"><FigureTile label="Refugees + asylum grants" figure={data.humanitarian.total} /><FigureTile label="Refugee arrivals" figure={data.humanitarian.refugees} /><FigureTile label="People granted asylum" figure={data.humanitarian.asylum} /></div>;
  if (focus === "naturalizations") {
    const share = data.naturalizations.share[0]?.points.at(-1);
    return <div className="grid gap-3 sm:grid-cols-2"><FigureTile label="People naturalized" figure={data.naturalizations.total} /><StatTile label="Foreign-born residents who are citizens" value={share?.value ?? null} unit="percent" period={share ? String(share.x) : ""} /></div>;
  }
  if (focus === "population") return <div className="grid gap-3 sm:grid-cols-3"><FigureTile label="Foreign-born residents" figure={data.population.total} /><FigureTile label="Share of all residents" figure={data.population.share} unit="percent" /><FigureTile label="Unauthorized estimate" figure={data.population.unauthorized} /></div>;
  const natural = data.netMigration.growth.find((series) => series.id === "natural")?.points.at(-1);
  return <div className="grid gap-3 sm:grid-cols-2"><FigureTile label="Net international migration" figure={data.netMigration.total} /><StatTile label="Natural increase" value={natural?.value ?? null} unit="people" period={natural ? String(natural.x) : ""} note="Births minus deaths" /></div>;
}

function GreenCardVisualization({ data, panelId, compact = false }: { data: GreenCardData; panelId: string; compact?: boolean }) {
  const view = useExplorer().getView("green-cards") as GreenCardView;
  if (view === "citizenship") {
    return <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${view}`} className="grid gap-4 lg:grid-cols-2"><ChartCard title="Applications and new citizens" subtitle="Per fiscal year, since 1907" source={SOURCES.yearbook} table={seriesTable(data.naturalizations, "people")}><TimeSeriesChart series={data.naturalizations} unit="people" height={compact ? 240 : 280} /></ChartCard><ChartCard title="Share of foreign-born residents who are citizens" subtitle="Naturalized citizens as a share of all foreign-born residents" source={SOURCES.acs} table={seriesTable(data.naturalizedShare, "percent")}><TimeSeriesChart series={data.naturalizedShare} unit="percent" height={compact ? 240 : 280} fromZero={false} /></ChartCard>{!compact && <ChartCard title="New citizens by country of birth" subtitle={`${formatPeriod(data.naturalizationCountries.period)} · top 10`} source={SOURCES.yearbook} table={rankedTable(data.naturalizationCountries.items, "Country", "people")} className="lg:col-span-2"><RankedBars items={data.naturalizationCountries.items} unit="people" /></ChartCard>}</div>;
  }
  const title = view === "pathways" ? "How people got green cards" : view === "status" ? "Already here, or arriving?" : view === "countries" ? "Green cards by country of birth" : "Two centuries of permanent immigration";
  const subtitle = view === "pathways" ? `${formatPeriod(data.pathways.period)} · class of admission` : view === "status" ? "Where recipients were when they received permanent residence" : view === "countries" ? `${formatPeriod(data.countries.period)} · top 10` : "New lawful permanent residents per fiscal year, 1820 onward";
  const table = view === "pathways" ? rankedTable(data.pathways.items, "Class of admission", "people") : view === "countries" ? rankedTable(data.countries.items, "Country", "people") : seriesTable(view === "status" ? data.split : data.history, "people");
  const chart = view === "pathways" ? <RankedBars items={data.pathways.items} unit="people" /> : view === "countries" ? <RankedBars items={data.countries.items} unit="people" /> : <TimeSeriesChart series={view === "status" ? data.split : data.history} type={view === "status" ? "column" : undefined} unit="people" height={compact ? 240 : 320} />;
  return <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${view}`}><ChartCard title={title} subtitle={subtitle} source={SOURCES.yearbook} table={table}>{chart}</ChartCard></div>;
}

function TopicVisualization({ focus, data, panelId }: { focus: ImmigrationFocus; data: ImmigrationExplorerData; panelId: string }) {
  const view = useExplorer().getView(focus);
  const labelledBy = `${panelId}-tab-${view}`;
  if (focus === "green-cards") return <GreenCardVisualization data={data.greenCards} panelId={panelId} compact />;
  if (focus === "border") {
    const ranked = view === "states" ? data.border.states : view === "citizenship" ? data.border.citizenship : data.border.offices;
    const label = view === "states" ? "State" : view === "citizenship" ? "Citizenship" : "Sector or field office";
    return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy}><ChartCard title={view === "trend" ? "Monthly border encounters" : view === "states" ? "Where encounters were recorded" : view === "citizenship" ? "Encounters by citizenship" : "Border Patrol sectors and port field offices"} subtitle={view === "trend" ? "Nationwide · split by legal authority" : `${data.border.period} · top 10`} source={SOURCES.cbp} table={view === "trend" ? seriesTable(data.border.trend, "encounters") : rankedTable(ranked, label, "encounters")}>{view === "trend" ? <TimeSeriesChart series={data.border.trend} type="column" unit="encounters" height={260} /> : <RankedBars items={ranked} unit="encounters" />}</ChartCard></div>;
  }
  if (focus === "temporary") {
    const ranked = view === "work" ? data.temporary.work : data.temporary.purpose;
    return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy}><ChartCard title={view === "trend" ? "Workers, students, and exchange visitors" : view === "work" ? "Largest temporary work classes" : "Temporary admissions by purpose"} subtitle={view === "trend" ? "I-94 admissions per fiscal year" : `${formatPeriod(data.temporary.period)} · I-94 admissions`} source={SOURCES.yearbook} table={view === "trend" ? seriesTable(data.temporary.trend, "admissions") : rankedTable(ranked, view === "work" ? "Class" : "Purpose", "admissions")}>{view === "trend" ? <TimeSeriesChart series={data.temporary.trend} type="column" unit="admissions" height={260} /> : <RankedBars items={ranked} unit="admissions" />}</ChartCard></div>;
  }
  if (focus === "humanitarian") return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="grid gap-4 lg:grid-cols-2">{view === "trend" ? <><ChartCard title="Refugee arrivals" subtitle="Per fiscal year" source={SOURCES.yearbook} table={seriesTable(data.humanitarian.refugeeTrend, "people")}><TimeSeriesChart series={data.humanitarian.refugeeTrend} unit="people" height={240} /></ChartCard><ChartCard title="Asylum grants" subtitle="By route, per fiscal year" source={SOURCES.yearbook} table={seriesTable(data.humanitarian.asylumTrend, "people")}><TimeSeriesChart series={data.humanitarian.asylumTrend} type="column" unit="people" height={240} /></ChartCard></> : <><ChartCard title="Refugee arrivals by nationality" subtitle={`${formatPeriod(data.humanitarian.refugeeCountries.period)} · top 10`} source={SOURCES.yearbook} table={rankedTable(data.humanitarian.refugeeCountries.items, "Nationality", "people")}><RankedBars items={data.humanitarian.refugeeCountries.items} unit="people" /></ChartCard><ChartCard title="Affirmative asylum grants by nationality" subtitle={`${formatPeriod(data.humanitarian.asylumCountries.period)} · top 10`} source={SOURCES.yearbook} table={rankedTable(data.humanitarian.asylumCountries.items, "Nationality", "people")}><RankedBars items={data.humanitarian.asylumCountries.items} unit="people" /></ChartCard></>}</div>;
  if (focus === "naturalizations") return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy}><ChartCard title={view === "countries" ? "New citizens by country of birth" : view === "share" ? "Share of foreign-born residents who are citizens" : "Applications and new citizens"} subtitle={view === "countries" ? `${formatPeriod(data.naturalizations.countries.period)} · top 10` : "Per year"} source={view === "share" ? SOURCES.acs : SOURCES.yearbook} table={view === "countries" ? rankedTable(data.naturalizations.countries.items, "Country", "people") : seriesTable(view === "share" ? data.naturalizations.share : data.naturalizations.history, view === "share" ? "percent" : "people")}>{view === "countries" ? <RankedBars items={data.naturalizations.countries.items} unit="people" /> : <TimeSeriesChart series={view === "share" ? data.naturalizations.share : data.naturalizations.history} unit={view === "share" ? "percent" : "people"} fromZero={view === "share" ? false : undefined} height={260} />}</ChartCard></div>;
  if (focus === "population") {
    const ranked = view === "regions" ? data.population.regions : data.population.countries;
    return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy}><ChartCard title={view === "citizenship" ? "Foreign-born population, by citizenship" : view === "share" ? "Foreign-born share of the population" : view === "countries" ? "Foreign-born residents by country of birth" : "Foreign-born residents by world region"} subtitle={view === "citizenship" ? "Naturalized citizens and noncitizens" : view === "share" ? "Per survey year" : `${ranked.period} survey`} source={SOURCES.acs} table={view === "citizenship" ? seriesTable(data.population.citizenship, "people") : view === "share" ? seriesTable(data.population.shareHistory, "percent") : rankedTable(ranked.items, view === "regions" ? "Region" : "Country", "people")}>{view === "citizenship" ? <TimeSeriesChart series={data.population.citizenship} type="column" unit="people" height={260} /> : view === "share" ? <TimeSeriesChart series={data.population.shareHistory} unit="percent" fromZero={false} height={260} /> : <RankedBars items={ranked.items} unit="people" />}</ChartCard></div>;
  }
  return <div id={panelId} role="tabpanel" aria-labelledby={labelledBy}><ChartCard title={view === "growth" ? "Where population growth comes from" : "Net international migration"} subtitle={view === "growth" ? "Natural increase vs. net international migration" : "Everyone moving in from abroad minus everyone moving abroad"} source={SOURCES.pep} table={seriesTable(view === "growth" ? data.netMigration.growth : data.netMigration.trend, "people")}><TimeSeriesChart series={view === "growth" ? data.netMigration.growth : data.netMigration.trend} type="column" unit="people" height={260} /></ChartCard></div>;
}

export function ImmigrationOverviewExplorer({ flow, data }: { flow: ImmigrationFlowData; data: ImmigrationExplorerData }) {
  const { focus, getView, setFocus } = useExplorer();
  const topic = focus ? TOPICS[focus] : null;
  return <div className="space-y-4"><ImmigrationFlow {...flow} selectedFocus={focus} onFocusSelect={(next) => setFocus(focus === next ? null : next)} /><div className={`grid transition-all duration-500 ${focus && topic ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden">{focus && topic && <section id="immigration-focus" className="scroll-mt-28 space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-6 dark:border-blue-900 dark:bg-blue-950/15"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">System focus · {topic.eyebrow}</p><h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{topic.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{topic.description}</p></div><button type="button" onClick={() => setFocus(null)} className="self-start text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Close</button></div><TopicSummary focus={focus} data={data} /><ViewTabs focus={focus} panelId="immigration-focus-view" /><TopicVisualization focus={focus} data={data} panelId="immigration-focus-view" /><a href={`#${topic.section}`} className="inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Explore the full {topic.sectionLabel} with {VIEW_LABELS[focus][getView(focus)].toLowerCase()} selected ↓</a></section>}</div></div></div>;
}

export function GreenCardChapter({ data }: { data: GreenCardData }) {
  return <div className="space-y-5"><p className="max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">A green card makes someone a lawful permanent resident. Some recipients arrive with an immigrant visa; most are already living in the United States and adjust their status. The views below keep those different questions together without stacking every chart.</p><GreenCardSummary data={data} /><ViewTabs focus="green-cards" panelId="green-card-chapter-view" /><GreenCardVisualization data={data} panelId="green-card-chapter-view" /></div>;
}
