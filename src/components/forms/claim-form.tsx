"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { claimSchema, type ClaimInput } from "@/lib/validation/claim";
import { createClaimAction, updateClaimAction } from "@/lib/actions/claims";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/validation/entity";
import type { Source } from "@/lib/validation/source";
import type { Claim } from "@/lib/validation/claim";

export function ClaimForm({
  id,
  defaultValues,
  entities,
  sources,
  claims,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<ClaimInput>;
  entities: Entity[];
  sources: Source[];
  claims: Claim[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      speakerEntityId: "",
      date: "",
      venue: "",
      quote: "",
      topic: "",
      positionClassification: "",
      contradictsClaimId: "",
      sourceId: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: ClaimInput) => {
    setServerError(null);
    const result = id ? await updateClaimAction(id, data) : await createClaimAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (!id) reset();
    router.refresh();
    onDone?.();
  };

  if (entities.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add at least one entity first — a claim needs a speaker.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Speaker" htmlFor="speakerEntityId" error={errors.speakerEntityId?.message}>
          <select id="speakerEntityId" className={inputClass} {...register("speakerEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor="date" error={errors.date?.message}>
          <input id="date" type="date" className={inputClass} {...register("date")} />
        </Field>
      </div>

      <Field label="Quote" htmlFor="quote" error={errors.quote?.message}>
        <textarea id="quote" rows={3} className={inputClass} {...register("quote")} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Venue" htmlFor="venue" error={errors.venue?.message}>
          <input id="venue" className={inputClass} placeholder="e.g. Fox News interview" {...register("venue")} />
        </Field>
        <Field label="Topic" htmlFor="topic" error={errors.topic?.message}>
          <input id="topic" className={inputClass} placeholder="e.g. Immigration" {...register("topic")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Position classification"
          htmlFor="positionClassification"
          error={errors.positionClassification?.message}
        >
          <input
            id="positionClassification"
            className={inputClass}
            placeholder="e.g. supports, opposes, mixed"
            {...register("positionClassification")}
          />
        </Field>
        <Field label="Confidence (0–100)" htmlFor="confidence" error={errors.confidence?.message}>
          <input id="confidence" type="number" min={0} max={100} className={inputClass} {...register("confidence")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Source" htmlFor="sourceId" error={errors.sourceId?.message}>
          <select id="sourceId" className={inputClass} {...register("sourceId")}>
            <option value="">None</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contradicts claim" htmlFor="contradictsClaimId" error={errors.contradictsClaimId?.message}>
          <select id="contradictsClaimId" className={inputClass} {...register("contradictsClaimId")}>
            <option value="">None</option>
            {claims
              .filter((c) => c.id !== id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.quote.slice(0, 60)}
                </option>
              ))}
          </select>
        </Field>
      </div>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add claim"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
