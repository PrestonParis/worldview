"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";
import { useMapInstance } from "@/lib/map/MapContext";
import { exportMapImage, downloadBlob, EXPORT_PRESETS, type ExportSize } from "@/lib/map/exportImage";

export function ExportPanel() {
  const { map, stage } = useMapInstance();
  const [open, setOpen] = useState(true);
  const [presetId, setPresetId] = useState<string>(EXPORT_PRESETS[0].id);
  const [customWidth, setCustomWidth] = useState("1920");
  const [customHeight, setCustomHeight] = useState("1080");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = presetId === "custom";
  const size: ExportSize = isCustom
    ? { width: Number(customWidth) || 0, height: Number(customHeight) || 0 }
    : (EXPORT_PRESETS.find((p) => p.id === presetId)?.size ?? EXPORT_PRESETS[0].size);
  const sizeValid = size.width > 0 && size.height > 0;

  async function handleExport() {
    if (!map || !sizeValid || exporting) return;
    setError(null);
    setExporting(true);
    try {
      const blob = await exportMapImage(map, stage, size);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `worldview-map-${size.width}x${size.height}-${stamp}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="absolute top-3 right-3 z-10 w-56 rounded-md border border-neutral-700 bg-neutral-950/90 text-sm text-neutral-200 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2"
        >
          <span className="flex items-center gap-2 font-medium text-neutral-100">
            <Download size={14} /> Export
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {open && (
          <div className="space-y-3 border-t border-neutral-800 px-3 py-3">
            <div>
              <p className="mb-1.5 text-xs tracking-wide text-neutral-500 uppercase">Size</p>
              <div className="flex flex-col gap-1">
                {EXPORT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    className={`rounded px-2 py-1.5 text-left text-xs transition ${
                      presetId === preset.id
                        ? "bg-neutral-100 text-neutral-900"
                        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPresetId("custom")}
                  className={`rounded px-2 py-1.5 text-left text-xs transition ${
                    isCustom
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  Custom size
                </button>
              </div>
            </div>

            {isCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  aria-label="Export width in pixels"
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                />
                <span className="text-neutral-500">×</span>
                <input
                  type="number"
                  min={1}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  aria-label="Export height in pixels"
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleExport}
              disabled={!map || !sizeValid || exporting}
              className="flex w-full items-center justify-center gap-2 rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Exporting…
                </>
              ) : (
                <>
                  <Download size={13} /> Download PNG
                </>
              )}
            </button>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
        )}
      </div>

      {/* Covers the workspace during export so the brief on-screen resize
          (see exportImage.ts) isn't visible — the map really does resize
          for a moment, this just hides it rather than adding a second,
          off-screen map instance to avoid that. */}
      {exporting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-neutral-200">
            <Loader2 size={16} className="animate-spin" /> Exporting…
          </div>
        </div>
      )}
    </>
  );
}
