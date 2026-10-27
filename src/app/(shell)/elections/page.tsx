import type { Metadata } from "next";
import { ElectionsExplorer } from "@/components/elections/elections-explorer";
import { ElectorateSection } from "@/components/elections/electorate-section";
import { DataSourceNote } from "@/components/elections/data-source-note";
import { ElectionCalendar, ElectionCycleHero } from "@/components/elections/election-cycle-hero";
import { EmptyState } from "@/components/empty-state";
import { MyRaces } from "@/components/my-government/highlights";
import { listCycles, listRaces, listSearchEntries } from "@/lib/db/election-overview";
import { loadElectorate } from "@/lib/db/electorate";
import { chamberProjections } from "@/lib/elections/cycle-control";
import { OFFICES, type OfficeKey } from "@/lib/elections/overview";

export const metadata: Metadata = {
  title: "Elections | Worldview",
  description: "U.S. election results, race ratings, county maps, and who votes, by cycle and office.",
};

export const dynamic = "force-dynamic";

const CHAMBER: Partial<Record<OfficeKey, string>> = { senate: "senate", house: "house", governor: "governor" };

export default async function Page({ searchParams }: PageProps<"/elections">) {
  const params = await searchParams;
  const electorateGeo = typeof params.electorate === "string" && /^\d{2}$/.test(params.electorate) ? params.electorate : "US";
  const [cycles, electorate] = await Promise.all([listCycles(), loadElectorate(electorateGeo)]);

  const requestedCycle = Number(params.cycle);
  const summary = cycles.find((item) => item.cycle === requestedCycle) ?? cycles[0];
  const requestedOffice = OFFICES.find((item) => item.key === params.office)?.key;
  const office =
    requestedOffice && summary?.offices[requestedOffice]
      ? requestedOffice
      : (OFFICES.find((item) => summary?.offices[item.key])?.key ?? "senate");

  const [races, searchEntries, projections] = summary
    ? await Promise.all([
        listRaces(summary.cycle, office),
        listSearchEntries(),
        summary.upcoming ? chamberProjections(summary.cycle) : Promise.resolve([]),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-7xl">
      {summary ? <ElectionCycleHero summary={summary} projections={projections} /> : (
        <div><h1 className="text-3xl font-semibold tracking-tight">Elections</h1><p className="mt-2 text-slate-500">Races, results, and voting information.</p></div>
      )}

      <nav aria-label="Election page sections" className="sticky top-0 z-20 -mx-4 sm:-mx-8 mt-0 flex gap-6 overflow-x-auto border-b border-slate-200 bg-[var(--background)] px-4 sm:px-8 py-3 text-sm font-medium dark:border-slate-800">
        <a href="#races" className="whitespace-nowrap hover:text-blue-700 dark:hover:text-blue-300">Races and maps</a>
        <a href="#electorate" className="whitespace-nowrap hover:text-blue-700 dark:hover:text-blue-300">Electorate</a>
        <a href="#voting" className="whitespace-nowrap hover:text-blue-700 dark:hover:text-blue-300">Voting calendar</a>
      </nav>

      <div id="races" className="scroll-mt-24 pt-8">
        {!summary ? (
          <EmptyState
            message="No elections recorded yet. Add a race by hand, or import returns, in"
            cta={{ href: "/data/elections", label: "Manage Data" }}
          />
        ) : (
          <>
            <MyRaces cycle={summary.cycle} showPrompt className="mb-6" />
            <ElectionsExplorer
              key={`${summary.cycle}-${office}`}
              cycles={cycles}
              cycle={summary.cycle}
              office={office}
              races={races}
              projection={projections.find((item) => item.chamber === CHAMBER[office]) ?? null}
              searchEntries={searchEntries}
            />
            <DataSourceNote className="mt-8" />
          </>
        )}
      </div>

      {electorate ? (
        <div id="electorate" className="mt-16 scroll-mt-24">
          <ElectorateSection key={electorate.geoid} data={electorate} initialYear={summary?.cycle} />
        </div>
      ) : null}

      <div className="mt-16"><ElectionCalendar /></div>
    </div>
  );
}
