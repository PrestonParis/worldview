"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  electionSchema,
  electionLevels,
  electionTypes,
  electionStatuses,
  type ElectionInput,
} from "@/lib/validation/election";
import { formatElectionStatus } from "@/components/elections/election-status";
import { createElectionAction, updateElectionAction } from "@/lib/actions/elections";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Election } from "@/lib/validation/election";

function titleCase(s: string): string {
  return s.replace(/^./, (c) => c.toUpperCase());
}

export function ElectionForm({
  id,
  defaultValues,
  elections,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<ElectionInput>;
  elections: Election[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ElectionInput>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      name: "",
      office: "",
      jurisdiction: "",
      level: "federal",
      electionType: "general",
      status: "certified",
      electionDate: "",
      totalVotes: "",
      priorElectionId: "",
      parentElectionId: "",
      notes: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: ElectionInput) => {
    setServerError(null);
    const result = id
      ? await updateElectionAction(id, data)
      : await createElectionAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (!id) reset();
    router.refresh();
    onDone?.();
  };

  // Self-references can't point at the election being edited.
  const others = elections.filter((e) => e.id !== id);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          className={inputClass}
          placeholder="e.g. Wisconsin Governor 2026"
          {...register("name")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Office" htmlFor="office" error={errors.office?.message}>
          <input
            id="office"
            className={inputClass}
            placeholder="e.g. Governor, U.S. Senate, President"
            {...register("office")}
          />
        </Field>
        <Field
          label="Jurisdiction"
          htmlFor="jurisdiction"
          error={errors.jurisdiction?.message}
        >
          <input
            id="jurisdiction"
            className={inputClass}
            placeholder="e.g. Wisconsin, WI-03, United States"
            {...register("jurisdiction")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Level" htmlFor="level" error={errors.level?.message}>
          <select id="level" className={inputClass} {...register("level")}>
            {electionLevels.map((l) => (
              <option key={l} value={l}>
                {titleCase(l)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" htmlFor="electionType" error={errors.electionType?.message}>
          <select id="electionType" className={inputClass} {...register("electionType")}>
            {electionTypes.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <select id="status" className={inputClass} {...register("status")}>
            {electionStatuses.map((s) => (
              <option key={s} value={s}>
                {formatElectionStatus(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Election date"
          htmlFor="electionDate"
          error={errors.electionDate?.message}
        >
          <input
            id="electionDate"
            type="date"
            className={inputClass}
            {...register("electionDate")}
          />
        </Field>
        <Field
          label="Turnout (optional)"
          htmlFor="totalVotes"
          error={errors.totalVotes?.message}
        >
          <input
            id="totalVotes"
            inputMode="numeric"
            className={inputClass}
            placeholder="total ballots cast"
            {...register("totalVotes")}
          />
        </Field>
      </div>

      {others.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Prior comparable election"
            htmlFor="priorElectionId"
            error={errors.priorElectionId?.message}
          >
            <select id="priorElectionId" className={inputClass} {...register("priorElectionId")}>
              <option value="">(none)</option>
              {others.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Parent election (primary → general)"
            htmlFor="parentElectionId"
            error={errors.parentElectionId?.message}
          >
            <select id="parentElectionId" className={inputClass} {...register("parentElectionId")}>
              <option value="">(none)</option>
              {others.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={3} className={inputClass} {...register("notes")} />
      </Field>

      {serverError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add election"}
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
