import Link from "next/link";
import { listSources } from "@/lib/db/sources";
import { SourceForm } from "@/components/forms/source-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteSourceAction } from "@/lib/actions/sources";

export default async function SourcesPage() {
  const sources = await listSources();

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add source">
        <SourceForm />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.sourceType.replace("_", " ")}
                {s.publisher ? ` · ${s.publisher}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/sources/${s.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton id={s.id} label={s.title} action={deleteSourceAction} />
            </div>
          </li>
        ))}
        {sources.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No sources yet — add the first article, filing, or transcript above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
