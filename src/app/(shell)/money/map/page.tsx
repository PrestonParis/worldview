import type { Metadata } from "next";
import { listStateBreakdown } from "@/lib/db/contributions";
import { getEntitiesByIds } from "@/lib/db/entities";
import { DonorMap } from "@/components/money/donor-map";

export const metadata: Metadata = {
  title: "Donor geography | Worldview",
  description: "Where campaign contributions come from, state by state, from FEC filings.",
};

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

export default async function Page() {
  const rows = await listStateBreakdown();
  const entities = await getEntitiesByIds(rows.flatMap((r) => [r.recipientEntityId, r.donorEntityId]));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Donor geography</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Where the money comes from, by the donor&rsquo;s state on the FEC filing.
      </p>
      <div className="mt-6">
        <DonorMap rows={rows} entities={entities} />
      </div>
    </div>
  );
}
