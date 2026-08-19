"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClaimVerdictAction } from "@/lib/actions/claims";
import { claimVerdicts } from "@/lib/validation/claim";
import { formatVerdict } from "./verdict-pill";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function VerdictEditor({
  claimId,
  verdict,
  verdictNotes,
  onDone,
}: {
  claimId: string;
  verdict: string;
  verdictNotes: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextVerdict, setNextVerdict] = useState(verdict);
  const [notes, setNotes] = useState(verdictNotes);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setClaimVerdictAction(claimId, {
        verdict: nextVerdict as (typeof claimVerdicts)[number] | "",
        verdictNotes: notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div
      className="mt-2 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={nextVerdict}
        onChange={(e) => setNextVerdict(e.target.value)}
        className={inputClass}
      >
        <option value="">Unverified</option>
        {claimVerdicts.map((v) => (
          <option key={v} value={v}>
            {formatVerdict(v)}
          </option>
        ))}
      </select>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Evidence / reasoning…"
        className={inputClass}
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save verdict"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
