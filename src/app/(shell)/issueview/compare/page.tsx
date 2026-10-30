import type { Metadata } from "next";
import Link from "next/link";
import { ToolViewHeader } from "@/components/tools/tool-workspace-shell";
import { TOOL_VIEWS } from "@/lib/tools/views";
import { Comparator, type SearchParams } from "../views";

export const metadata: Metadata = { title: "Data comparison (experimental) | Worldview" };

export default async function IssueViewComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = TOOL_VIEWS.issueview.find((v) => v.id === "compare")!;
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/issueview" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          ← Explore the issues
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Experimental</p>
      </div>
      <ToolViewHeader view={view} />
      <Comparator params={params} />
    </>
  );
}
