// Shared pieces of the homepage tool showcase: one card geometry, one tab
// control and one pair of call-to-action styles, so the four previews read
// as a set while each draws its own kind of data. No hooks, so server and
// client components both use these.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ToolLogo } from "@/components/tools/tool-logos";
import { SUITE_TOOLS, type ProductId } from "@/lib/tools/catalog";

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950";

export const primaryCta = `group inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 ${focusRing}`;
export const secondaryCta = `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/60 ${focusRing}`;

// Preview surfaces sit one step off the card so the sample reads as a
// working panel, not a decoration.
export const stage = "rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50";

export const metaLine = "text-xs leading-5 text-slate-600 dark:text-slate-400";

export function ToolEyebrow({ tool }: { tool: ProductId }) {
  const meta = SUITE_TOOLS.find((entry) => entry.id === tool)!;
  return (
    <div className="flex items-center gap-2.5">
      <ToolLogo tool={tool} size={28} />
      <p className="text-sm font-semibold text-slate-950 dark:text-white">
        {meta.name}
        <span className="font-normal text-slate-500 dark:text-slate-400"> · {meta.tagline}</span>
      </p>
    </div>
  );
}

export function CardHeading({ tool, title, children }: { tool: ProductId; title: string; children: React.ReactNode }) {
  return (
    <div>
      <ToolEyebrow tool={tool} />
      <h3 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-balance text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-slate-700 dark:text-slate-300">{children}</p>
    </div>
  );
}

export function ShowcaseCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <article
      className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-[0_8px_28px_-12px_rgb(15_23_42/0.18)] sm:p-6 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:shadow-none ${className}`}
    >
      {children}
    </article>
  );
}

export function CtaLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? primaryCta : secondaryCta}>
      {children}
      <ArrowRight size={15} aria-hidden className={primary ? "transition-transform group-hover:translate-x-0.5" : ""} />
    </Link>
  );
}

// A two- or three-way switch. Pass ids that match the tab panels' ids.
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: {
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            const index = tabs.findIndex((t) => t.id === value);
            const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
            onChange(next.id);
            document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
          }}
          tabIndex={value === tab.id ? 0 : -1}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
            value === tab.id
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function formatDay(value: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
