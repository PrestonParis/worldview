"use client";

import { useState, cloneElement, isValidElement, type ReactElement } from "react";
import { Button } from "@/components/ui/button";

type WithOnDone = { onDone?: () => void };

export function AddPanel({
  label,
  children,
}: {
  label: string;
  children: ReactElement<WithOnDone>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  const close = () => setOpen(false);

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      {isValidElement(children) ? cloneElement(children, { onDone: close }) : children}
    </div>
  );
}
