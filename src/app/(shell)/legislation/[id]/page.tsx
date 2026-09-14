import Link from "next/link";
import { notFound } from "next/navigation";
import { getBill } from "@/lib/db/bills";
import { listVotesForBill, listVotesForRollCall } from "@/lib/db/votes";
import { listRollCallsForBill } from "@/lib/db/rollCalls";
import {
  listCosponsors,
  listActions,
  listCommittees,
  listRelations,
  listTextVersions,
} from "@/lib/db/billDetails";
import { listEntities } from "@/lib/neo4j/entities";
import { StatusPill } from "@/components/legislation/bill-status";
import { votePositions, type Vote } from "@/lib/validation/vote";
import type { Entity } from "@/lib/validation/entity";

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

function RollCallBreakdown({
  votes,
  entityById,
}: {
  votes: Vote[];
  entityById: Map<string, Entity>;
}) {
  const byPosition = votePositions.map((position) => ({
    position,
    votes: votes.filter((v) => v.position === position),
  }));
  return (
    <>
      <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
        {byPosition
          .map(({ position, votes: v }) => `${v.length} ${POSITION_LABEL[position]}`)
          .join(" · ")}
      </p>
      <div className="mt-3 flex flex-col gap-4">
        {byPosition
          .filter(({ votes: v }) => v.length > 0)
          .map(({ position, votes: v }) => (
            <div key={position}>
              <h4 className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {POSITION_LABEL[position]} ({v.length})
              </h4>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {v.map((vote) => {
                  const voter = entityById.get(vote.voterEntityId);
                  return (
                    <li key={vote.id} className="text-sm text-slate-700 dark:text-slate-300">
                      {voter ? (
                        <Link
                          href={`/legislation/members/${voter.id}`}
                          className="underline underline-offset-2"
                        >
                          {voter.name}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                      {vote.party ? (
                        <span className="text-slate-400"> ({vote.party})</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>
    </>
  );
}

export default async function BillDetailPage({
  params,
}: PageProps<"/legislation/[id]">) {
  const { id } = await params;
  const [bill, billVotes, rollCalls, cosponsors, actions, committees, relations, textVersions, entities] =
    await Promise.all([
      getBill(id),
      listVotesForBill(id),
      listRollCallsForBill(id),
      listCosponsors(id),
      listActions(id),
      listCommittees(id),
      listRelations(id),
      listTextVersions(id),
      listEntities(),
    ]);
  if (!bill) notFound();

  const rollCallVotes = await Promise.all(
    rollCalls.map((rc) => listVotesForRollCall(rc.id)),
  );

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const sponsor = bill.sponsorEntityId
    ? entityById.get(bill.sponsorEntityId)
    : undefined;
  const subjects = bill.subjects
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

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

      {bill.policyArea || subjects.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {bill.policyArea ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {bill.policyArea}
            </span>
          ) : null}
          {subjects.map((s) => (
            <span
              key={s}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {bill.latestActionText ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Latest action{bill.latestActionDate ? ` (${formatDate(bill.latestActionDate)})` : ""}:{" "}
          {bill.latestActionText}
        </p>
      ) : null}

      {cosponsors.length > 0 ? (
        <details className="group mt-6">
          <summary className="cursor-pointer list-none text-lg font-medium">
            Cosponsors ({cosponsors.length})
            <span className="ml-2 text-xs font-normal text-slate-400 group-open:hidden">
              show
            </span>
          </summary>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {cosponsors.map((c) => {
              const e = entityById.get(c.entityId);
              return (
                <li key={c.id} className="text-sm text-slate-700 dark:text-slate-300">
                  {e ? (
                    <Link href={`/data/entities/${e.id}`} className="underline underline-offset-2">
                      {e.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                  {c.isOriginal ? <span className="text-slate-400"> (original)</span> : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {actions.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Timeline</h2>
          <ol className="mt-3 border-l border-slate-200 dark:border-slate-800">
            {actions.map((a) => (
              <li key={a.id} className="relative pl-5 pb-4 last:pb-0">
                <span className="absolute -left-0.75 top-1.5 h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                <p className="text-xs tabular-nums text-slate-400">
                  {formatDate(a.date)}
                  {a.chamber ? ` · ${a.chamber}` : ""}
                  {a.actionType ? ` · ${a.actionType}` : ""}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{a.text}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {committees.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Committees</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {committees.map((c) => (
              <li key={c.id} className="text-sm text-slate-700 dark:text-slate-300">
                {c.name}
                {c.chamber ? <span className="text-slate-400"> · {c.chamber}</span> : null}
                {c.activity ? <span className="text-slate-400"> · {c.activity}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {rollCalls.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">
            Roll calls ({rollCalls.length})
          </h2>
          <div className="mt-3 flex flex-col gap-6">
            {rollCalls.map((rc, i) => (
              <div key={rc.id}>
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {rc.chamber} Roll Call {rc.rollNumber}
                  {rc.question ? `: ${rc.question}` : ""}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatDate(rc.date)}
                  {rc.result ? ` · ${rc.result}` : ""}
                </p>
                <RollCallBreakdown votes={rollCallVotes[i]} entityById={entityById} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {billVotes.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Recorded vote</h2>
          <RollCallBreakdown votes={billVotes} entityById={entityById} />
        </>
      ) : null}

      {rollCalls.length === 0 && billVotes.length === 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Roll calls</h2>
          <p className="mt-2 text-sm text-slate-400">
            No votes recorded for this bill yet.
          </p>
        </>
      ) : null}

      {relations.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Related bills</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {relations.map((r) => (
              <li key={r.id} className="text-sm text-slate-700 dark:text-slate-300">
                {r.relatedBillId ? (
                  <Link
                    href={`/legislation/${r.relatedBillId}`}
                    className="underline underline-offset-2"
                  >
                    {r.relatedBillNumber || r.relatedExternalId}
                  </Link>
                ) : (
                  <span>{r.relatedBillNumber || r.relatedExternalId}</span>
                )}
                {r.relatedTitle ? <span className="text-slate-500">: {r.relatedTitle}</span> : null}
                {r.relationshipType ? (
                  <span className="text-slate-400"> ({r.relationshipType})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {textVersions.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-medium">Text</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {textVersions.map((t) => (
              <li key={t.id} className="text-sm">
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 underline underline-offset-2 dark:text-slate-300"
                >
                  {t.versionType || "Full text"}
                  {t.format ? ` (${t.format})` : ""}
                </a>
                {t.date ? <span className="text-slate-400"> · {formatDate(t.date)}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
