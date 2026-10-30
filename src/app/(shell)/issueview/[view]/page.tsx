import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TOOL_VIEWS } from "@/lib/tools/views";
import type { SearchParams } from "../views";

export const revalidate = 3600;

// Topic views only; the comparator has its own route (it reads query params).
const TOPICS = TOOL_VIEWS.issueview.filter((v) => v.sourceHref);

export function generateStaticParams() {
  return TOPICS.map((v) => ({ view: v.id }));
}

type Props = { params: Promise<{ view: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view: id } = await params;
  const view = TOPICS.find((v) => v.id === id);
  return { title: view ? `${view.label} | IssueView | Worldview` : "IssueView | Worldview" };
}

export default async function IssueViewTopicPage({ params, searchParams }: Props) {
  const { view: id } = await params;
  const view = TOPICS.find((v) => v.id === id);
  if (!view) notFound();
  const target = new URL(view.sourceHref!, "https://worldview.local");
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") target.searchParams.set(key, value);
    else if (Array.isArray(value)) for (const item of value) target.searchParams.append(key, item);
  }
  permanentRedirect(`${target.pathname}${target.search}${target.hash}`);
}
