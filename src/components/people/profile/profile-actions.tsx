"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Pencil, Share2 } from "lucide-react";
import { useSession } from "@/components/auth/can-edit";

const button =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white";

// Share the profile, and for contributors a small link to the editor —
// administrative controls never sit in the public hero.
export function ProfileActions({ entityId, name }: { entityId: string; name: string }) {
  const { canEdit } = useSession();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      await navigator.share({ title: `${name} | Worldview`, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={button}>
        {copied ? <Check aria-hidden className="h-4 w-4" /> : <Share2 aria-hidden className="h-4 w-4" />}
        {copied ? "Link copied" : "Share"}
      </button>
      {canEdit ? (
        <Link href={`/data/entities/${entityId}/edit`} className={`${button} text-slate-500`} title="Edit this record">
          <Pencil aria-hidden className="h-3.5 w-3.5" />
          Edit
        </Link>
      ) : null}
    </div>
  );
}
