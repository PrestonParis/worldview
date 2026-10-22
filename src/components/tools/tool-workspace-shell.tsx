import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { issueViewHref } from "@/lib/tools/shell";
import type { SuiteToolId, ToolView } from "@/lib/tools/views";

// Pieces of a tool view inside the shared ToolShell (components/tools/shell).

export function ToolViewHeader({ view }: { view: ToolView }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{view.label}</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{view.description}</p>
      </div>
      {view.sourceHref ? (
        <Link
          href={view.sourceHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-950 dark:hover:text-white"
        >
          Open standalone page <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function ToolViewOverview({ tool, views }: { tool: SuiteToolId; views: ToolView[] }) {
  const href = (id: string) => (tool === "issueview" ? issueViewHref(id) : `/tools/${tool}`);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {views
        .filter((view) => view.id !== "overview")
        .map((view) => (
          <Link
            key={view.id}
            href={href(view.id)}
            className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-800"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{view.group}</p>
            <h3 className="mt-1 font-bold text-slate-950 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              {view.label}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{view.description}</p>
          </Link>
        ))}
    </div>
  );
}
