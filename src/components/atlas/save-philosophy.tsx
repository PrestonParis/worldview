"use client";

import { useEffect, useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { savePhilosophyAction } from "@/lib/actions/atlas";
import { useSession } from "@/components/auth/can-edit";
import { savedPhilosophiesSchema } from "@/lib/atlas/profile-schema";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";

const LOCAL_KEY = "worldview-atlas-saved-philosophies";

function localIds(): string[] {
  const parsed = savedPhilosophiesSchema.safeParse(readStoredJson("local", LOCAL_KEY));
  return parsed.success ? parsed.data : [];
}

export function SavePhilosophy({ id, initial = false }: { id: string; initial?: boolean }) {
  const session = useSession();
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (localIds().includes(id)) queueMicrotask(() => setSaved(true));
  }, [id]);

  const toggle = () => {
    const next = !saved;
    setSaved(next);
    const ids = localIds();
    writeStoredJson("local", LOCAL_KEY, next ? [...new Set([...ids, id])] : ids.filter((x) => x !== id));
    if (session.accountLabel) startTransition(() => savePhilosophyAction(id, next).then(() => undefined));
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        saved
          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
          : "border-slate-300 text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200"
      }`}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "Save to Your Atlas"}
    </button>
  );
}
