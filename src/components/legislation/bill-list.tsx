import { listBills } from "@/lib/db/bills";
import { listVoteTalliesByBill } from "@/lib/db/votes";
import { listEntities } from "@/lib/neo4j/entities";
import { EmptyStateFeatures } from "@/components/empty-state";
import { PageDescription } from "@/components/page-description";
import { BillListView } from "./bill-list-view";
import type { PageContent } from "@/lib/pages-content";

// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function BillList({ content }: { content: PageContent }) {
  const [bills, tallyMap, entities] = await Promise.all([
    listBills(),
    listVoteTalliesByBill(),
    listEntities(),
  ]);
  // Plain object across the server/client boundary — same convention as
  // the rest of this app's list pages (arrays in, Maps built client-side).
  const tallies = Object.fromEntries(tallyMap);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>
      <PageDescription content={content} />

      <div className="mt-6">
        {bills.length === 0 ? (
          <EmptyStateFeatures
            content={content}
            message="No bills recorded yet — add a bill number, title, and sponsor in"
            cta={{ href: "/data/bills", label: "Manage Data" }}
          />
        ) : (
          <BillListView
            bills={bills}
            tallies={tallies}
            entities={entities}
            searchPlaceholder={`Search ${content.title}…`}
          />
        )}
      </div>
    </div>
  );
}
