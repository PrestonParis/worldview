import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { ToolLogo } from "@/components/tools/tool-logos";
import { ToolRail } from "./tool-rail";
import { SUITE_ORDER, TOOL_SHELLS } from "@/lib/tools/shell";
import type { SuiteToolId } from "@/lib/tools/views";

// The frame every suite tool shares: a tool bar (logo, search, switcher),
// a left rail, and the page. Pages add their own ToolBreadcrumb.
export function ToolShell({ tool, children }: { tool: SuiteToolId; children: ReactNode }) {
  const config = TOOL_SHELLS[tool];
  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <Link href={config.home} className="flex items-center gap-3">
          <ToolLogo tool={tool} size={36} priority />
          <span>
            <span className="block text-lg leading-5 font-extrabold tracking-tight text-slate-950 dark:text-white">{config.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{config.tagline}</span>
          </span>
        </Link>
        {config.search ? (
          <form action={config.search.action} method="get" role="search" className="relative order-last w-full sm:order-none sm:w-auto sm:min-w-[22rem] sm:flex-1 lg:max-w-xl">
            <label htmlFor={`${tool}-search`} className="sr-only">
              {config.search.placeholder}
            </label>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id={`${tool}-search`}
              name="q"
              type="search"
              placeholder={config.search.placeholder}
              className="w-full rounded-full border border-slate-200 bg-white py-2 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </form>
        ) : null}
        <nav aria-label="Tools" className="ml-auto flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-900">
          {SUITE_ORDER.map((id) => (
            <Link
              key={id}
              href={TOOL_SHELLS[id].home}
              aria-current={id === tool ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                id === tool
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {TOOL_SHELLS[id].name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
        <ToolRail tool={tool} name={config.name} groups={config.rail} recentLabel={config.recentLabel} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function ToolBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
      {items.map((item, i) => (
        <span key={`${item.label}:${i}`} className="flex min-w-0 items-center gap-1">
          {i ? <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-slate-950 dark:hover:text-white">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-slate-700 dark:text-slate-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
