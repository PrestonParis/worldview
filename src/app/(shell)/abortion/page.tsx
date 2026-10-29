import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AbortionExplorer, type AbortionSourceKey } from "@/components/abortion/explorer";
import type { ChartSource } from "@/components/charts/chart-card";
import { citeFrom } from "@/components/charts/citation";
import { IssueHeader } from "@/components/data/issue-layout";
import { loadAbortion } from "@/lib/abortion/data";
import { formatValue } from "@/lib/format";
import { loadStatePaths } from "@/lib/geo/state-paths";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Abortion | Worldview",
  description: "An interactive guide to abortion in the United States: when in pregnancy abortions happen, state gestational limits, monthly counts, patient demographics, travel, telehealth, and history since 1973.",
};

const SOURCES: Record<AbortionSourceKey, string> = {
  monthly: "guttmacher-monthly-abortions",
  history: "guttmacher-pregnancy-history",
  cdc: "cdc-abortion-surveillance",
  limits: "abortion-gestational-limits",
};

function ExplorerFallback() {
  return <div className="flex min-h-96 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">Loading the abortion explorer…</div>;
}

export default async function AbortionPage() {
  const [data, map] = await Promise.all([loadAbortion(), loadStatePaths()]);
  if (!data) {
    return <div className="mx-auto max-w-7xl"><h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Abortion</h1><p className="mt-4 text-slate-500">The abortion datasets could not be loaded.</p></div>;
  }

  const h = data.headline;
  const sources = Object.fromEntries(
    Object.entries(SOURCES).flatMap(([key, slug]) => citeFrom(data.datasets, slug).slice(0, 1).map((c) => [key, c])),
  ) as Partial<Record<AbortionSourceKey, ChartSource>>;
  const banned = data.limits.find((c) => c.value === 1)?.states.length ?? 0;

  return (
    <div className="mx-auto max-w-[96rem] space-y-6">
      <IssueHeader title="Abortion">
        {h.total.value !== null && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
            <p className="shrink-0 text-5xl leading-none font-semibold tracking-tight text-slate-950 tabular-nums sm:text-6xl dark:text-white">
              {formatValue(h.total.value, "abortions", { compact: true })}
            </p>
            <div className="space-y-1.5">
              <p className="text-base leading-7 text-slate-700 sm:text-lg dark:text-slate-200">
                Abortions provided by U.S. clinicians in {h.year}
                {h.total.change !== null && <>, {h.total.change >= 0 ? "up" : "down"} {Math.abs(Math.round(h.total.change * 10) / 10)}% from {h.priorYear}</>}, while {banned} states ban abortion at every week. Pick a state and follow it through pregnancy, the law, travel, and history.
              </p>
              {sources.monthly && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <Link href={sources.monthly.href ?? "/datasets"} className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:decoration-slate-600 dark:hover:text-white">
                    {sources.monthly.label}
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
      </IssueHeader>

      <Suspense fallback={<ExplorerFallback />}>
        <AbortionExplorer data={data} map={map} sources={sources} />
      </Suspense>
    </div>
  );
}
