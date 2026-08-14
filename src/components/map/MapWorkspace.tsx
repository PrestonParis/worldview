import { MapCanvas } from "@/components/map/MapCanvas";
import { CountrySearch } from "@/components/map/CountrySearch";
import { MapControlPanel } from "@/components/map/MapControlPanel";
import { ExportPanel } from "@/components/map/ExportPanel";
import { AnnotationCanvas } from "@/components/annotate/AnnotationCanvas";
import { ToolOptionsPanel } from "@/components/annotate/ToolOptionsPanel";
import { MapProvider } from "@/lib/map/MapContext";

export function MapWorkspace() {
  return (
    <MapProvider>
      <div className="relative flex-1 bg-neutral-900">
        <MapCanvas />
        <AnnotationCanvas />
        <MapControlPanel />
        <ExportPanel />
        <CountrySearch />
        <ToolOptionsPanel />
      </div>
    </MapProvider>
  );
}
