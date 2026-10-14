import type { ReactNode } from "react";
import { Check } from "lucide-react";

// A page's intro as a few scannable points instead of a paragraph, so the
// data starts sooner.
export function FeatureList({
  items,
  className = "",
  tone = "default",
}: {
  items: ReactNode[];
  className?: string;
  // "inverse" for dark hero backgrounds.
  tone?: "default" | "inverse";
}) {
  const text = tone === "inverse" ? "text-slate-300" : "text-slate-600 dark:text-slate-300";
  const icon = tone === "inverse" ? "text-blue-300" : "text-blue-600 dark:text-blue-400";
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1.5 text-sm ${text} ${className}`}>
      {items.map((item, index) => (
        <li key={index} className="inline-flex items-center gap-1.5">
          <Check size={14} strokeWidth={2.5} className={`shrink-0 ${icon}`} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
