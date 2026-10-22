import type { Metadata } from "next";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { ToolViewHeader } from "@/components/tools/tool-workspace-shell";
import { TOOL_VIEWS } from "@/lib/tools/views";
import { Comparator, type SearchParams } from "../views";

export const metadata: Metadata = { title: "Compare metrics | IssueView | Worldview" };

export default async function IssueViewComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = TOOL_VIEWS.issueview.find((v) => v.id === "compare")!;
  return (
    <>
      <ToolBreadcrumb items={[{ label: "IssueView", href: "/issueview" }, { label: view.label }]} />
      <ToolViewHeader view={view} />
      <Comparator params={params} />
    </>
  );
}
