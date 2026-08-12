import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

// Forces a re-render on every map camera change (pan/zoom/rotate), throttled
// to one per animation frame so a drag gesture doesn't queue up redundant
// renders. The returned number carries no data itself — it's just a
// React-visible signal that "the camera moved." Consumers re-read the
// current transform directly via map.project()/unproject() on each render
// this triggers, the same way the country-border overlay stays in sync.
export function useMapCamera(map: MapLibreMap | null): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!map) return;
    let frame: number | null = null;

    const onMove = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setEpoch((e) => e + 1);
      });
    };

    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [map]);

  return epoch;
}
