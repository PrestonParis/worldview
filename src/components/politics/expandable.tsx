import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { focusRing } from "./type";

// Analysis behind a one-line summary: a native <details>, so it opens from
// the keyboard and without JavaScript, easing open where the browser can.
export function ExpandableAnalysis({
  id,
  summary,
  children,
  className = "",
  summaryClassName = "",
  chevron = "end",
}: {
  id?: string;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  chevron?: "start" | "end" | "none";
}) {
  const icon = (
    <ChevronDown
      size={16}
      aria-hidden
      className="shrink-0 text-slate-500 transition-transform duration-200 group-open/x:rotate-180 dark:text-slate-400"
    />
  );
  return (
    <details id={id} className={`wv-expand group/x scroll-mt-36 ${className}`}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-lg [&::-webkit-details-marker]:hidden ${focusRing} ${summaryClassName}`}
      >
        {chevron === "start" && icon}
        <span className="min-w-0 flex-1">{summary}</span>
        {chevron === "end" && icon}
      </summary>
      {children}
    </details>
  );
}
