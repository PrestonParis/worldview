"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { edgeSchema, type EdgeInput } from "@/lib/validation/edge";
import { createEdgeAction } from "@/lib/actions/edges";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/validation/entity";
import type { Source } from "@/lib/validation/source";

export function EdgeForm({
  entities,
  sources,
  onDone,
}: {
  entities: Entity[];
  sources: Source[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EdgeInput>({
    resolver: zodResolver(edgeSchema),
    defaultValues: {
      sourceEntityId: "",
      targetEntityId: "",
      label: "",
      validFrom: "",
      validTo: "",
      notes: "",
      sourceRecordId: "",
    },
  });

  const onSubmit = async (data: EdgeInput) => {
    setServerError(null);
    const result = await createEdgeAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    reset();
    router.refresh();
    onDone?.();
  };

  if (entities.length < 2) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add at least two entities first — a relationship needs both ends.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="From" htmlFor="sourceEntityId" error={errors.sourceEntityId?.message}>
          <select id="sourceEntityId" className={inputClass} {...register("sourceEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To" htmlFor="targetEntityId" error={errors.targetEntityId?.message}>
          <select id="targetEntityId" className={inputClass} {...register("targetEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Relationship" htmlFor="label" error={errors.label?.message}>
        <input id="label" className={inputClass} placeholder="e.g. endorsed, employed by, donated to" {...register("label")} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valid from" htmlFor="validFrom" error={errors.validFrom?.message}>
          <input id="validFrom" type="date" className={inputClass} {...register("validFrom")} />
        </Field>
        <Field label="Valid to" htmlFor="validTo" error={errors.validTo?.message}>
          <input id="validTo" type="date" className={inputClass} {...register("validTo")} />
        </Field>
      </div>

      <Field label="Evidence source" htmlFor="sourceRecordId" error={errors.sourceRecordId?.message}>
        <select id="sourceRecordId" className={inputClass} {...register("sourceRecordId")}>
          <option value="">None</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={2} className={inputClass} {...register("notes")} />
      </Field>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Add relationship"}
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
