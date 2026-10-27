import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { profileIcons } from "./profile-icons";
import type { ProfileTabId } from "@/lib/people/profile-modules";

// An overview card: a preview of one tab (with a link to it) or a section
// that lives only on the overview.
export function ModuleCard({
  tab,
  icon,
  title,
  href,
  cta,
  children,
  index = 0,
  className = "",
}: {
  tab?: ProfileTabId;
  icon?: LucideIcon;
  title: string;
  href?: string;
  cta?: string;
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const Icon = icon ?? (tab ? profileIcons[tab] : ArrowRight);
  return (
    <section
      className={`wv-rise flex flex-col rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 ${className}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
        <Icon aria-hidden className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        {title}
      </h2>
      <div className="mt-3 flex-1">{children}</div>
      {href && cta ? (
        <Link
          href={href}
          className="group mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          {cta}
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </section>
  );
}

export function SectionHeading({ tab, title, dek }: { tab: ProfileTabId; title: string; dek?: string }) {
  const Icon = profileIcons[tab];
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2.5 font-serif text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
        <Icon aria-hidden className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        {title}
      </h2>
      {dek ? <p className="mt-2 max-w-[68ch] text-slate-600 dark:text-slate-400">{dek}</p> : null}
    </div>
  );
}

// Marks a quotation whose exact wording couldn't be checked against the original.
export function NotVerbatim() {
  return (
    <span
      title="The wording comes from coverage of the source, not the original text."
      className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    >
      Not verbatim
    </span>
  );
}
