"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { billSchema, billStatuses, type BillInput } from "@/lib/validation/bill";
import { formatBillStatus } from "@/components/legislation/bill-status";
import { createBillAction, updateBillAction } from "@/lib/actions/bills";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/validation/entity";

export function BillForm({
  id,
  defaultValues,
  entities,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<BillInput>;
  entities: Entity[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BillInput>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      billNumber: "",
      title: "",
      summary: "",
      status: "introduced",
      chamber: "",
      introducedDate: "",
      sponsorEntityId: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: BillInput) => {
    setServerError(null);
    const result = id ? await updateBillAction(id, data) : await createBillAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (!id) reset();
    router.refresh();
    onDone?.();
  };

  const politicians = entities.filter((e) => e.type === "politician");

  if (politicians.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add at least one politician entity first; a bill needs a sponsor.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bill number" htmlFor="billNumber" error={errors.billNumber?.message}>
          <input
            id="billNumber"
            className={inputClass}
            placeholder="e.g. H.R. 1234"
            {...register("billNumber")}
          />
        </Field>
        <Field label="Introduced date" htmlFor="introducedDate" error={errors.introducedDate?.message}>
          <input id="introducedDate" type="date" className={inputClass} {...register("introducedDate")} />
        </Field>
      </div>

      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <input id="title" className={inputClass} {...register("title")} />
      </Field>

      <Field label="Summary" htmlFor="summary" error={errors.summary?.message}>
        <textarea id="summary" rows={3} className={inputClass} {...register("summary")} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <select id="status" className={inputClass} {...register("status")}>
            {billStatuses.map((s) => (
              <option key={s} value={s}>
                {formatBillStatus(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chamber" htmlFor="chamber" error={errors.chamber?.message}>
          <input
            id="chamber"
            className={inputClass}
            placeholder="e.g. House, Senate"
            {...register("chamber")}
          />
        </Field>
      </div>

      <Field label="Sponsor" htmlFor="sponsorEntityId" error={errors.sponsorEntityId?.message}>
        <select id="sponsorEntityId" className={inputClass} {...register("sponsorEntityId")}>
          <option value="">Select…</option>
          {politicians.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add bill"}
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
