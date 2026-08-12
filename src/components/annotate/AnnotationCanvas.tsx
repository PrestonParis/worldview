"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer as KonvaLayer, Line, Circle as KonvaCircle } from "react-konva";
import * as turf from "@turf/turf";
import type { MapMouseEvent } from "maplibre-gl";
import type Konva from "konva";
import { useAppStore } from "@/lib/store/useAppStore";
import { useMapInstance } from "@/lib/map/MapContext";
import { useMapCamera } from "@/lib/map/useMapCamera";
import { createShapeLayer, createMultiPointLayer, createTextLayer } from "@/lib/shapes";
import type { DrawableToolId, Layer, LonLat } from "@/lib/types";
import type { ToolOptions } from "@/lib/store/toolSlice";
import { ShapeLayerView } from "./shapes/ShapeLayerView";
import { SelectionHandles } from "./SelectionHandles";
import { TextEditorOverlay } from "./TextEditorOverlay";

const DRAWABLE_TOOLS: ReadonlySet<string> = new Set(["arrow", "line", "rectangle", "circle"]);

function isDrawableTool(tool: string): tool is DrawableToolId {
  return DRAWABLE_TOOLS.has(tool);
}

type Draft =
  | { kind: "drag"; type: DrawableToolId; points: [LonLat, LonLat] }
  | { kind: "polygon"; points: LonLat[]; cursor: LonLat }
  | { kind: "freehand"; points: LonLat[] };

interface DragState {
  kind: "move" | "handle";
  layerId: string;
  index: number; // only meaningful for "handle"
  originalLayer: Layer;
  startLngLat: LonLat;
}

interface TextEditorState {
  layerId: string | null; // null = creating a new text layer
  anchor: LonLat;
  initialValue: string;
}

function isAnnotationLayer(layer: Layer): boolean {
  return (
    layer.type === "arrow" ||
    layer.type === "line" ||
    layer.type === "rectangle" ||
    layer.type === "circle" ||
    layer.type === "polygon" ||
    layer.type === "freehand" ||
    layer.type === "text"
  );
}

function moveGeometry(layer: Layer, dLng: number, dLat: number): Partial<Layer> {
  const translate = (p: LonLat): LonLat => [p[0] + dLng, p[1] + dLat];
  switch (layer.type) {
    case "arrow":
    case "line":
    case "rectangle":
      return { points: [translate(layer.points[0]), translate(layer.points[1])] };
    case "polygon":
    case "freehand":
      return { points: layer.points.map(translate) };
    case "circle":
      return { center: translate(layer.center) };
    case "text":
      return { point: translate(layer.point) };
    default:
      return {};
  }
}

function handleGeometry(layer: Layer, index: number, newGeo: LonLat): Partial<Layer> {
  if (layer.type === "arrow" || layer.type === "line" || layer.type === "rectangle") {
    const points: [LonLat, LonLat] =
      index === 0 ? [newGeo, layer.points[1]] : [layer.points[0], newGeo];
    return { points };
  }
  if (layer.type === "polygon") {
    const points = layer.points.slice();
    points[index] = newGeo;
    return { points };
  }
  if (layer.type === "circle") {
    if (index === 0) return { center: newGeo };
    const radiusMeters = turf.distance(layer.center, newGeo, { units: "meters" });
    return { radiusMeters: Math.max(radiusMeters, 1) };
  }
  return {};
}

function commitPolygonLayer(
  points: LonLat[],
  options: ToolOptions,
  layers: Layer[],
  addLayer: (l: Layer) => void,
  setActiveLayer: (id: string | null) => void
) {
  if (points.length < 3) return;
  const countOfType = layers.filter((l) => l.type === "polygon").length;
  const order = Math.max(0, ...layers.map((l) => l.order)) + 1;
  const layer = createMultiPointLayer("polygon", points, options, order, countOfType + 1);
  addLayer(layer);
  setActiveLayer(layer.id);
}

