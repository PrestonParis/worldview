import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { Header } from "@/components/nav/header";
import { getCurrentUser } from "@/lib/auth/session";
import { ToolRail } from "@/components/layout/ToolRail";
import { LayersPanel } from "@/components/layout/LayersPanel";
import { MapWorkspace } from "@/components/map/MapWorkspace";
import { pagesContent } from "@/lib/pages-content";

export const metadata: Metadata = {
  title: "Geography · Worldview",
  description: "Map-based graphics editor for geographic and geopolitical content.",
};

export default async function GeographyPage() {
  const user = await getCurrentUser();
  const content = pagesContent["geography"];

  return (
    <div className="flex h-screen flex-col bg-neutral-900">
      <Header accountLabel={user ? (user.displayName ?? user.email ?? "Account") : null} />

      {/* Same "description dropdown" idea as the other major pages, styled
          to fit this page's dark full-bleed map studio instead of the
          light, padded content layout the shared PageDescription assumes. */}
      <details className="group shrink-0 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100">
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          <span className="font-medium text-neutral-100">{content.title}</span>
          <span className="text-neutral-500">· {content.tagline}</span>
        </summary>
        <ul className="mt-2 flex flex-wrap gap-2 pb-1">
          {content.features.map((feature) => (
            <li
              key={feature}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300"
            >
              {feature}
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-1 overflow-hidden">
        <ToolRail />
        <MapWorkspace />
        <LayersPanel />
      </div>
    </div>
  );
}
