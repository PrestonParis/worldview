"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  contributionSchema,
  contributionTypes,
  type ContributionInput,
} from "@/lib/validation/contribution";
import { INDUSTRY_SLUGS, industryLabel } from "@/lib/money";
import { createContributionAction, updateContributionAction } from "@/lib/actions/contributions";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/validation/entity";
import type { Source } from "@/lib/validation/source";

export function ContributionForm({
  id,
  defaultValues,
  entities,
  sources,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<ContributionInput>;
  entities: Entity[];
  sources: Source[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContributionInput>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      donorEntityId: "",
      recipientEntityId: "",
      amount: "",
      currency: "USD",
      date: "",
      sourceRecordId: "",
      notes: "",
      contributionType: "",
      donorIndustry: "",
      donorState: "",
      donorCity: "",
      donorZip: "",
      employer: "",
      occupation: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: ContributionInput) => {
    setServerError(null);
    const result = id
      ? await updateContributionAction(id, data)
      : await createContributionAction(data);
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
        Add at least one entity first; a contribution needs a donor and a recipient.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Donor" htmlFor="donorEntityId" error={errors.donorEntityId?.message}>
          <select id="donorEntityId" className={inputClass} {...register("donorEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recipient" htmlFor="recipientEntityId" error={errors.recipientEntityId?.message}>
          <select id="recipientEntityId" className={inputClass} {...register("recipientEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
          <input id="amount" type="number" min={0} step="1" className={inputClass} {...register("amount")} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={errors.currency?.message}>
          <input id="currency" className={inputClass} placeholder="USD" {...register("currency")} />
        </Field>
        <Field label="Date" htmlFor="date" error={errors.date?.message}>
          <input id="date" type="date" className={inputClass} {...register("date")} />
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

      <fieldset className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <legend className="px-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
          Classification (optional)
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Donor type" htmlFor="contributionType" error={errors.contributionType?.message}>
            <select id="contributionType" className={inputClass} {...register("contributionType")}>
              <option value="">(none)</option>
              {contributionTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Donor industry" htmlFor="donorIndustry" error={errors.donorIndustry?.message}>
            <select id="donorIndustry" className={inputClass} {...register("donorIndustry")}>
              <option value="">(none)</option>
              {INDUSTRY_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {industryLabel(slug)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Field label="Donor city" htmlFor="donorCity" error={errors.donorCity?.message}>
            <input id="donorCity" className={inputClass} {...register("donorCity")} />
          </Field>
          <Field label="Donor state" htmlFor="donorState" error={errors.donorState?.message}>
            <input id="donorState" className={inputClass} placeholder="e.g. NY" {...register("donorState")} />
          </Field>
          <Field label="Donor ZIP" htmlFor="donorZip" error={errors.donorZip?.message}>
            <input id="donorZip" className={inputClass} {...register("donorZip")} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Employer" htmlFor="employer" error={errors.employer?.message}>
            <input id="employer" className={inputClass} {...register("employer")} />
          </Field>
          <Field label="Occupation" htmlFor="occupation" error={errors.occupation?.message}>
            <input id="occupation" className={inputClass} {...register("occupation")} />
          </Field>
        </div>
      </fieldset>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add contribution"}
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
