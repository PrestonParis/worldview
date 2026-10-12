import type { Metadata } from "next";
import { Header } from "@/components/nav/header";
import { getNavPreviews } from "@/lib/nav-previews";
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
  // A failed profile lookup shouldn't take down every page; treat it as signed out.
  const [user, previews] = await Promise.all([getCurrentUser().catch(() => null), getNavPreviews()]);
  const content = pagesContent["geography"];

  return (
    <div className="flex h-screen flex-col bg-neutral-900">
      <Header accountLabel={user ? (user.displayName ?? user.email ?? "Account") : null} previews={previews} />

      <div className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-sm">
        <span className="font-medium text-neutral-100">{content.title}</span>
        <span className="text-neutral-500"> · {content.tagline}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ToolRail />
        <MapWorkspace signedIn={Boolean(user)} />
        <LayersPanel />
      </div>
    </div>
  );
}
