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
      type: "politician",
      name: "",
      description: "",
      biography: "",
      imageUrl: "",
      websiteUrl: "",
      xUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      youtubeUrl: "",
      linkedinUrl: "",
      highlights: "",
      metadata: "",
      bioguideId: "",
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
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} placeholder="e.g. Steve Bannon" {...register("name")} />
      </Field>

      <Field label="Occupation / short description" htmlFor="description" error={errors.description?.message}>
        <textarea id="description" rows={2} className={inputClass} {...register("description")} />
      </Field>

      <Field label="Expanded biography" htmlFor="biography" error={errors.biography?.message}>
        <textarea
          id="biography"
          rows={7}
          className={inputClass}
          placeholder="Background, career, political significance, positions, and other useful context…"
          {...register("biography")}
        />
      </Field>

      <Field label="Profile image URL" htmlFor="imageUrl" error={errors.imageUrl?.message}>
        <input
          id="imageUrl"
          type="url"
          className={inputClass}
          placeholder="https://…"
          {...register("imageUrl")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["websiteUrl", "Website"],
          ["xUrl", "X / Twitter"],
          ["facebookUrl", "Facebook"],
          ["instagramUrl", "Instagram"],
          ["youtubeUrl", "YouTube"],
          ["linkedinUrl", "LinkedIn"],
        ] as const).map(([name, label]) => (
          <Field key={name} label={label} htmlFor={name} error={errors[name]?.message}>
            <input
              id={name}
              type="url"
              className={inputClass}
              placeholder="https://…"
              {...register(name)}
            />
          </Field>
        ))}
      </div>

      <Field label="Highlights (one per line)" htmlFor="highlights" error={errors.highlights?.message}>
        <textarea
          id="highlights"
          rows={3}
          className={inputClass}
          placeholder={"Led the 2024 transition team\nFormer chief strategist"}
          {...register("highlights")}
        />
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

      <Field
        label="Bioguide ID (optional)"
        htmlFor="bioguideId"
        error={errors.bioguideId?.message}
      >
        <input
          id="bioguideId"
          className={`${inputClass} font-mono text-xs`}
          placeholder="e.g. P000197, the Congress crosswalk key for a legislator"
          {...register("bioguideId")}
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
