import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { RecordVisit } from "@/components/tools/shell/recent";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { WritWorkspace } from "@/components/tools/writ/writ-workspace";
import { RaceLiveResults } from "@/components/tools/writ/race-live-results";
import { loadWritDocket } from "@/lib/db/writ";
import { WRIT_KINDS, writDocketHref, writDocketTitle, type WritKind } from "@/lib/tools/writ";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

const KIND_LABELS: Record<WritKind, string> = { bill: "Bills", member: "Members", race: "Races" };

type Props = { params: Promise<{ kind: string; id: string }> };

const isKind = (kind: string): kind is WritKind => (WRIT_KINDS as readonly string[]).includes(kind);

// Shared by the metadata and the page within one request.
const loadDocket = cache(async (kind: string, id: string) => {
  if (!isKind(kind)) return null;
  const docket = await loadWritDocket({ [kind]: id });
  return docket ? { kind, id, docket } : null;
});

async function load(params: Props["params"]) {
  const { kind, id } = await params;
  return loadDocket(kind, id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  return { title: found ? `${writDocketTitle(found.docket)} | Writ | Worldview` : "Writ | Worldview" };
}

// One docket: a bill, a member of Congress, or a race.
export default async function WritDocketPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  const { kind, id, docket } = found;
  const title = writDocketTitle(docket);
  return (
    <>
      <ToolBreadcrumb items={[{ label: "Writ", href: "/writ" }, { label: KIND_LABELS[kind] }, { label: title }]} />
      <RecordVisit tool="writ" href={writDocketHref(kind, id)} label={title} />
      {kind === "race" ? <RaceLiveResults electionId={id} /> : null}
      <WritWorkspace docket={docket} results={null} discovery={null} initialQuery="" />
    </>
  );
}
