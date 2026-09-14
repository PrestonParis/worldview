"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  lobbyingRegistrationSchema,
  lobbyingAmountKinds,
  type LobbyingRegistrationInput,
} from "@/lib/validation/lobbying";
import {
  createLobbyingRegistrationAction,
  updateLobbyingRegistrationAction,
} from "@/lib/actions/lobbying";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/validation/entity";

export function LobbyingForm({
  id,
  defaultValues,
  defaultIssuesText,
  entities,
  onDone,
}: {
  id?: string;
  defaultValues?: Partial<LobbyingRegistrationInput>;
  defaultIssuesText?: string;
  entities: Entity[];
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [issuesText, setIssuesText] = useState(defaultIssuesText ?? "");
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LobbyingRegistrationInput>({
    resolver: zodResolver(lobbyingRegistrationSchema),
    defaultValues: {
      clientEntityId: "",
      registrantEntityId: "",
      year: String(new Date().getFullYear()),
      period: "",
      amount: "",
      amountKind: "",
      notes: "",
      ...defaultValues,
    },
  });

  const onSubmit = async (data: LobbyingRegistrationInput) => {
    setServerError(null);
    const issues = issuesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ issueLabel: line }));
    const payload = { ...data, issues };
    const result = id
      ? await updateLobbyingRegistrationAction(id, payload)
      : await createLobbyingRegistrationAction(payload);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (!id) {
      reset();
      setIssuesText("");
    }
    router.refresh();
    onDone?.();
  };

  if (entities.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add a client entity and a lobbying-firm entity first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Client" htmlFor="clientEntityId" error={errors.clientEntityId?.message}>
          <select id="clientEntityId" className={inputClass} {...register("clientEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Lobbying firm (registrant)"
          htmlFor="registrantEntityId"
          error={errors.registrantEntityId?.message}
        >
          <select id="registrantEntityId" className={inputClass} {...register("registrantEntityId")}>
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Field label="Year" htmlFor="year" error={errors.year?.message}>
          <input id="year" className={inputClass} {...register("year")} />
        </Field>
        <Field label="Period" htmlFor="period" error={errors.period?.message}>
          <input id="period" className={inputClass} placeholder="e.g. Q1" {...register("period")} />
        </Field>
        <Field label="Amount (USD)" htmlFor="amount" error={errors.amount?.message}>
          <input id="amount" type="number" min={0} className={inputClass} {...register("amount")} />
        </Field>
        <Field label="Amount is" htmlFor="amountKind" error={errors.amountKind?.message}>
          <select id="amountKind" className={inputClass} {...register("amountKind")}>
            <option value="">(none)</option>
            {lobbyingAmountKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Issues (one per line)" htmlFor="issuesText">
        <textarea
          id="issuesText"
          rows={3}
          className={inputClass}
          placeholder={"Taxation\nDefense appropriations"}
          value={issuesText}
          onChange={(e) => setIssuesText(e.target.value)}
        />
      </Field>

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={2} className={inputClass} {...register("notes")} />
      </Field>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : id ? "Save changes" : "Add filing"}
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
