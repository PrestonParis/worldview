import Link from "next/link";
import { ContributorOnly } from "@/components/auth/can-edit";
import { listElections } from "@/lib/db/elections";
import { ElectionForm } from "@/components/forms/election-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { ElectionStatusPill } from "@/components/elections/election-status";
import { deleteElectionAction } from "@/lib/actions/elections";

export default async function ElectionsPage({
  searchParams,
}: PageProps<"/data/elections">) {
  const [elections, params] = await Promise.all([listElections(), searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add election" defaultOpen={params.add === "1"}>
        <ElectionForm elections={elections} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {elections.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-slate-900 dark:text-slate-100">{e.name}</p>
                <ElectionStatusPill status={e.status} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {e.office} · {e.jurisdiction}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ContributorOnly>
                <Link
                  href={`/data/elections/${e.id}/edit`}
                  className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Edit
                </Link>
              </ContributorOnly>
              <DeleteButton id={e.id} label={e.name} action={deleteElectionAction} />
            </div>
          </li>
        ))}
        {elections.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No elections yet. Add the first one above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
