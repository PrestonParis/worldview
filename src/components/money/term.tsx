import { useId, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/money/glossary";

// A campaign-finance term with its plain-English definition on hover or
// keyboard focus. Pure CSS, so it works in server components.
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  const id = useId();
  return (
    <span className="group/term relative inline-block">
      <span
        tabIndex={0}
        aria-describedby={id}
        className="cursor-help underline decoration-slate-300 decoration-dotted underline-offset-4 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-slate-400 dark:decoration-slate-600"
      >
        {children ?? entry.term}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 font-normal tracking-normal normal-case text-slate-600 opacity-0 shadow-lg transition-opacity group-hover/term:visible group-hover/term:opacity-100 group-focus-within/term:visible group-focus-within/term:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        <span className="block font-semibold text-slate-900 dark:text-white">{entry.term}</span>
        {entry.def}
      </span>
    </span>
  );
}
