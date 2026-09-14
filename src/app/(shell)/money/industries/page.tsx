import { listIndustryBreakdown } from "@/lib/db/contributions";
import { listEntities } from "@/lib/neo4j/entities";
import { IndustryExplorer } from "@/components/money/industry-explorer";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rows, entities] = await Promise.all([listIndustryBreakdown(), listEntities()]);

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
