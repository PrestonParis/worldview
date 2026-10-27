import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { sectionTitle } from "./type";

// One analytical section: an icon and kicker naming the kind of analysis, a
// title that says what it shows, an optional one-line description and
// actions, then the content.
export function AnalysisSection({
  id,
  icon: Icon,
  kicker,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  id: string;
  icon: LucideIcon;
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-3xl min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Icon size={15} aria-hidden />
            {kicker}
          </p>
          <h2 id={`${id}-title`} className={`mt-1 ${sectionTitle}`}>
            {title}
          </h2>
          {description && (
            <p className="mt-1 hidden text-sm leading-6 text-slate-600 sm:block dark:text-slate-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}
