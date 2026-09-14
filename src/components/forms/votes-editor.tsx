"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVoteAction, deleteVoteAction } from "@/lib/actions/votes";
import { votePositions } from "@/lib/validation/vote";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Vote } from "@/lib/validation/vote";
import type { Entity } from "@/lib/validation/entity";

const POSITION_LABEL: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  absent: "Absent",
};

export function VotesEditor({
  billId,
  votes,
  entities,
}: {
  billId: string;
  votes: Vote[];
  entities: Entity[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [voterEntityId, setVoterEntityId] = useState("");
  const [position, setPosition] = useState<(typeof votePositions)[number]>("yea");
  const [error, setError] = useState<string | null>(null);

  const politicians = entities.filter((e) => e.type === "politician");
  const entityById = new Map(entities.map((e) => [e.id, e]));
  // Politicians who already have a recorded vote on this bill — matches
  // the votes_bill_voter_unique constraint, so the picker can't offer a
  // choice the server would just reject.
  const alreadyVoted = new Set(votes.map((v) => v.voterEntityId));
  const available = politicians.filter((e) => !alreadyVoted.has(e.id));

  function handleAdd() {
    if (!voterEntityId) return;
    setError(null);
    startTransition(async () => {
      const result = await createVoteAction({ billId, voterEntityId, position });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setVoterEntityId("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteVoteAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Votes</h2>

      <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {votes.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {entityById.get(v.voterEntityId)?.name ?? "Unknown"}:{" "}
              <span className="text-slate-500 dark:text-slate-400">{POSITION_LABEL[v.position]}</span>
            </span>
            <Button type="button" variant="danger" disabled={isPending} onClick={() => handleDelete(v.id)}>
              Remove
            </Button>
          </li>
        ))}
        {votes.length === 0 ? (
          <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No votes recorded yet.</p>
        ) : null}
      </ul>

      {available.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Every politician entity already has a recorded vote on this bill.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={voterEntityId}
            onChange={(e) => setVoterEntityId(e.target.value)}
            className={`${inputClass} w-auto`}
          >
            <option value="">Select politician…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as (typeof votePositions)[number])}
            className={`${inputClass} w-auto`}
          >
            {votePositions.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
          <Button type="button" disabled={isPending || !voterEntityId} onClick={handleAdd}>
            {isPending ? "Adding…" : "Add vote"}
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
