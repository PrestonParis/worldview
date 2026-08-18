import Link from "next/link";
import { notFound } from "next/navigation";
import { getBill } from "@/lib/db/bills";
import { listVotesForBill } from "@/lib/db/votes";
import { listEntities } from "@/lib/neo4j/entities";
import { StatusPill } from "@/components/legislation/bill-status";
import { votePositions } from "@/lib/validation/vote";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const POSITION_LABEL: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  absent: "Absent",
};

export default async function BillDetailPage({
  params,
}: PageProps<"/legislation/[id]">) {
  const { id } = await params;
  const [bill, votes, entities] = await Promise.all([
    getBill(id),
    listVotesForBill(id),
    listEntities(),
  ]);
  if (!bill) notFound();

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const sponsor = entityById.get(bill.sponsorEntityId);

  const votesByPosition = votePositions.map((position) => ({
    position,
    votes: votes.filter((v) => v.position === position),
  }));

  return (
    <div className="max-w-3xl">
      <Link
        href="/legislation"
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ← Legislation
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
          {bill.billNumber}
        </span>
        <StatusPill status={bill.status} />
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{bill.title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Sponsored by{" "}
        {sponsor ? (
          <Link href={`/data/entities/${sponsor.id}`} className="underline underline-offset-2">
            {sponsor.name}
          </Link>
        ) : (
          "Unknown"
        )}
        {bill.chamber ? ` · ${bill.chamber}` : ""} · Introduced {formatDate(bill.introducedDate)}
      </p>

      {bill.summary ? (
        <p className="mt-4 text-slate-700 dark:text-slate-300">{bill.summary}</p>
      ) : null}

      <h2 className="mt-8 text-lg font-medium">Roll call</h2>
      {votes.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No votes recorded for this bill yet.</p>
      ) : (
        <>
          <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
            {votesByPosition.map(({ position, votes: v }) => `${v.length} ${POSITION_LABEL[position]}`).join(" · ")}
          </p>
          <div className="mt-4 flex flex-col gap-5">
            {votesByPosition
              .filter(({ votes: v }) => v.length > 0)
              .map(({ position, votes: v }) => (
                <div key={position}>
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {POSITION_LABEL[position]} ({v.length})
                  </h3>
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {v.map((vote) => {
                      const voter = entityById.get(vote.voterEntityId);
                      return (
                        <li key={vote.id} className="text-sm text-slate-700 dark:text-slate-300">
                          {voter ? (
                            <Link
                              href={`/data/entities/${voter.id}`}
                              className="underline underline-offset-2"
                            >
                              {voter.name}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