// The Konva overlay's DOM container is permanently `pointer-events: none`
// (see the wrapping div below) — native browser events always pass through
// to the map underneath, so panning/scroll-zoom keep working for free with
// no toggling. Drawing and selection are driven instead by subscribing to
// MapLibre's own mouse events (which already hand us `lngLat` pre-computed,
// no manual unproject needed) and using `stage.getIntersection()` — a
// programmatic Konva query unaffected by the DOM pointer-events setting —
// to hit-test shapes. Calling `e.preventDefault()` on a MapLibre mousedown
// is its documented mechanism for suppressing that gesture's default pan,
// so drawing/dragging a shape doesn't fight panning without needing
// map.dragPan.disable()/enable() bookkeeping. The text editor's textarea is
// the one deliberate exception, switched to pointer-events:auto itself.
export function AnnotationCanvas() {
  const { map } = useMapInstance();
  useMapCamera(map);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [liveOverride, setLiveOverride] = useState<{
    layerId: string;
    patch: Partial<Layer>;
  } | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const draftRef = useRef(draft);
  const dragStateRef = useRef(dragState);
  const liveOverrideRef = useRef(liveOverride);
  // Distinguishes a rapid second click (finish the polygon) from a normal
  // next-vertex click, without relying on the browser's native "dblclick"
  // event — that fires *in addition to* two full mousedown/mouseup pairs,
  // which would add a spurious extra vertex before we ever saw it.
  const lastClickRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const layers = useAppStore((s) => s.layers);
  const activeTool = useAppStore((s) => s.activeTool);
  const toolOptions = useAppStore((s) => s.toolOptions);
  const addLayer = useAppStore((s) => s.addLayer);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const updateLayerGeometry = useAppStore((s) => s.updateLayerGeometry);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  // Refs so the map-event handlers (subscribed once per map instance
  // below) always read current values without needing to resubscribe on
  // every store change. Synced in an effect, never written during render.
  const layersRef = useRef(layers);
  const activeToolRef = useRef(activeTool);
  const toolOptionsRef = useRef(toolOptions);

  useEffect(() => {
    draftRef.current = draft;
    dragStateRef.current = dragState;
    liveOverrideRef.current = liveOverride;
    layersRef.current = layers;
    activeToolRef.current = activeTool;
    toolOptionsRef.current = toolOptions;
  });

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const updateSize = () =>
      setSize({ width: container.clientWidth, height: container.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  // Leaving select mode drops the current selection so stale handles don't
  // linger while a drawing tool is active.
  useEffect(() => {
    if (activeTool !== "select") setActiveLayer(null);
  }, [activeTool, setActiveLayer]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "Escape") {
        const d = draftRef.current;
        if (d?.kind === "polygon" || d?.kind === "freehand") {
          setDraft(null);
          return;
        }
        setActiveLayer(null);
        setActiveTool("select");
        setDraft(null);
      } else if (e.key === "Enter") {
        const d = draftRef.current;
        if (d?.kind === "polygon" && d.points.length >= 3) {
          commitPolygonLayer(
            d.points,
            toolOptionsRef.current,
            layersRef.current,
            addLayer,
            setActiveLayer
          );
          setDraft(null);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const id = useAppStore.getState().activeLayerId;
        if (id) {
          removeLayer(id);
          setActiveLayer(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addLayer, removeLayer, setActiveLayer, setActiveTool]);

  useEffect(() => {
    if (!map) return;
    // Nested function declarations below don't retain the narrowing from
    // the guard above (separate closures) — capture a definitely-non-null
    // local instead of reaching for the outer `map` inside them.
    const mapInstance = map;

    function onMouseDown(e: MapMouseEvent) {
      const stage = stageRef.current;
      if (!stage) return;
      const tool = activeToolRef.current;

      if (tool === "select") {
        const hit = stage.getIntersection({ x: e.point.x, y: e.point.y });
        if (!hit) return; // empty space: let the map pan normally
        const id = hit.id();
        e.preventDefault();
        const startLngLat: LonLat = [e.lngLat.lng, e.lngLat.lat];

        if (id?.startsWith("handle:")) {
          const [, layerId, indexStr] = id.split(":");
          const layer = layersRef.current.find((l) => l.id === layerId);
          if (!layer) return;
          setActiveLayer(layerId);
          setDragState({
            kind: "handle",
            layerId,
            index: Number(indexStr),
            originalLayer: layer,
            startLngLat,
          });
        } else if (id?.startsWith("layer:")) {
          const layerId = id.slice("layer:".length);
          const layer = layersRef.current.find((l) => l.id === layerId);
          if (!layer || layer.locked) return;
          setActiveLayer(layerId);
          setDragState({
            kind: "move",
            layerId,
            index: -1,
            originalLayer: layer,
            startLngLat,
          });
        }
        return;
      }

      if (isDrawableTool(tool)) {
        e.preventDefault();
        const startGeo: LonLat = [e.lngLat.lng, e.lngLat.lat];
        setDraft({ kind: "drag", type: tool, points: [startGeo, startGeo] });
        return;
      }

      if (tool === "text") {
        console.log("TEXT TOOL MOUSEDOWN", e.lngLat);
        e.preventDefault();
        setTextEditor({ layerId: null, anchor: [e.lngLat.lng, e.lngLat.lat], initialValue: "" });
        console.log("setTextEditor called");
        return;
      }

      if (tool === "freehand") {
        e.preventDefault();
        setDraft({ kind: "freehand", points: [[e.lngLat.lng, e.lngLat.lat]] });
        return;
      }

      if (tool === "polygon") {
        e.preventDefault();
        const geo: LonLat = [e.lngLat.lng, e.lngLat.lat];
        const now = Date.now();
        const last = lastClickRef.current;
        const isRapidSecondClick =
          !!last &&
          now - last.time < 400 &&
          Math.hypot(e.point.x - last.x, e.point.y - last.y) < 8;
        lastClickRef.current = { x: e.point.x, y: e.point.y, time: now };

        const current = draftRef.current;
        if (current?.kind === "polygon") {
          if (isRapidSecondClick && current.points.length >= 3) {
            commitPolygonLayer(
              current.points,
              toolOptionsRef.current,
              layersRef.current,
              addLayer,
              setActiveLayer
            );
            setDraft(null);
            lastClickRef.current = null;
            return;
          }
          // Clicking back near the first vertex also closes the loop —
          // the other common convention besides double-click.
          const first = current.points[0];
          const firstScreen = mapInstance.project(first);
          const distToFirst = Math.hypot(e.point.x - firstScreen.x, e.point.y - firstScreen.y);
          if (current.points.length >= 3 && distToFirst < 10) {
            commitPolygonLayer(
              current.points,
              toolOptionsRef.current,
              layersRef.current,
              addLayer,
              setActiveLayer
            );
            setDraft(null);
            lastClickRef.current = null;
            return;
          }
          setDraft({ kind: "polygon", points: [...current.points, geo], cursor: geo });
        } else {
          setDraft({ kind: "polygon", points: [geo], cursor: geo });
        }
      }
    }

    function onMouseMove(e: MapMouseEvent) {
      const geo: LonLat = [e.lngLat.lng, e.lngLat.lat];
      const d = draftRef.current;

      if (d?.kind === "drag") {
        setDraft({ kind: "drag", type: d.type, points: [d.points[0], geo] });
        return;
      }
      if (d?.kind === "polygon") {
        setDraft({ ...d, cursor: geo });
        return;
      }
      if (d?.kind === "freehand") {
        const last = d.points[d.points.length - 1];
        const lastScreen = mapInstance.project(last);
        const pxDist = Math.hypot(e.point.x - lastScreen.x, e.point.y - lastScreen.y);
        if (pxDist > 4) {
          setDraft({ kind: "freehand", points: [...d.points, geo] });
        }
        return;
      }

      const drag = dragStateRef.current;
      if (!drag) return;

      if (drag.kind === "move") {
        const dLng = geo[0] - drag.startLngLat[0];
        const dLat = geo[1] - drag.startLngLat[1];
        setLiveOverride({
          layerId: drag.layerId,
          patch: moveGeometry(drag.originalLayer, dLng, dLat),
        });
      } else {
        setLiveOverride({
          layerId: drag.layerId,
          patch: handleGeometry(drag.originalLayer, drag.index, geo),
        });
      }
    }

    function onMouseUp() {
      const d = draftRef.current;

      if (d?.kind === "drag") {
        const [start, end] = d.points;
        if (start[0] !== end[0] || start[1] !== end[1]) {
          const countOfType = layersRef.current.filter((l) => l.type === d.type).length;
          const order = Math.max(0, ...layersRef.current.map((l) => l.order)) + 1;
          const layer = createShapeLayer({
            type: d.type,
            points: [start, end],
            options: toolOptionsRef.current,
            order,
            nameSuffix: countOfType + 1,
          });
          addLayer(layer);
          setActiveLayer(layer.id);
        }
        setDraft(null);
        return;
      }

      if (d?.kind === "freehand") {
        if (d.points.length >= 2) {
          const countOfType = layersRef.current.filter((l) => l.type === "freehand").length;
          const order = Math.max(0, ...layersRef.current.map((l) => l.order)) + 1;
          const layer = createMultiPointLayer(
            "freehand",
            d.points,
            toolOptionsRef.current,
            order,
            countOfType + 1
          );
          addLayer(layer);
          setActiveLayer(layer.id);
        }
        setDraft(null);
        return;
      }

      // Polygon doesn't commit on mouseup — it's a multi-click gesture,
      // finished explicitly (see onMouseDown/Enter above).
      if (d?.kind === "polygon") return;

      const drag = dragStateRef.current;
      if (drag) {
        const override = liveOverrideRef.current;
        if (override && override.layerId === drag.layerId) {
          updateLayerGeometry(drag.layerId, override.patch);
        }
        setDragState(null);
        setLiveOverride(null);
      }
    }

    function onDblClick(e: MapMouseEvent) {
      if (activeToolRef.current !== "select") return;
      const stage = stageRef.current;
      const hit = stage?.getIntersection({ x: e.point.x, y: e.point.y });
      const id = hit?.id();
      if (!id?.startsWith("layer:")) return;
      const layerId = id.slice("layer:".length);
      const layer = layersRef.current.find((l) => l.id === layerId);
      if (layer?.type === "text" && !layer.locked) {
        e.preventDefault();
        setTextEditor({ layerId: layer.id, anchor: layer.point, initialValue: layer.text });
      }
    }

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    map.on("dblclick", onDblClick);
    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.off("dblclick", onDblClick);
    };
  }, [map, addLayer, setActiveLayer, updateLayerGeometry]);

  function handleCommitText(value: string) {
    const editor = textEditor;
    if (!editor) return;
    const trimmed = value.trim();

    if (editor.layerId) {
      if (trimmed === "") {
        removeLayer(editor.layerId);
        setActiveLayer(null);
      } else {
        updateLayerGeometry(editor.layerId, { text: value });
      }
    } else if (trimmed !== "") {
      const countOfType = layers.filter((l) => l.type === "text").length;
      const order = Math.max(0, ...layers.map((l) => l.order)) + 1;
      const layer = createTextLayer(editor.anchor, value, toolOptions, order, countOfType + 1);
      addLayer(layer);
      setActiveLayer(layer.id);
    }
    setTextEditor(null);
  }

  if (!map || size.width === 0 || size.height === 0) return null;

  const annotationLayers = layers
    .filter(isAnnotationLayer)
    .filter((l) => l.id !== textEditor?.layerId)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((l) => (l.id === liveOverride?.layerId ? ({ ...l, ...liveOverride.patch } as Layer) : l));

  const activeLayer = annotationLayers.find((l) => l.id === activeLayerId) ?? null;
  const showHandles = activeTool === "select" && activeLayer && !activeLayer.locked;

  // Editing an existing text layer uses ITS OWN font/size/color, not
  // whatever the tool defaults currently are — otherwise re-opening an old
  // text layer to fix a typo would visually reflow it to today's defaults.
  const editingLayer = textEditor?.layerId
    ? layers.find((l) => l.id === textEditor.layerId)
    : null;
  const textEditorStyle =
    editingLayer && editingLayer.type === "text"
      ? editingLayer.style
      : {
          fontFamily: String(toolOptions.fontFamily ?? "sans"),
          fontSize: Number(toolOptions.fontSize ?? 28),
          color: String(toolOptions.color ?? "#ef4444"),
        };

  const draftScreenPoints =
    draft?.kind === "polygon"
      ? [...draft.points, draft.cursor].flatMap((geo) => {
          const p = map.project(geo);
          return [p.x, p.y];
        })
      : draft?.kind === "freehand"
        ? draft.points.flatMap((geo) => {
            const p = map.project(geo);
            return [p.x, p.y];
          })
        : null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Stage ref={stageRef} width={size.width} height={size.height}>
        <KonvaLayer>
          {annotationLayers.map((layer) => (
            <ShapeLayerView key={layer.id} layer={layer} map={map} />
          ))}

          {draft?.kind === "drag" && (
            <ShapeLayerView
              layer={createShapeLayer({
                type: draft.type,
                points: draft.points,
                options: toolOptions,
                order: 0,
                nameSuffix: 0,
              })}
              map={map}
            />
          )}

          {draftScreenPoints && (
            <Line
              points={draftScreenPoints}
              stroke={toolOptions.color as string}
              strokeWidth={toolOptions.thickness as number}
              dash={[6, 4]}
              closed={false}
            />
          )}
          {draft?.kind === "polygon" &&
            draft.points.map((geo, i) => {
              const p = map.project(geo);
              return (
                <KonvaCircle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={4}
                  fill={toolOptions.color as string}
                />
              );
            })}

          {showHandles && activeLayer && <SelectionHandles layer={activeLayer} map={map} />}
        </KonvaLayer>
      </Stage>

      {textEditor && (
        <TextEditorOverlay
          map={map}
          anchor={textEditor.anchor}
          initialValue={textEditor.initialValue}
          fontFamily={textEditorStyle.fontFamily}
          fontSize={textEditorStyle.fontSize}
          color={textEditorStyle.color}
          onCommit={handleCommitText}
          onCancel={() => setTextEditor(null)}
        />
      )}
    </div>
  );
}
