import Link from "next/link";
import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { ClaimForm } from "@/components/forms/claim-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteClaimAction } from "@/lib/actions/claims";

export default async function ClaimsPage() {
  const [claims, entities, sources] = await Promise.all([
    listClaims(),
    listEntities(),
    listSources(),
  ]);
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add claim">
        <ClaimForm entities={entities} sources={sources} claims={claims} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {claims.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-slate-900 dark:text-slate-100">&ldquo;{c.quote}&rdquo;</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {nameOf(c.speakerEntityId)} · {new Date(c.date).toLocaleDateString()}
                {c.topic ? ` · ${c.topic}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/claims/${c.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton id={c.id} label={c.quote.slice(0, 40)} action={deleteClaimAction} />
            </div>
          </li>
        ))}
        {claims.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No claims yet — add the first quote above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
