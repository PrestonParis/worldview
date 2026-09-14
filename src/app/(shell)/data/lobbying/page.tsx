import Link from "next/link";
import { listLobbyingRegistrations } from "@/lib/db/lobbying";
import { listEntities } from "@/lib/neo4j/entities";
import { LobbyingForm } from "@/components/forms/lobbying-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteLobbyingRegistrationAction } from "@/lib/actions/lobbying";
import { formatAmount } from "@/lib/money";

export default async function LobbyingPage({
  searchParams,
}: PageProps<"/data/lobbying">) {
  const [registrations, entities, params] = await Promise.all([
    listLobbyingRegistrations(),
    listEntities(),
    searchParams,
  ]);
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add lobbying filing" defaultOpen={params.add === "1"}>
        <LobbyingForm entities={entities} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {registrations.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-slate-100">
                {nameOf(r.clientEntityId)} → {nameOf(r.registrantEntityId)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {r.year}
                {r.period ? ` · ${r.period}` : ""}
                {r.amount != null ? ` · ${formatAmount(r.amount, "USD")} ${r.amountKind || ""}` : ""}
                {r.issues.length > 0 ? ` · ${r.issues.length} issue${r.issues.length === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/lobbying/${r.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton
                id={r.id}
                label={`${nameOf(r.clientEntityId)} → ${nameOf(r.registrantEntityId)}`}
                action={deleteLobbyingRegistrationAction}
              />
            </div>
          </li>
        ))}
        {registrations.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No lobbying filings yet. Add one above or run{" "}
            <code>npm run import:lda-lobbying</code>.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
