import Link from "next/link";
import type { ReactElement } from "react";
import { toolPages } from "@/lib/nav";
import { pagesContent } from "@/lib/pages-content";
import { typeColorFor } from "@/lib/type-colors";

const PROMOTED_SLUGS = ["people", "statements", "news", "fact-check"];

function NodeGraphIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.9">
        <line x1="10" y1="12" x2="30" y2="8" />
        <line x1="10" y1="12" x2="18" y2="30" />
        <line x1="30" y1="8" x2="50" y2="18" />
        <line x1="18" y1="30" x2="50" y2="18" />
        <line x1="30" y1="8" x2="18" y2="30" />
      </g>
      <g fill="currentColor">
        <circle cx="10" cy="12" r="3.5" />
        <circle cx="30" cy="8" r="3" />
        <circle cx="18" cy="30" r="3" />
        <circle cx="50" cy="18" r="4" />
      </g>
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <line x1="6" y1="20" x2="58" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <g fill="currentColor">
        <circle cx="14" cy="20" r="3" />
        <circle cx="30" cy="20" r="4.5" />
        <circle cx="46" cy="20" r="3" />
      </g>
      <rect x="26" y="8" width="8" height="6" rx="1.5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function ConvergingHeadlinesIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.6">
        <line x1="6" y1="8" x2="30" y2="20" />
        <line x1="6" y1="20" x2="30" y2="20" />
        <line x1="6" y1="32" x2="30" y2="20" />
      </g>
      <rect x="4" y="6" width="14" height="3.5" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="4" y="18.5" width="18" height="3.5" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="4" y="30" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.8" />
      <circle cx="46" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="46" cy="20" r="2.5" fill="currentColor" />
    </svg>
  );
}

function ClaimVerdictIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <rect x="4" y="14" width="14" height="12" rx="2" opacity="0.8" />
        <rect x="25" y="14" width="14" height="12" rx="2" opacity="0.55" />
        <rect x="46" y="14" width="14" height="12" rx="2" opacity="0.55" />
      </g>
      <line x1="18" y1="20" x2="25" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="39" y1="20" x2="46" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <path d="M50 20l2.5 2.5L57 17.5" stroke="currentColor" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<string, () => ReactElement> = {
  people: NodeGraphIcon,
  statements: TimelineIcon,
  news: ConvergingHeadlinesIcon,
  "fact-check": ClaimVerdictIcon,
};

export function ToolModules() {
  const promoted = PROMOTED_SLUGS.map((slug) => toolPages.find((p) => p.href === `/${slug}`)!);
  const rest = toolPages.filter((p) => !PROMOTED_SLUGS.includes(p.href.slice(1)));

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Explore Worldview
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {promoted.map((page) => {
          const slug = page.href.slice(1);
          const content = pagesContent[slug];
          const color = typeColorFor(slug);
          const Icon = ICONS[slug];
          return (
            <Link
              key={page.href}
              href={page.href}
              className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-5 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{page.label}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{content?.tagline}</p>
              </div>
              <div className="shrink-0" style={{ color: color.border }}>
                <Icon />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <p className="mr-1 self-center text-xs font-semibold tracking-wider text-slate-400 uppercase">
          More tools
        </p>
        {rest.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          >
            {page.navLabel}
          </Link>
        ))}
      </div>
    </section>
  );
}
