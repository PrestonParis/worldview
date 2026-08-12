"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function GeoStudioTopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          title="Back to Worldview"
          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm font-semibold tracking-tight text-neutral-100">
          GeoStudio
        </span>
        <span className="text-xs text-neutral-500">Untitled project</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Export (coming in a later phase)"
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 opacity-50"
        >
          Export
        </button>
      </div>
    </header>
  );
}
