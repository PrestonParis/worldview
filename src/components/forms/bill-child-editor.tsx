"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  createCosponsorAction,
  createActionAction,
  createCommitteeAction,
  createRelationAction,
  createTextVersionAction,
  deleteBillChildAction,
} from "@/lib/actions/billDetails";
import type { Entity } from "@/lib/validation/entity";
import type {
  BillCosponsor,
  BillAction,
  BillCommittee,
  BillRelation,
  BillTextVersion,
} from "@/lib/validation/billDetail";

type Kind = "cosponsor" | "action" | "committee" | "relation" | "textVersion";
type Row = BillCosponsor | BillAction | BillCommittee | BillRelation | BillTextVersion;

const TITLES: Record<Kind, string> = {
  cosponsor: "Cosponsors",
  action: "Timeline actions",
  committee: "Committees",
  relation: "Related bills",
  textVersion: "Text versions",
};

function describe(kind: Kind, row: Row, entityName: (id: string) => string): string {
  switch (kind) {
    case "cosponsor": {
      const r = row as BillCosponsor;
      return `${entityName(r.entityId)}${r.isOriginal ? " (original)" : ""}`;
    }
    case "action": {
      const r = row as BillAction;
      return `${r.date.slice(0, 10)}: ${r.text}`;
    }
    case "committee": {
      const r = row as BillCommittee;
      return [r.name, r.chamber, r.activity].filter(Boolean).join(" · ");
    }
    case "relation": {
      const r = row as BillRelation;
      return [r.relatedBillNumber || r.relatedExternalId, r.relatedTitle, r.relationshipType]
        .filter(Boolean)
        .join(" · ");
    }
    case "textVersion": {
      const r = row as BillTextVersion;
      return [r.versionType || "Full text", r.format, r.url].filter(Boolean).join(" · ");
    }
  }
}

export function BillChildEditor({
  billId,
  kind,
  rows,
  politicians = [],
}: {
  billId: string;
  kind: Kind;
  rows: Row[];
  politicians?: Entity[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});

  const entityName = (id: string) =>
    politicians.find((e) => e.id === id)?.name ?? "Unknown";

  function set(name: string, value: string | boolean) {
    setDraft((d) => ({ ...d, [name]: value }));
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      let result;
      if (kind === "cosponsor") {
        result = await createCosponsorAction({
          billId,
          entityId: String(draft.entityId ?? ""),
          date: String(draft.date ?? ""),
          isOriginal: Boolean(draft.isOriginal),
        });
      } else if (kind === "action") {
        result = await createActionAction({
          billId,
          date: String(draft.date ?? ""),
          chamber: String(draft.chamber ?? ""),
          text: String(draft.text ?? ""),
          actionType: String(draft.actionType ?? ""),
        });
      } else if (kind === "committee") {
        result = await createCommitteeAction({
          billId,
          name: String(draft.name ?? ""),
          chamber: String(draft.chamber ?? ""),
          activity: String(draft.activity ?? ""),
        });
      } else if (kind === "relation") {
        result = await createRelationAction({
          billId,
          relatedExternalId: String(draft.relatedExternalId ?? ""),
          relatedBillNumber: String(draft.relatedBillNumber ?? ""),
          relatedTitle: String(draft.relatedTitle ?? ""),
          relationshipType: String(draft.relationshipType ?? ""),
        });
      } else {
        result = await createTextVersionAction({
          billId,
          versionType: String(draft.versionType ?? ""),
          date: String(draft.date ?? ""),
          format: String(draft.format ?? ""),
          url: String(draft.url ?? ""),
        });
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft({});
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteBillChildAction(kind, id, billId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{TITLES[kind]}</h3>

      <ul className="mt-2 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-300">
              {describe(kind, row, entityName)}
            </span>
            <Button
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={() => handleDelete(row.id)}
            >
              Remove
            </Button>
          </li>
        ))}
        {rows.length === 0 ? (
          <p className="py-1.5 text-sm text-slate-500 dark:text-slate-400">None recorded.</p>
        ) : null}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {kind === "cosponsor" ? (
          <>
            <select
              value={String(draft.entityId ?? "")}
              onChange={(e) => set("entityId", e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="">Select politician…</option>
              {politicians.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.isOriginal)}
                onChange={(e) => set("isOriginal", e.target.checked)}
              />
              original
            </label>
          </>
        ) : null}

        {kind === "action" ? (
          <>
            <input type="date" className={`${inputClass} w-auto`} value={String(draft.date ?? "")} onChange={(e) => set("date", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="Chamber" value={String(draft.chamber ?? "")} onChange={(e) => set("chamber", e.target.value)} />
            <input className={`${inputClass} min-w-60 flex-1`} placeholder="Action text" value={String(draft.text ?? "")} onChange={(e) => set("text", e.target.value)} />
          </>
        ) : null}

        {kind === "committee" ? (
          <>
            <input className={`${inputClass} min-w-60 flex-1`} placeholder="Committee name" value={String(draft.name ?? "")} onChange={(e) => set("name", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="Chamber" value={String(draft.chamber ?? "")} onChange={(e) => set("chamber", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="Activity" value={String(draft.activity ?? "")} onChange={(e) => set("activity", e.target.value)} />
          </>
        ) : null}

        {kind === "relation" ? (
          <>
            <input className={`${inputClass} w-auto`} placeholder="Bill number" value={String(draft.relatedBillNumber ?? "")} onChange={(e) => set("relatedBillNumber", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="External id (119-hr-5)" value={String(draft.relatedExternalId ?? "")} onChange={(e) => set("relatedExternalId", e.target.value)} />
            <input className={`${inputClass} min-w-48 flex-1`} placeholder="Title" value={String(draft.relatedTitle ?? "")} onChange={(e) => set("relatedTitle", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="Relationship" value={String(draft.relationshipType ?? "")} onChange={(e) => set("relationshipType", e.target.value)} />
          </>
        ) : null}

        {kind === "textVersion" ? (
          <>
            <input className={`${inputClass} w-auto`} placeholder="Version (Introduced)" value={String(draft.versionType ?? "")} onChange={(e) => set("versionType", e.target.value)} />
            <input className={`${inputClass} w-auto`} placeholder="Format (PDF)" value={String(draft.format ?? "")} onChange={(e) => set("format", e.target.value)} />
            <input type="date" className={`${inputClass} w-auto`} value={String(draft.date ?? "")} onChange={(e) => set("date", e.target.value)} />
            <input className={`${inputClass} min-w-60 flex-1`} placeholder="https://…" value={String(draft.url ?? "")} onChange={(e) => set("url", e.target.value)} />
          </>
        ) : null}

        <Button type="button" disabled={isPending} onClick={handleAdd}>
          {isPending ? "Saving…" : "Add"}
        </Button>
      </div>

      {error ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
