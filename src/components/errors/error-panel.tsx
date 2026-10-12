"use client";

import Link from "next/link";
import { useEffect } from "react";

export function ErrorPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This page couldn&rsquo;t load</h1>
      <p className="mt-3 text-slate-500 dark:text-slate-400">
        A data service didn&rsquo;t respond. Try again in a moment.
      </p>
      <div className="mt-6 flex justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Try again
        </button>
        <Link href="/" className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900">
          Home
        </Link>
      </div>
      {error.digest ? <p className="mt-6 font-mono text-xs text-slate-400">Ref {error.digest}</p> : null}
    </div>
  );
}
