import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { fmt } from "@/components/tools/writ/close-races-view";
import { ResultsTabs } from "@/components/tools/writ/results-tabs";
import { loadCountyIndex } from "@/lib/db/closeRaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Georgia results by county | Writ | Worldview" };

type Props = { params: Promise<{ election: string }> };

export default async function CountiesPage({ params }: Props) {
  const id = decodeURIComponent((await params).election);
  const data = await loadCountyIndex(id);
  if (!data) notFound();
  const results = `/writ/results/${encodeURIComponent(id)}`;
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Results", href: results }, { label: "Counties" }]} />
      <div className="space-y-6">
        <ResultsTabs election={id} active="counties" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{data.election.name}: counties</h1>
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] tracking-[0.1em] text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2.5 font-bold">County</th>
                <th className="px-4 py-2.5 text-right font-bold">Ballots cast</th>
                <th className="px-4 py-2.5 text-right font-bold">Turnout</th>
                <th className="px-4 py-2.5 text-right font-bold">Precincts fully reported</th>
                <th className="px-4 py-2.5 font-bold">Certified</th>
              </tr>
            </thead>
            <tbody>
              {data.counties.rows.map((c) => {
                const units = c.unitsFully + c.unitsNight + c.unitsPartial + c.unitsNotReported;
                return (
                  <tr key={c.slug} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <Link href={`${results}/counties/${c.slug}`} className="font-medium text-slate-900 hover:text-rose-600 dark:text-white">
                        {c.county}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(c.ballotsCast)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.registered && c.ballotsCast != null ? `${((c.ballotsCast / c.registered) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{units ? `${fmt(c.unitsFully)} of ${fmt(units)}` : "—"}</td>
                    <td className="px-4 py-2">{c.isOfficial ? "Yes" : "Not yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
