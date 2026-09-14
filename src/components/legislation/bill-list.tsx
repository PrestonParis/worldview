import Link from "next/link";
import { listBills } from "@/lib/db/bills";
import { listVoteTalliesByBill } from "@/lib/db/votes";
import { listRollCallCountsByBill } from "@/lib/db/rollCalls";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { DataFreshness } from "./data-freshness";
import { BillListView } from "./bill-list-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function BillList({ content }: { content: PageContent }) {
  const [bills, tallyMap, rollCallCountMap, entities] = await Promise.all([
    listBills(),
    listVoteTalliesByBill(),
    listRollCallCountsByBill(),
    listEntities(),
  ]);
  // Plain objects across the server/client boundary — same convention as
  // the rest of this app's list pages (arrays in, Maps built client-side).
  const tallies = Object.fromEntries(tallyMap);
  const rollCallCounts = Object.fromEntries(rollCallCountMap);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <DataFreshness sources={["congress-bills", "congress-votes"]} className="mt-2" />
      <p className="mt-2 text-sm">
        <Link href="/legislation/compare" className="text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          Compare two members&rsquo; voting records →
        </Link>
      </p>
      <PageDescription content={content} />

      <div className="mt-6">
        {bills.length === 0 ? (
          <EmptyStateFeatures
            content={content}
            message="No bills recorded yet. Run the Congress.gov import (npm run import:congress-bills) or add one by hand in"
            cta={{ href: "/data/bills", label: "Manage Data" }}
          />
        ) : (
          <BillListView
            bills={bills}
            tallies={tallies}
            rollCallCounts={rollCallCounts}
            entities={entities}
            searchPlaceholder={`Search ${content.title}…`}
          />
        )}
      </div>
    </div>
  );
}
