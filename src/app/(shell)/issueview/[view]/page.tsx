import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ToolWorkspaceContent } from "@/components/tools/tool-workspace-content";
import { TOOL_VIEWS } from "@/lib/tools/views";
import { IssueContent } from "../views";

export const revalidate = 3600;

// Topic views only; the comparator has its own route (it reads query params).
const TOPICS = TOOL_VIEWS.issueview.filter((v) => v.sourceHref);

export function generateStaticParams() {
  return TOPICS.map((v) => ({ view: v.id }));
}

type Props = { params: Promise<{ view: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view: id } = await params;
  const view = TOPICS.find((v) => v.id === id);
  return { title: view ? `${view.label} | IssueView | Worldview` : "IssueView | Worldview" };
}

export default async function IssueViewTopicPage({ params }: Props) {
  const { view: id } = await params;
  const view = TOPICS.find((v) => v.id === id);
  if (!view) notFound();
  return (
    <>
      {/* The embedded page carries its own title; the shell adds the trail and a way out. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ToolBreadcrumb items={[{ label: "IssueView", href: "/issueview" }, { label: view.group }, { label: view.label }]} />
        {view.sourceHref ? (
          <Link href={view.sourceHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-950 dark:hover:text-white">
            Open standalone page <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <ToolWorkspaceContent tool="issueview" views={TOOL_VIEWS.issueview}>
        <IssueContent view={view.id} params={{}} />
      </ToolWorkspaceContent>
    </>
  );
}
