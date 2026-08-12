"use client";

import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LonLat } from "@/lib/types";
import { resolveFontFamily } from "@/lib/fonts";

interface TextEditorOverlayProps {
  map: MapLibreMap;
  anchor: LonLat;
  initialValue: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

// A real DOM textarea, not a Konva node — Konva has no native text editing
// (IME composition, paste, selection), so the editing UI is a positioned
// HTML overlay that hands off to a Konva Text node once committed. It's
// the one spot in the Konva overlay that needs `pointer-events: auto`; the
// wrapping canvas layer stays `none` as usual.
export function TextEditorOverlay({
  map,
  anchor,
  initialValue,
  fontFamily,
  fontSize,
  color,
  onCommit,
  onCancel,
}: TextEditorOverlayProps) {
  const [value, setValue] = useState(initialValue);
  const pos = map.project(anchor);

  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        }
      }}
      rows={2}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        pointerEvents: "auto",
        background: "rgba(15, 15, 15, 0.55)",
        color,
        border: "1px dashed #60a5fa",
        borderRadius: 4,
        outline: "none",
        padding: "2px 4px",
        fontFamily: resolveFontFamily(fontFamily),
        fontSize,
        lineHeight: 1.25,
        minWidth: 160,
      }}
    />
  );
}
