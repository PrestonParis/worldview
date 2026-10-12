import Link from "next/link";
import { listContributions } from "@/lib/db/contributions";
import { listSources } from "@/lib/db/sources";
import { getEntitiesByIds } from "@/lib/neo4j/entities";
import { ContributionsListView } from "./contributions-list-view";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
// The body of /money/contributions; `window` scopes it to one FEC cycle.
export async function ContributionsList({
  window,
  partyByEntity,
}: {
  window?: { from: string; to: string } | null;
  partyByEntity?: Record<string, string>;
}) {
  const [all, sources] = await Promise.all([listContributions(), listSources()]);
  const contributions = window ? all.filter((c) => c.date.slice(0, 10) >= window.from && c.date.slice(0, 10) <= window.to) : all;
  const entities = await getEntitiesByIds(contributions.flatMap((c) => [c.donorEntityId, c.recipientEntityId]));

  if (contributions.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No contributions recorded for this cycle yet. Add donor, recipient, and amount in{" "}
        <Link href="/data/contributions" className="underline underline-offset-2">
          Manage Data
        </Link>
        .
      </p>
    );
  }
  return (
    <ContributionsListView
      contributions={contributions}
      entities={entities}
      sources={sources}
      partyByEntity={partyByEntity}
      searchPlaceholder="Search donor or recipient…"
    />
  );
}
