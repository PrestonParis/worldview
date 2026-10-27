// The views IssueView renders: the comparator and the published issue pages,
// shared by /issueview/[view] and /issueview/compare.
import AbortionPage from "../abortion/page";
import CrimePage from "../crime/page";
import DemographicsPage from "../demographics/page";
import EconomyPage from "../economy/page";
import EducationPage from "../education/page";
import EnergyPage from "../energy/page";
import FamilyPage from "../family/page";
import GunsPage from "../guns/page";
import HealthCarePage from "../healthcare/page";
import HousingPage from "../housing/page";
import ImmigrationPage from "../immigration/page";
import ReligionPage from "../religion/page";
import SpendingPage from "../spending/page";
import StatesPage from "../states/page";
import { IssueViewWorkspace } from "@/components/tools/issueview/issueview-workspace";
import { getIssueViewCatalog, loadIssueViewComparison } from "@/lib/db/issueview";
import type { CompareSeries } from "@/lib/db/stats";

export type SearchParams = Record<string, string | string[] | undefined>;

export async function Comparator({ params }: { params: SearchParams }) {
  const level = params.level === "county" ? "county" : "state";
  const rawSeries = typeof params.series === "string" ? params.series : undefined;
  const catalog = await getIssueViewCatalog();
  const allowed = new Set(catalog.allMetrics.map((metric) => `${metric.source}:${metric.metric}`));
  const seriesToLoad: CompareSeries[] = [];

  if (rawSeries) {
    for (const item of rawSeries
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 6)) {
      const match = item.match(/^([^:@]+):([^@]+)(?:@(.+))?$/);
      if (match && allowed.has(`${match[1]}:${match[2]}`)) {
        seriesToLoad.push({ source: match[1], metric: match[2], ...(match[3] ? { period: match[3] } : {}) });
      }
    }
  } else {
    seriesToLoad.push(
      ...catalog.allMetrics
        .filter((metric) => metric.levels.includes(level))
        .slice(0, 2)
        .map((metric) => ({ source: metric.source, metric: metric.metric })),
    );
  }

  const result = seriesToLoad.length ? await loadIssueViewComparison(level, seriesToLoad) : null;
  return (
    <IssueViewWorkspace
      key={`${level}:${seriesToLoad.map((item) => `${item.source}:${item.metric}@${item.period ?? ""}`).join(",")}`}
      catalog={catalog}
      initialResult={result}
      initialLevel={level}
      initialAxes={{
        x: typeof params.x === "string" ? Number(params.x) : undefined,
        y: typeof params.y === "string" ? Number(params.y) : undefined,
      }}
    />
  );
}

export function IssueContent({ view, params }: { view: string; params: SearchParams }) {
  switch (view) {
    case "compare":
      return <Comparator params={params} />;
    case "immigration":
      return <ImmigrationPage />;
    case "crime":
      return <CrimePage />;
    case "guns":
      return <GunsPage />;
    case "abortion":
      return <AbortionPage />;
    case "economy":
      return <EconomyPage />;
    case "housing":
      return <HousingPage />;
    case "healthcare":
      return <HealthCarePage />;
    case "energy":
      return <EnergyPage />;
    case "demographics":
      return <DemographicsPage />;
    case "education":
      return <EducationPage />;
    case "religion":
      return <ReligionPage />;
    case "family":
      return <FamilyPage />;
    case "spending":
      return <SpendingPage />;
    case "states":
      return <StatesPage />;
    default:
      return null;
  }
}
