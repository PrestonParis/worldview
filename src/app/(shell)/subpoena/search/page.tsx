import type { Metadata } from "next";
import { permanentRedirect, redirect } from "next/navigation";
import { SubpoenaWorkspace } from "@/components/tools/subpoena/subpoena-workspace";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { getFeaturedSubpoenaEntities } from "@/lib/db/subpoena";
import { getEntity } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";

export const metadata: Metadata = {
  title: "Search | Subpoena | Worldview",
  description:
    "Biographical profiles of the people and institutions shaping politics, connected to campaign money, lobbying records, and documented relationships.",
};

// Search reads ?q=, so it renders per request; the /subpoena directory itself
// is cached. Old /subpoena?q= and ?entity= links are forwarded here by
// src/proxy.ts.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SubpoenaSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const entityId = typeof params.entity === "string" ? params.entity : undefined;
  if (entityId) {
    const entity = await getEntity(entityId);
    if (entity) permanentRedirect(publicEntityPath(entity));
  }
  const query = typeof params.q === "string" ? params.q.trim() : "";
  if (!query) redirect("/subpoena");
  const directory = await getFeaturedSubpoenaEntities(query);

  return (
    <>
      <ToolBreadcrumb items={[{ label: "Subpoena", href: "/subpoena" }, { label: `Search: ${query}` }]} />
      <h1 className="sr-only">Subpoena search</h1>
      <SubpoenaWorkspace key={query} directory={directory} initialQuery={query} />
    </>
  );
}
