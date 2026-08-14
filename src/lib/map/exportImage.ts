import type { Map as MapLibreMap } from "maplibre-gl";
import type Konva from "konva";

export interface ExportSize {
  width: number;
  height: number;
}

export const EXPORT_PRESETS: { id: string; label: string; size: ExportSize }[] = [
  { id: "16:9", label: "1920×1080 (16:9 — broadcast)", size: { width: 1920, height: 1080 } },
  { id: "9:16", label: "1080×1920 (9:16 — vertical/social)", size: { width: 1080, height: 1920 } },
];

function waitForIdle(map: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    map.once("idle", () => resolve());
  });
}

// Two animation-frame ticks: one for the browser to apply the container's
// new computed size, one more for React (size state → Stage width/height
// props) and Konva to actually repaint at that size — `idle` alone only
// guarantees MapLibre itself has caught up, not the annotation layer, which
// reacts to the same resize asynchronously via its own ResizeObserver.
function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Resizes the map to the target pixel dimensions, captures the composited
 * map + annotation output as a PNG, then restores the original size.
 * Callers are expected to show their own "Exporting…" UI for the duration —
 * the resize is real and briefly visible on screen, not done off-screen.
 */
export async function exportMapImage(
  map: MapLibreMap,
  stage: Konva.Stage | null,
  size: ExportSize,
): Promise<Blob> {
  const container = map.getContainer();
  const originalWidth = container.style.width;
  const originalHeight = container.style.height;

  try {
    container.style.width = `${size.width}px`;
    container.style.height = `${size.height}px`;
    map.resize();

    await waitForIdle(map);
    await waitTwoFrames();

    const composite = document.createElement("canvas");
    composite.width = size.width;
    composite.height = size.height;
    const ctx = composite.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D drawing context for the export canvas.");

    // Map first — it's the base layer — then annotations on top, matching
    // the DOM stacking order MapWorkspace.tsx already establishes.
    ctx.drawImage(map.getCanvas(), 0, 0, size.width, size.height);
    if (stage) {
      const annotationCanvas = stage.toCanvas({ pixelRatio: 1 });
      ctx.drawImage(annotationCanvas, 0, 0, size.width, size.height);
    }

    return await new Promise<Blob>((resolve, reject) => {
      composite.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode the export image."));
      }, "image/png");
    });
  } finally {
    container.style.width = originalWidth;
    container.style.height = originalHeight;
    map.resize();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
