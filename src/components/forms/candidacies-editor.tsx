"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCandidacyAction,
  deleteCandidacyAction,
} from "@/lib/actions/candidacies";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Candidacy } from "@/lib/validation/candidacy";
import type { Entity } from "@/lib/validation/entity";

export function CandidaciesEditor({
  electionId,
  candidacies,
  entities,
}: {
  electionId: string;
  candidacies: Candidacy[];
  entities: Entity[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [candidateEntityId, setCandidateEntityId] = useState("");
  const [party, setParty] = useState("");
  const [votes, setVotes] = useState("");
  const [won, setWon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const politicians = entities.filter((e) => e.type === "politician");
  const entityById = new Map(entities.map((e) => [e.id, e]));
  // Candidates already on the ballot for this election; matches the
  // candidacies_election_candidate_unique constraint, so the picker can't
  // offer a choice the server would reject.
  const taken = new Set(candidacies.map((c) => c.candidateEntityId));
  const available = politicians.filter((e) => !taken.has(e.id));

  function resetForm() {
    setCandidateEntityId("");
    setParty("");
    setVotes("");
    setWon(false);
  }

  function handleAdd() {
    if (!candidateEntityId) return;
    setError(null);
    startTransition(async () => {
      const result = await createCandidacyAction({
        electionId,
        candidateEntityId,
        party,
        votes,
        won,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCandidacyAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Candidates</h2>

      <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {candidacies.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {entityById.get(c.candidateEntityId)?.name ?? "Unknown"}
              <span className="text-slate-500 dark:text-slate-400">
                {c.party ? ` (${c.party})` : ""}
                {c.votes != null ? ` · ${c.votes.toLocaleString()} votes` : ""}
                {c.won ? " · Winner" : ""}
              </span>
            </span>
            <Button
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={() => handleDelete(c.id)}
            >
              Remove
            </Button>
          </li>
        ))}
        {candidacies.length === 0 ? (
          <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
            No candidates recorded yet.
          </p>
        ) : null}
      </ul>

      {available.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {politicians.length === 0
            ? "Add at least one politician entity first; a candidacy needs a candidate."
            : "Every politician entity is already on this ballot."}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={candidateEntityId}
            onChange={(e) => setCandidateEntityId(e.target.value)}
            className={`${inputClass} w-auto`}
          >
            <option value="">Select candidate…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder="Party"
            className={`${inputClass} w-32`}
          />
          <input
            value={votes}
            onChange={(e) => setVotes(e.target.value)}
            inputMode="numeric"
            placeholder="Votes"
            className={`${inputClass} w-28`}
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={won}
              onChange={(e) => setWon(e.target.checked)}
            />
            Winner
          </label>
          <Button
            type="button"
            disabled={isPending || !candidateEntityId}
            onClick={handleAdd}
          >
            {isPending ? "Adding…" : "Add candidate"}
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
