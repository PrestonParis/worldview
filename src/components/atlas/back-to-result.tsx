"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const KEY = "wv-from-result";
const SLUG = /^[0-9A-Za-z]{12}$/; // quiz SLUG_PATTERN

// The quiz result a reader came from, carried through the Atlas for the
// session: a "?from=<slug>" link sets it, and every Atlas page offers the
// way back. Wrap in <Suspense> on statically rendered pages.
export function useFromResult(): string | null {
  const params = useSearchParams();
  const fromParam = params.get("from");
  const [from, setFrom] = useState<string | null>(fromParam && SLUG.test(fromParam) ? fromParam : null);
  useEffect(() => {
    try {
      if (fromParam && SLUG.test(fromParam)) sessionStorage.setItem(KEY, fromParam);
      else {
        const saved = sessionStorage.getItem(KEY);
        if (saved && SLUG.test(saved)) queueMicrotask(() => setFrom(saved));
      }
    } catch {
      // Storage unavailable: the URL parameter alone still works.
    }
  }, [fromParam]);
  return from;
}

export function BackToResult({ className = "" }: { className?: string }) {
  const from = useFromResult();
  if (!from) return null;
  return (
    <Link
      href={`/quiz/${from}?view=results`}
      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 ${className}`}
    >
      <ArrowLeft size={14} aria-hidden />
      Back to your result
    </Link>
  );
}
