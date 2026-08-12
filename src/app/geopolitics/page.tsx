import type { Metadata } from "next";
import { GeoStudioTopBar } from "@/components/layout/GeoStudioTopBar";
import { ToolRail } from "@/components/layout/ToolRail";
import { LayersPanel } from "@/components/layout/LayersPanel";
import { MapWorkspace } from "@/components/map/MapWorkspace";

export const metadata: Metadata = {
  title: "Geopolitics — Worldview",
  description: "Map-based graphics editor for geopolitical content.",
};

export default function GeopoliticsPage() {
  return (
    <div className="flex h-screen flex-col bg-neutral-900">
      <GeoStudioTopBar />
      <div className="flex flex-1 overflow-hidden">
        <ToolRail />
        <MapWorkspace />
        <LayersPanel />
      </div>
    </div>
  );
}
