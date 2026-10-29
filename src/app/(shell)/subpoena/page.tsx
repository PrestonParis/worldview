import type { Metadata } from "next";
import { SubpoenaWorkspace } from "@/components/tools/subpoena/subpoena-workspace";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { getFeaturedSubpoenaEntities } from "@/lib/db/subpoena";

export const metadata: Metadata = {
  title: "Subpoena: Political Biographies & Money | Worldview",
  description:
    "Biographical profiles of the people and institutions shaping politics, connected to campaign money, lobbying records, and documented relationships.",
};

// The directory is the same for everyone, so it's cached; search lives at
// /subpoena/search.
export const revalidate = 86400;

export default async function SubpoenaPage() {
  const directory = await getFeaturedSubpoenaEntities();

  return (
    <>
      <ToolBreadcrumb items={[{ label: "Subpoena" }]} />
      <h1 className="sr-only">Subpoena</h1>
      <SubpoenaWorkspace directory={directory} initialQuery="" />
    </>
  );
}
