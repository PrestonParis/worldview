import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { SubpoenaWorkspace } from "@/components/tools/subpoena/subpoena-workspace";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { getFeaturedSubpoenaEntities } from "@/lib/db/subpoena";
import { getEntity } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";

export const metadata: Metadata = {
  title: "Subpoena: Political Biographies & Money | Worldview",
  description:
    "Biographical profiles of the people and institutions shaping politics, connected to campaign money, lobbying records, and documented relationships.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SubpoenaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const entityId = typeof params.entity === "string" ? params.entity : undefined;
  if (entityId) {
    const entity = await getEntity(entityId);
    if (entity) permanentRedirect(publicEntityPath(entity));
  }
  const query = typeof params.q === "string" ? params.q : "";
  const featured = await getFeaturedSubpoenaEntities(query);

  return (
    <>
      <ToolBreadcrumb items={[{ label: "Subpoena", href: query ? "/subpoena" : undefined }, ...(query ? [{ label: `Search: ${query}` }] : [])]} />
      <h1 className="sr-only">Subpoena</h1>
      <SubpoenaWorkspace key={query} featuredEntities={featured} initialQuery={query} />
    </>
  );
}
