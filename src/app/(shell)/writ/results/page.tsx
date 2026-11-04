import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { Surface } from "@/components/ui/surface";
import { defaultElection, listTrackedElections } from "@/lib/db/closeRaces";

export const metadata: Metadata = { title: "Results | Writ | Worldview" };
export const dynamic = "force-dynamic";

// Opens the default election (see defaultElection).
export default async function ResultsIndex() {
  const target = defaultElection(await listTrackedElections());
  if (target) redirect(`/writ/results/${encodeURIComponent(target.id)}`);
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: "Results" }]} />
      <Surface className="p-6 text-sm text-slate-500">No election is being tracked yet.</Surface>
    </>
  );
}
