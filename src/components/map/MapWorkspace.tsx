import { MapCanvas } from "@/components/map/MapCanvas";
import { CountrySearch } from "@/components/map/CountrySearch";
import { MapControlPanel } from "@/components/map/MapControlPanel";
import { ExportPanel } from "@/components/map/ExportPanel";
import { GraphicsBar } from "@/components/map/GraphicsBar";
import { AnnotationCanvas } from "@/components/annotate/AnnotationCanvas";
import { ToolOptionsPanel } from "@/components/annotate/ToolOptionsPanel";
import { MapProvider } from "@/lib/map/MapContext";
import { DataLayerRenderer } from "@/components/map/DataLayerRenderer";
import { DataCatalogPanel } from "@/components/map/DataCatalogPanel";
import { DataLegends } from "@/components/map/DataLegends";
import { CompositionPanel } from "@/components/map/CompositionPanel";
import Link from "next/link";
import { PresentationSync } from "@/components/map/PresentationSync";

export function MapWorkspace({ signedIn, presentationToken }: { signedIn: boolean; presentationToken?: string }) {
  const readOnly = Boolean(presentationToken);
  return (
    <MapProvider>
      <div className="relative flex-1 bg-neutral-900">
        <MapCanvas interactive={!readOnly} />
        <DataLayerRenderer />
        <AnnotationCanvas readOnly={readOnly} />
        {presentationToken ? <PresentationSync token={presentationToken} /> : null}
        {!readOnly && <MapControlPanel />}
        {!readOnly && <DataCatalogPanel />}
        {!readOnly && <CompositionPanel />}
        <DataLegends />
        {!readOnly && <ExportPanel />}
        {!readOnly && signedIn ? (
          <GraphicsBar />
        ) : !readOnly ? (
          <Link
            href="/login?next=%2Fgeography"
            className="absolute bottom-3 left-3 z-10 rounded-md border border-neutral-700 bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-300 shadow-lg backdrop-blur transition hover:text-neutral-100"
          >
            Sign in to save graphics
          </Link>
        ) : null}
        {!readOnly && <CountrySearch />}
        {!readOnly && <ToolOptionsPanel />}
      </div>
    </MapProvider>
  );
}
