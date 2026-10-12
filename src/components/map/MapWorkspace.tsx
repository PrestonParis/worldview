import { MapCanvas } from "@/components/map/MapCanvas";
import { CountrySearch } from "@/components/map/CountrySearch";
import { MapControlPanel } from "@/components/map/MapControlPanel";
import { ExportPanel } from "@/components/map/ExportPanel";
import { GraphicsBar } from "@/components/map/GraphicsBar";
import { AnnotationCanvas } from "@/components/annotate/AnnotationCanvas";
import { ToolOptionsPanel } from "@/components/annotate/ToolOptionsPanel";
import { MapProvider } from "@/lib/map/MapContext";
import Link from "next/link";

export function MapWorkspace({ signedIn }: { signedIn: boolean }) {
  return (
    <MapProvider>
      <div className="relative flex-1 bg-neutral-900">
        <MapCanvas />
        <AnnotationCanvas />
        <MapControlPanel />
        <ExportPanel />
        {signedIn ? (
          <GraphicsBar />
        ) : (
          <Link
            href="/login?next=%2Fgeography"
            className="absolute bottom-3 left-3 z-10 rounded-md border border-neutral-700 bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-300 shadow-lg backdrop-blur transition hover:text-neutral-100"
          >
            Sign in to save graphics
          </Link>
        )}
        <CountrySearch />
        <ToolOptionsPanel />
      </div>
    </MapProvider>
  );
}
