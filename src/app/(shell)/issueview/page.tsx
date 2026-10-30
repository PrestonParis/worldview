import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { IssuesHub } from "@/components/issues/issues-hub";
import { TOOL_VIEWS } from "@/lib/tools/views";
import type { SearchParams } from "./views";

export const metadata: Metadata = {
  title: "Explore the Issues | Worldview",
  description:
    "Explore Worldview's coverage of immigration, the economy, housing, health, crime, guns, education, demographics, foreign policy, and other major issues.",
};

export default async function IssueViewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // Preserve old shared links while making the standalone issue page canonical.
  const view = typeof params.view === "string" ? params.view : "";
  const legacy = TOOL_VIEWS.issueview.find((item) => item.id === view);
  if (legacy) {
    const rest = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (key !== "view" && typeof value === "string") rest.set(key, value);
    const target = legacy.sourceHref ?? (view === "compare" ? "/issueview/compare" : "/issueview");
    permanentRedirect(`${target}${rest.size ? `${target.includes("?") ? "&" : "?"}${rest}` : ""}`);
  }
  return <IssuesHub />;
}
