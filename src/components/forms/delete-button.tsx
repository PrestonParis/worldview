"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/components/auth/can-edit";
import type { ActionResult } from "@/lib/actions/entities";

export function DeleteButton({
  id,
  label,
  action,
}: {
  id: string;
  label: string;
  action: (id: string) => Promise<ActionResult<null>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const canEdit = useCanEdit();

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await action(id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
}
