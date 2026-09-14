import { listLobbyingRegistrations } from "@/lib/db/lobbying";
import { listBills } from "@/lib/db/bills";
import { listEntities } from "@/lib/neo4j/entities";
import { LobbyingView } from "@/components/money/lobbying-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [registrations, bills, entities] = await Promise.all([
    listLobbyingRegistrations(),
    listBills(),
    listEntities(),
  ]);

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-2xl font-semibold tracking-tight">Lobbying network</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Who lobbies for whom, from Senate LDA filings: client to firm, with the
        issues and bills named.
      </p>
      <div className="mt-6 flex-1">
        {registrations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No lobbying filings yet. Run <code>npm run import:lda-lobbying</code>, or add
            one in{" "}
            <a href="/data/lobbying" className="underline underline-offset-2">
              Manage Data
            </a>
            .
          </p>
        ) : (
          <LobbyingView registrations={registrations} entities={entities} bills={bills} />
        )}
      </div>
    </div>
  );
}
