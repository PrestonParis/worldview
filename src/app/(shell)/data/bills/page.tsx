import Link from "next/link";
import { listBills } from "@/lib/db/bills";
import { listEntities } from "@/lib/neo4j/entities";
import { BillForm } from "@/components/forms/bill-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { StatusPill } from "@/components/legislation/bill-status";
import { deleteBillAction } from "@/lib/actions/bills";

export default async function BillsPage({
  searchParams,
}: PageProps<"/data/bills">) {
  const [bills, entities, params] = await Promise.all([
    listBills(),
    listEntities(),
    searchParams,
  ]);
  const nameOf = (id: string | null) =>
    id ? (entities.find((e) => e.id === id)?.name ?? "Unknown") : "No sponsor on record";

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add bill" defaultOpen={params.add === "1"}>
        <BillForm entities={entities} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {bills.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {b.billNumber}
                </span>
                <StatusPill status={b.status} />
              </div>
              <p className="truncate text-slate-900 dark:text-slate-100">{b.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sponsored by {nameOf(b.sponsorEntityId)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/bills/${b.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton id={b.id} label={b.title} action={deleteBillAction} />
            </div>
          </li>
        ))}
        {bills.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No bills yet. Add the first one above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
