"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { issueViewHref } from "@/lib/tools/shell";
import type { SuiteToolId, ToolView } from "@/lib/tools/views";

// Links inside an embedded public page that point at another view's
// standalone page open that view in the tool instead.
function workspaceHref(tool: SuiteToolId, view: string, source: URL): string {
  const base = tool === "issueview" ? issueViewHref(view) : `/tools/${tool}`;
  return `${base}${source.search}${source.hash}`;
}

export function ToolWorkspaceContent({
  tool,
  views,
  children,
}: {
  tool: SuiteToolId;
  views: ToolView[];
  children: ReactNode;
}) {
  const router = useRouter();
  const viewByPath = new Map(
    views.flatMap((view) => {
      if (!view.sourceHref) return [];
      return [[new URL(view.sourceHref, "https://worldview.local").pathname, view.id] as const];
    }),
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin) return;
    const view = viewByPath.get(target.pathname);
    if (!view) return;
    event.preventDefault();
    router.push(workspaceHref(tool, view, target));
  }

  function handleSubmit(event: FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    if (form.tagName !== "FORM" || (form.method && form.method.toLowerCase() !== "get")) return;
    const target = new URL(form.action || window.location.href, window.location.href);
    const view = viewByPath.get(target.pathname);
    if (!view) return;
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (typeof value === "string" && value) params.append(key, value);
    target.search = params.toString();
    router.push(workspaceHref(tool, view, target));
  }

  return (
    <div onClickCapture={handleClick} onSubmitCapture={handleSubmit}>
      {children}
    </div>
  );
}
