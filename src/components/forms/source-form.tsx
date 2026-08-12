"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { sourceSchema, sourceTypes, type SourceInput } from "@/lib/validation/source";
import { createSourceAction, updateSourceAction } from "@/lib/actions/sources";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function SourceForm({
  id,
  defaultValues,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<SourceInput>;
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SourceInput>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      title: "",
      url: "",
      publisher: "",
      sourceType: "secondary",
      publishedAt: "",
      notes: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: SourceInput) => {
    setServerError(null);
    const result = id ? await updateSourceAction(id, data) : await createSourceAction(data);
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
      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <input id="title" className={inputClass} placeholder="e.g. White House press briefing, Aug 12" {...register("title")} />
      </Field>

      <Field label="URL" htmlFor="url" error={errors.url?.message}>
        <input id="url" className={inputClass} placeholder="https://..." {...register("url")} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Publisher" htmlFor="publisher" error={errors.publisher?.message}>
          <input id="publisher" className={inputClass} {...register("publisher")} />
        </Field>
        <Field label="Type" htmlFor="sourceType" error={errors.sourceType?.message}>
          <select id="sourceType" className={inputClass} {...register("sourceType")}>
            {sourceTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Published" htmlFor="publishedAt" error={errors.publishedAt?.message}>
        <input id="publishedAt" type="date" className={inputClass} {...register("publishedAt")} />
      </Field>

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={2} className={inputClass} {...register("notes")} />
      </Field>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add source"}
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
