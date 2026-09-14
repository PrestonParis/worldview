import Link from "next/link";
import { listContributions } from "@/lib/db/contributions";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { ContributionForm } from "@/components/forms/contribution-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteContributionAction } from "@/lib/actions/contributions";

export default async function ContributionsPage({
  searchParams,
}: PageProps<"/data/contributions">) {
  const [contributions, entities, sources, params] = await Promise.all([
    listContributions(),
    listEntities(),
    listSources(),
    searchParams,
  ]);
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add contribution" defaultOpen={params.add === "1"}>
        <ContributionForm entities={entities} sources={sources} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {contributions.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-slate-100">
                {nameOf(c.donorEntityId)} → {nameOf(c.recipientEntityId)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c.amount.toLocaleString()} {c.currency} · {new Date(c.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/contributions/${c.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton
                id={c.id}
                label={`${nameOf(c.donorEntityId)} → ${nameOf(c.recipientEntityId)}`}
                action={deleteContributionAction}
              />
            </div>
          </li>
        ))}
        {contributions.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No contributions yet. Add the first one above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
