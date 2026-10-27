import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { WritWorkspace } from "@/components/tools/writ/writ-workspace";
import { CloseRacesTeaser } from "@/components/tools/writ/close-races-teaser";
import { getWritDiscovery, searchWrit } from "@/lib/db/writ";
import { WRIT_KINDS, writDocketHref } from "@/lib/tools/writ";

export const metadata: Metadata = {
  title: "Writ: Government & Elections | Worldview",
  description:
    "Dockets for every bill, member of Congress, and race: timelines, roll calls, party splits, ratings, results, and campaign money.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

// Writ's home: search results or discovery. Dockets live at
// /writ/[kind]/[id]; old ?bill= / ?member= / ?race= links move there.
export default async function WritPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  for (const kind of WRIT_KINDS) {
    const id = params[kind];
    if (typeof id === "string" && id) permanentRedirect(writDocketHref(kind, id));
  }
  const query = typeof params.q === "string" ? params.q : "";
  const results = query.trim() ? await searchWrit(query) : null;
  const discovery = results ? null : await getWritDiscovery();

  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: query ? "/writ" : undefined }, ...(query ? [{ label: `Search: ${query}` }] : [])]} />
      <h1 className="sr-only">Writ</h1>
      {discovery ? <CloseRacesTeaser /> : null}
      <WritWorkspace key={query} docket={null} results={results} discovery={discovery} initialQuery={query} />
    </>
  );
}
