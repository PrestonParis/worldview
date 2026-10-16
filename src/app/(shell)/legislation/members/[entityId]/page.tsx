import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/db/entities";
import { listVoterRollCallVotes, votesByRollCall } from "@/lib/db/votingRecord";
import { brokeWithParty, normalizeParty } from "@/lib/legislation/votingRecord";
import { MemberVotingRecord } from "@/components/legislation/member-voting-record";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

// Nothing prebuilt; each page is rendered on first request, then cached.
export async function generateStaticParams() {
  return [];
}

export default async function MemberVotingRecordPage({
  params,
}: PageProps<"/legislation/members/[entityId]">) {
  const { entityId } = await params;
  const [entity, votes] = await Promise.all([
    getEntity(entityId),
    listVoterRollCallVotes(entityId),
  ]);
  if (!entity) notFound();

  const rollCallVotes = await votesByRollCall(votes.map((v) => v.rollCallId));

  const rows = votes.map((v) => {
    const all = rollCallVotes.get(v.rollCallId) ?? [];
    return {
      ...v,
      broke: brokeWithParty(
        { voterEntityId: entityId, position: v.position, party: v.party },
        all,
      ),
    };
  });

  const decisive = rows.filter((r) => r.position === "yea" || r.position === "nay");
  const broke = decisive.filter((r) => r.broke);
  const partyLineRate =
    decisive.length === 0 ? null : 1 - broke.length / decisive.length;
  const party = normalizeParty(rows.find((r) => r.party)?.party ?? "");

  const policyAreas = [
    ...new Set(rows.map((r) => r.policyArea).filter((p): p is string => Boolean(p))),
  ].sort();

  return (
    <div className="max-w-3xl">
      <Link
        href="/legislation"
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ← Legislation
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{entity.name}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Voting record{party ? ` · ${party}` : ""} ·{" "}
        <Link href={`/data/entities/${entity.id}`} className="underline underline-offset-2">
          profile
        </Link>
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          No roll-call votes recorded for this member yet.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat label="Roll-call votes" value={rows.length} />
            <Stat
              label="Party-line rate"
              value={partyLineRate == null ? "—" : `${Math.round(partyLineRate * 100)}%`}
            />
            <Stat label="Broke with party" value={broke.length} />
          </div>

          <MemberVotingRecord rows={rows} policyAreas={policyAreas} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
