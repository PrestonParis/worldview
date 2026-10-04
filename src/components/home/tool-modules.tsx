import Link from "next/link";
import type { ReactElement } from "react";
import { toolPages } from "@/lib/nav";
import { pagesContent } from "@/lib/pages-content";
import { typeColorFor } from "@/lib/type-colors";

const CATEGORY_SLUGS = ["my-government", "people", "legislation", "money", "elections", "demographics", "quiz", "geography"];

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

function DocsIcon() {
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

function MoneyFlowIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <path d="M8 30c12 0 12-20 24-20s12 20 24 20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
      <g fill="currentColor">
        <circle cx="8" cy="30" r="3.5" />
        <circle cx="56" cy="30" r="3.5" />
      </g>
      <circle cx="32" cy="20" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="32" y1="15.5" x2="32" y2="24.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <circle cx="32" cy="20" r="13" />
        <ellipse cx="32" cy="20" rx="5.5" ry="13" />
        <line x1="19" y1="20" x2="45" y2="20" />
        <line x1="21.5" y1="12" x2="42.5" y2="12" opacity="0.7" />
        <line x1="21.5" y1="28" x2="42.5" y2="28" opacity="0.7" />
      </g>
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <rect x="18" y="6" width="28" height="24" rx="2" opacity="0.8" />
        <path d="M23 15l3 3 6-7" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="23" y1="24" x2="41" y2="24" opacity="0.6" />
      </g>
      <rect x="10" y="30" width="44" height="5" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="29" y="27" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

function DemographicsIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <path d="M6 32h52" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M8 28c9-1 11-7 19-8 8-2 12 3 18-2 5-4 8-9 11-10v20H8Z" fill="currentColor" opacity="0.18" />
      <path d="M8 28c9-1 11-7 19-8 8-2 12 3 18-2 5-4 8-9 11-10" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="27" cy="20" r="2.5" fill="currentColor" />
      <circle cx="45" cy="18" r="2.5" fill="currentColor" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="8" y1="10" x2="56" y2="10" opacity="0.45" />
        <line x1="8" y1="20" x2="56" y2="20" opacity="0.45" />
        <line x1="8" y1="30" x2="56" y2="30" opacity="0.45" />
      </g>
      <g fill="currentColor">
        <circle cx="40" cy="10" r="3.5" />
        <circle cx="19" cy="20" r="3.5" />
        <circle cx="47" cy="30" r="3.5" />
      </g>
    </svg>
  );
}

function GovernmentIcon() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 17h42L32 7 11 17Z" />
        <path d="M15 34h34M13 37h38M18 18v16M27 18v16M37 18v16M46 18v16" opacity="0.9" />
      </g>
      <circle cx="32" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

const ICONS: Record<string, () => ReactElement> = {
  "my-government": GovernmentIcon,
  people: NodeGraphIcon,
  legislation: DocsIcon,
  money: MoneyFlowIcon,
  elections: BallotIcon,
  demographics: DemographicsIcon,
  quiz: QuizIcon,
  geography: GlobeIcon,
};

export function ToolModules() {
  const categories = CATEGORY_SLUGS.map((slug) =>
    toolPages.find((p) => p.href === `/${slug}`),
  ).filter((p): p is (typeof toolPages)[number] => Boolean(p));

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Explore Worldview
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map((page) => {
          const slug = page.href.slice(1);
          const content = pagesContent[slug];
          const color = typeColorFor(slug);
          const Icon = ICONS[slug] ?? NodeGraphIcon;
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
    </section>
  );
}
