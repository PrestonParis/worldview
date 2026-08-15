"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import type { ArrowStyle, HighlightStyle, IconKind, IconStyle, TextStyle } from "@/lib/types";
import { TEXT_FONT_OPTIONS } from "@/lib/fonts";

const SHAPE_TOOLS: ReadonlySet<string> = new Set([
  "arrow",
  "line",
  "rectangle",
  "circle",
  "polygon",
  "freehand",
]);

// Shown while a drawing tool is active (edits the defaults new shapes will
// use) or while the select tool has a shape selected (edits that shape's
// own style directly) — never both, so there's one obvious place to look
// for "what will this affect." Branches into a shape-style panel
// (color/thickness/dashed, +curved/arrowheads for arrow) or a text-style
// panel (font/size/bold/italic/outline/shadow/rotation) depending on what's
// being edited.
export function ToolOptionsPanel() {
  const activeTool = useAppStore((s) => s.activeTool);
  const toolOptions = useAppStore((s) => s.toolOptions);
  const setToolOption = useAppStore((s) => s.setToolOption);
  const layers = useAppStore((s) => s.layers);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const updateLayerStyle = useAppStore((s) => s.updateLayerStyle);

  const updateLayerGeometry = useAppStore((s) => s.updateLayerGeometry);

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const editingLayer =
    activeTool === "select" && activeLayer && "style" in activeLayer ? activeLayer : null;

  const mode = editingLayer
    ? editingLayer.type === "text"
      ? "text"
      : editingLayer.type === "icon"
        ? "icon"
        : editingLayer.type === "highlight"
          ? "highlight"
          : "shape"
    : activeTool === "text"
      ? "text"
      : activeTool === "icon"
        ? "icon"
        : activeTool === "highlight"
          ? "highlight"
          : SHAPE_TOOLS.has(activeTool)
            ? "shape"
            : null;

  if (!mode) return null;

  function setShape<K extends keyof ArrowStyle>(key: K, value: ArrowStyle[K]) {
    if (editingLayer) {
      updateLayerStyle(editingLayer.id, { [key]: value });
    } else {
      setToolOption(key as string, value);
    }
  }

  function setText<K extends keyof TextStyle>(key: K, value: TextStyle[K]) {
    if (editingLayer) {
      updateLayerStyle(editingLayer.id, { [key]: value });
    } else {
      setToolOption(key as string, value);
    }
  }

  function setIcon<K extends keyof IconStyle>(key: K, value: IconStyle[K]) {
    if (editingLayer) {
      updateLayerStyle(editingLayer.id, { [key]: value });
    } else {
      setToolOption(key as string, value);
    }
  }

  function setIconKind(kind: IconKind) {
    if (editingLayer && editingLayer.type === "icon") {
      updateLayerGeometry(editingLayer.id, { icon: kind });
    } else {
      setToolOption("iconKind", kind);
    }
  }

  function setHighlight<K extends keyof HighlightStyle>(key: K, value: HighlightStyle[K]) {
    if (editingLayer) {
      updateLayerStyle(editingLayer.id, { [key]: value });
    } else {
      setToolOption(key as string, value);
    }
  }

  const iconKind =
    editingLayer && editingLayer.type === "icon"
      ? editingLayer.icon
      : (typeof toolOptions.iconKind === "string" ? (toolOptions.iconKind as IconKind) : "flag");

  return (
    <div className="absolute bottom-3 left-3 z-10 w-56 rounded-md border border-neutral-700 bg-neutral-950/90 p-3 text-sm text-neutral-200 shadow-lg backdrop-blur">
      <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {editingLayer
          ? "Selected shape"
          : mode === "text"
            ? "New text style"
            : mode === "icon"
              ? "New icon style"
              : mode === "highlight"
                ? "New highlight style"
                : "New shape style"}
      </p>
      {mode === "shape" ? (
        <ShapeOptions
          // toolOptions is deliberately a loose bag (see toolSlice.ts) —
          // it holds defaults for every tool, so it carries the same
          // fields as ArrowStyle at runtime without the precise type.
          style={editingLayer ? (editingLayer.style as ArrowStyle) : (toolOptions as unknown as ArrowStyle)}
          isArrow={editingLayer ? editingLayer.type === "arrow" : activeTool === "arrow"}
          set={setShape}
        />
      ) : mode === "text" ? (
        <TextOptions
          style={editingLayer ? (editingLayer.style as TextStyle) : (toolOptions as unknown as TextStyle)}
          set={setText}
        />
      ) : mode === "icon" ? (
        <IconOptions
          iconKind={iconKind}
          setKind={setIconKind}
          style={editingLayer ? (editingLayer.style as IconStyle) : (toolOptions as unknown as IconStyle)}
          set={setIcon}
        />
      ) : (
        <HighlightOptions
          style={editingLayer ? (editingLayer.style as HighlightStyle) : (toolOptions as unknown as HighlightStyle)}
          set={setHighlight}
        />
      )}
    </div>
  );
}

