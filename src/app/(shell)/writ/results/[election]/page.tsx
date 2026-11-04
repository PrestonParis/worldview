import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { ResultsView } from "@/components/tools/writ/results-view";
import { listTrackedElections, loadResults, movedElection } from "@/lib/db/closeRaces";

// Rendered per request; the data underneath is cached for 60 s and expired by
// the ingester after each write (src/lib/db/closeRaces.ts).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ election: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { election } = await params;
  const found = (await listTrackedElections()).find((e) => e.id === decodeURIComponent(election));
  return {
    title: found ? `Georgia results: ${found.name} | Writ | Worldview` : "Georgia results | Writ | Worldview",
    description: "Georgia's election results from the Secretary of State: seats, statewide winners, runoffs, recount-range races and every local contest.",
  };
}

export default async function ResultsPage({ params }: Props) {
  const id = decodeURIComponent((await params).election);
  const data = await loadResults(id);
  if (!data) {
    const moved = movedElection(await listTrackedElections(), id);
    if (moved) redirect(`/writ/results/${encodeURIComponent(moved.id)}`);
    notFound();
  }
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Results", href: "/writ/results" }, { label: data.election.name }]} />
      <ResultsView data={data} />
    </>
  );
}
