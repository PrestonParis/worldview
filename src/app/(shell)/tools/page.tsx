import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Compass, Scroll, SlidersHorizontal, Sparkles, Database, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SUITE_TOOLS } from "@/lib/tools/catalog";
import { Surface, Eyebrow } from "@/components/ui/surface";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tools Suite | Worldview",
  description:
    "Analytical workspaces over public data: Subpoena (money & influence), Writ (laws & elections), IssueView (cross-topic stats), and Worldview Atlas.",
};

const ICONS = {
  subpoena: Briefcase,
  writ: Scroll,
  issueview: SlidersHorizontal,
  atlas: Compass,
};

export default function ToolsHubPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="mb-10 text-center">
        <Eyebrow className="mb-2 text-indigo-500 dark:text-indigo-400">Analytical Workspaces</Eyebrow>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          The Worldview Tool Suite
        </h1>
        <p className="mx-auto mt-2 hidden max-w-xl text-sm text-slate-600 sm:block dark:text-slate-400">
          Query, cross-reference, and export the full dataset.
        </p>
      </div>

      {/* Two layers banner */}
      <Surface className="mb-12 border-indigo-200/50 bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/50 p-6 dark:border-indigo-900/40 dark:from-indigo-950/20 dark:via-slate-950 dark:to-sky-950/20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                Architecture
              </span>
              <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-white">
                Two Layers, One Unified Platform
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-200">Public Pages:</strong> Curated, source-verified articles with fixed views for reference and citation.
              <br className="hidden sm:inline" />
              <strong className="text-slate-900 dark:text-slate-200"> Analytical Tools:</strong> Flexible workspaces allowing custom metric combinations, entity dossiers, and raw data extraction.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/datasets"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-2"}
            >
              <Database className="h-4 w-4" />
              Browse 57 Public Datasets
            </Link>
          </div>
        </div>
      </Surface>

      {/* Tool Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {SUITE_TOOLS.map((tool) => {
          const Icon = ICONS[tool.id as keyof typeof ICONS] ?? Sparkles;
          return (
            <Surface
              key={tool.id}
              className="group flex flex-col justify-between p-6 transition-all duration-200 hover:border-indigo-300 hover:shadow-lg dark:hover:border-indigo-800"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/60 dark:text-indigo-400 dark:group-hover:bg-indigo-600 dark:group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{tool.name}</h3>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tool.tagline}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                    {tool.badge}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {tool.description}
                </p>

                <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
                  <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Core Capabilities
                  </div>
                  <ul className="grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2 dark:text-slate-300">
                    {tool.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>
                          <strong className="font-medium text-slate-900 dark:text-slate-100">{cap.title}:</strong>{" "}
                          {cap.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-2">
                <Link
                  href={tool.href}
                  className={buttonVariants({ variant: "default", size: "default" }) + " w-full justify-between gap-2"}
                >
                  <span>Launch {tool.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Surface>
          );
        })}
      </div>

      {/* Cross-linking footer notes */}
      <div className="mt-12 rounded-2xl border border-slate-200/80 bg-slate-50 p-6 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Government Transparency Guarantee
            </span>
          </div>
          <span>All financial figures link directly to original FEC and Senate filings.</span>
        </div>
      </div>
    </div>
  );
}
