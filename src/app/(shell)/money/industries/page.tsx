import type { Metadata } from "next";
import { listIndustryBreakdown } from "@/lib/db/contributions";
import { getEntitiesByIds } from "@/lib/db/entities";
import { IndustryExplorer } from "@/components/money/industry-explorer";

export const metadata: Metadata = {
  title: "Donors by industry | Worldview",
  description: "Campaign contributions grouped by donor industry, from FEC filings.",
};

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export default async function Page() {
  const rows = await listIndustryBreakdown();
  const entities = await getEntitiesByIds(rows.flatMap((r) => [r.recipientEntityId, r.donorEntityId]));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Industry support</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Which sectors fund whom, by donor industry.
      </p>
      <div className="mt-6">
        <IndustryExplorer rows={rows} entities={entities} />
      </div>
    </div>
  );
}
