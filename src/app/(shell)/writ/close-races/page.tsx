import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { Surface } from "@/components/ui/surface";
import { defaultElection, listTrackedElections } from "@/lib/db/closeRaces";

export const metadata: Metadata = { title: "Close races | Writ | Worldview" };
export const dynamic = "force-dynamic";

// Opens the default election (see defaultElection).
export default async function CloseRacesIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [elections, params] = await Promise.all([listTrackedElections(), searchParams]);
  const target = defaultElection(elections);
  if (target) {
    const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    redirect(`/writ/close-races/${encodeURIComponent(target.id)}${query ? `?${query}` : ""}`);
  }
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Close races" }]} />
      <h1 className="sr-only">Close races</h1>
      <Surface className="p-6 text-sm text-slate-600 dark:text-slate-400">No elections have been loaded yet.</Surface>
    </>
  );
}
