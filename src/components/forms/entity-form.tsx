"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { entitySchema, entityTypes, type EntityInput } from "@/lib/validation/entity";
import { createEntityAction, updateEntityAction } from "@/lib/actions/entities";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function EntityForm({
  id,
  defaultValues,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<EntityInput>;
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EntityInput>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      type: "person",
      name: "",
      description: "",
      metadata: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: EntityInput) => {
    setServerError(null);
    const result = id
      ? await updateEntityAction(id, data)
      : await createEntityAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (!id) reset();
    router.refresh();
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Type" htmlFor="type" error={errors.type?.message}>
        <select id="type" className={inputClass} {...register("type")}>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} placeholder="e.g. Steve Bannon" {...register("name")} />
      </Field>

      <Field label="Description" htmlFor="description" error={errors.description?.message}>
        <textarea id="description" rows={2} className={inputClass} {...register("description")} />
      </Field>

      <Field label="Metadata (JSON, optional)" htmlFor="metadata" error={errors.metadata?.message}>
        <textarea
          id="metadata"
          rows={2}
          className={`${inputClass} font-mono text-xs`}
          placeholder='{"party": "R", "role": "commentator"}'
          {...register("metadata")}
        />
      </Field>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add entity"}
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
