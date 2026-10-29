import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { ToolViewOverview } from "@/components/tools/tool-workspace-shell";
import { issueViewHref } from "@/lib/tools/shell";
import { TOOL_VIEWS } from "@/lib/tools/views";
import type { SearchParams } from "./views";

export const metadata: Metadata = {
  title: "IssueView: Every Issue in One Tool | Worldview",
  description:
    "Explore every Worldview issue, state profile, spending view, and cross-topic comparison in one tool.",
};

export default async function IssueViewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // Old ?view= links move to the view's own path; the comparator keeps its parameters.
  const view = typeof params.view === "string" ? params.view : "";
  if (view && TOOL_VIEWS.issueview.some((v) => v.id === view)) {
    const rest = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (key !== "view" && typeof value === "string") rest.set(key, value);
    permanentRedirect(`${issueViewHref(view)}${rest.size ? `?${rest}` : ""}`);
  }
  return (
    <>
      <ToolBreadcrumb items={[{ label: "IssueView" }]} />
      <h1 className="sr-only">IssueView</h1>
      <ToolViewOverview tool="issueview" views={TOOL_VIEWS.issueview} />
    </>
  );
}
