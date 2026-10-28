import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { CloseRacesView, PAGE } from "@/components/tools/writ/close-races-view";
import { currentUserIsOwner } from "@/lib/auth/guard";
import { listTrackedElections, loadCloseRaces, movedElection } from "@/lib/db/closeRaces";
import { parseCloseRaceFilters } from "@/lib/elections/close-races/filters";

// Rendered per request; the data underneath is cached for 60 s and expired
// by the ingester after each write (src/lib/db/closeRaces.ts).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ election: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { election } = await params;
  const found = (await listTrackedElections()).find((e) => e.id === decodeURIComponent(election));
  return {
    title: found ? `Close races: ${found.name} (${found.date}) | Writ | Worldview` : "Close races | Writ | Worldview",
    description: "Every Georgia contest in the Secretary of State's results system, ranked by the votes separating winner from loser.",
  };
}

export default async function CloseRacesPage({ params, searchParams }: Props) {
  const [{ election }, query, isOwner] = await Promise.all([params, searchParams, currentUserIsOwner()]);
  const id = decodeURIComponent(election);
  const filters = parseCloseRaceFilters(query);
  const show = typeof query.show === "string" ? query.show : null;
  const limit = show === "all" ? null : Math.max(PAGE, Number(show) || PAGE);
  const data = await loadCloseRaces(id, filters, { withAlerts: isOwner });
  if (!data) {
    // An id SOS later replaced: the report lives under the new one.
    const moved = movedElection(await listTrackedElections(), id);
    if (moved) redirect(`/writ/close-races/${encodeURIComponent(moved.id)}`);
    notFound();
  }
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Close races", href: "/writ/close-races" }, { label: data.election.name }]} />
      {/* eslint-disable-next-line react-hooks/purity -- render-time clock for the staleness check */}
      <CloseRacesView data={data} filters={filters} isOwner={isOwner} now={Date.now()} limit={limit} />
    </>
  );
}
