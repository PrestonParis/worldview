import Link from "next/link";
import { listContributions, listContributionTotalsByCurrency } from "@/lib/db/contributions";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { ContributionsListView } from "./contributions-list-view";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
// Rendered as a section on /money, alongside the existing entity/edge
// graph above it — not a full page, so no PageDescription/
// EmptyStateFeatures here (those already render once, from MoneyGraphPage).
export async function ContributionsList() {
  const [contributions, totals, entities, sources] = await Promise.all([
    listContributions(),
    listContributionTotalsByCurrency(),
    listEntities(),
    listSources(),
  ]);

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium">Contributions</h2>
      {contributions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No contributions recorded yet — add donor, recipient, and amount in{" "}
          <Link href="/data/contributions" className="underline underline-offset-2">
            Manage Data
          </Link>
          .
        </p>
      ) : (
        <ContributionsListView
          contributions={contributions}
          totals={totals}
          entities={entities}
          sources={sources}
          searchPlaceholder="Search donor or recipient…"
        />
      )}
    </div>
  );
}