function ShapeOptions({
  style,
  isArrow,
  set,
}: {
  style: ArrowStyle;
  isArrow: boolean;
  set: <K extends keyof ArrowStyle>(key: K, value: ArrowStyle[K]) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="flex items-center justify-between">
        <span>Color</span>
        <input
          type="color"
          value={style.color}
          onChange={(e) => set("color", e.target.value)}
          className="h-6 w-10 cursor-pointer rounded border border-neutral-700 bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <span>Thickness</span>
          <span className="text-neutral-500">{style.thickness}px</span>
        </span>
        <input
          type="range"
          min={1}
          max={12}
          value={style.thickness}
          onChange={(e) => set("thickness", Number(e.target.value))}
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between">
        <span>Dashed</span>
        <input
          type="checkbox"
          checked={style.dashed}
          onChange={(e) => set("dashed", e.target.checked)}
          className="accent-neutral-100"
        />
      </label>

      {isArrow && (
        <>
          <label className="flex cursor-pointer items-center justify-between">
            <span>Curved</span>
            <input
              type="checkbox"
              checked={style.curved}
              onChange={(e) => set("curved", e.target.checked)}
              className="accent-neutral-100"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between">
            <span>Start arrowhead</span>
            <input
              type="checkbox"
              checked={style.startArrowhead}
              onChange={(e) => set("startArrowhead", e.target.checked)}
              className="accent-neutral-100"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between">
            <span>End arrowhead</span>
            <input
              type="checkbox"
              checked={style.endArrowhead}
              onChange={(e) => set("endArrowhead", e.target.checked)}
              className="accent-neutral-100"
            />
          </label>
        </>
      )}
    </div>
  );
}

function TextOptions({
  style,
  set,
}: {
  style: TextStyle;
  set: <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="flex items-center justify-between">
        <span>Color</span>
        <input
          type="color"
          value={style.color}
          onChange={(e) => set("color", e.target.value)}
          className="h-6 w-10 cursor-pointer rounded border border-neutral-700 bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>Font</span>
        <select
          value={style.fontFamily}
          onChange={(e) => set("fontFamily", e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-neutral-200"
        >
          {TEXT_FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <span>Size</span>
          <span className="text-neutral-500">{style.fontSize}px</span>
        </span>
        <input
          type="range"
          min={12}
          max={72}
          value={style.fontSize}
          onChange={(e) => set("fontSize", Number(e.target.value))}
        />
      </label>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => set("bold", !style.bold)}
          className={`flex-1 rounded border px-2 py-1 font-bold ${
            style.bold
              ? "border-neutral-100 bg-neutral-100 text-neutral-900"
              : "border-neutral-700 text-neutral-300"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => set("italic", !style.italic)}
          className={`flex-1 rounded border px-2 py-1 italic ${
            style.italic
              ? "border-neutral-100 bg-neutral-100 text-neutral-900"
              : "border-neutral-700 text-neutral-300"
          }`}
        >
          I
        </button>
      </div>

      <label className="flex cursor-pointer items-center justify-between">
        <span>Outline</span>
        <input
          type="checkbox"
          checked={style.outline}
          onChange={(e) => set("outline", e.target.checked)}
          className="accent-neutral-100"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between">
        <span>Shadow</span>
        <input
          type="checkbox"
          checked={style.shadow}
          onChange={(e) => set("shadow", e.target.checked)}
          className="accent-neutral-100"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <span>Rotation</span>
          <span className="text-neutral-500">{style.rotation}°</span>
        </span>
        <input
          type="range"
          min={-180}
          max={180}
          value={style.rotation}
          onChange={(e) => set("rotation", Number(e.target.value))}
        />
      </label>
    </div>
  );
}

const ICON_KIND_OPTIONS: { id: IconKind; label: string }[] = [
  { id: "flag", label: "Flag" },
  { id: "pin", label: "Pin" },
  { id: "star", label: "Star" },
];

function IconOptions({
  iconKind,
  setKind,
  style,
  set,
}: {
  iconKind: IconKind;
  setKind: (kind: IconKind) => void;
  style: IconStyle;
  set: <K extends keyof IconStyle>(key: K, value: IconStyle[K]) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5">
        {ICON_KIND_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setKind(o.id)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${
              iconKind === o.id
                ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                : "border-neutral-700 text-neutral-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between">
        <span>Color</span>
        <input
          type="color"
          value={style.color}
          onChange={(e) => set("color", e.target.value)}
          className="h-6 w-10 cursor-pointer rounded border border-neutral-700 bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <span>Size</span>
          <span className="text-neutral-500">{style.size}px</span>
        </span>
        <input
          type="range"
          min={16}
          max={64}
          value={style.size}
          onChange={(e) => set("size", Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function HighlightOptions({
  style,
  set,
}: {
  style: HighlightStyle;
  set: <K extends keyof HighlightStyle>(key: K, value: HighlightStyle[K]) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="flex items-center justify-between">
        <span>Color</span>
        <input
          type="color"
          value={style.color}
          onChange={(e) => set("color", e.target.value)}
          className="h-6 w-10 cursor-pointer rounded border border-neutral-700 bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <span>Intensity</span>
          <span className="text-neutral-500">{Math.round(style.opacity * 100)}%</span>
        </span>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(style.opacity * 100)}
          onChange={(e) => set("opacity", Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
}
