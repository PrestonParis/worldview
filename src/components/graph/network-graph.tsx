"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import type Sigma from "sigma";
import type { NodeHoverDrawingFunction, NodeLabelDrawingFunction } from "sigma/rendering";
import { Maximize2, Minus, Plus, Rows3 } from "lucide-react";
import { FAMILY_HEX } from "@/lib/people/family-colors";
import { relationshipCategoryColors, relationshipCategoryOf } from "@/lib/relationships";
import type { NetworkLink, NetworkNode } from "@/lib/graph/network";
import { ROW_GAP, type GraphRow } from "@/lib/graph/layout";
import { useIsDark } from "@/lib/theme";

// Canvas (WebGL) renderer for the People network. React Flow keeps every
// node as a DOM element, which is fine for a dozen boxes and falls over at
// several hundred; sigma draws nodes as dots on a GPU canvas, decides
// which labels fit at the current zoom, and handles hover/zoom natively.

// Seats and committee memberships (institutional) outnumber every other
// tie several times over, so they're drawn as a faint wash under the real
// ties; hovering or selecting a node brings its edges up to full colour.
const THEME = {
  light: { label: "#0F172A", dimNode: "#E2E8F0", canvas: "#FFFFFF", edgeOpacity: 0.45, structuralOpacity: 0.14, pill: "#FFFFFF", pillBorder: "#CBD5E1" },
  dark: { label: "#E2E8F0", dimNode: "#1E293B", canvas: "#020617", edgeOpacity: 0.6, structuralOpacity: 0.16, pill: "#0F172A", pillBorder: "#334155" },
};

const DEFAULT_EDGE = "#94A3B8";

// Room on the left for the pinned row labels in the opening view, and
// above the top row for its slanted node labels.
const ROW_LABEL_GUTTER = 150;
const ROWS_TOP_MARGIN = 130;
const ROWS_BOTTOM_MARGIN = 56;
// Most screen px between neighbouring rows when fitting them to the
// canvas, so hiding rows doesn't stretch the rest far apart (and, since
// zoom is uniform, spread each row's dots out sideways too).
const MAX_ROW_SPACING = 230;

// Sigma's WebGL canvas composites as premultiplied alpha, so a translucent
// "#2563eb55" lands on white as cyan rather than pale blue. Fade edges by
// mixing toward the canvas colour instead, and keep them opaque.
function fadeToward(hex: string, canvas: string, opacity: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(hex), rgb(canvas)];
  if (a.some(Number.isNaN)) return hex;
  return `#${a.map((c, i) => Math.round(c * opacity + b[i] * (1 - opacity)).toString(16).padStart(2, "0")).join("")}`;
}

function edgeColor(relType: string): string {
  const cat = relationshipCategoryOf(relType);
  return cat ? relationshipCategoryColors[cat] : DEFAULT_EDGE;
}

const ROW_LABEL_ANGLE = -Math.PI / 5;
const ROW_LABEL_MAX = 28;
// Closest two angled labels on the same row may sit, in screen px.
const ROW_LABEL_SPACING = 18;

// Row labels: a horizontal label runs straight across the next dozen dots
// in its row, so in the row layout names are drawn on a slant above the
// node instead, on a backing pill so they stay legible over the edges.
// Sigma hands over its candidates biggest-first per grid cell; this drawer
// skips any that would sit on a label already drawn this frame (`taken`
// is cleared on every beforeRender). Forced labels — the hovered or
// selected node and its neighbours — always draw.
function rowLabelDrawer(theme: (typeof THEME)["light"], taken: { x: number; y: number }[]): NodeLabelDrawingFunction {
  return (ctx, data, settings) => {
    if (!data.label) return;
    if (!data.forceLabel && taken.some((t) => Math.abs(t.y - data.y) < 4 && Math.abs(t.x - data.x) < ROW_LABEL_SPACING)) {
      return;
    }
    taken.push({ x: data.x, y: data.y });
    // Committee names share long prefixes; drop them so dozens of
    // committees don't all truncate to the same text.
    // "House Committee on Natural Resources" → "House Natural Resources"
    const short = data.label
      .replace(/^(House|Senate|Joint) (?:Select |Permanent Select |Standing )?Committee on (?:the )?/, "$1 ")
      // "House Armed Services — Subcommittee on Readiness" → "Armed Services: Readiness"
      .replace(/^(?:House|Senate|Joint) (.+?) [—–-] Subcommittee on (?:the )?/, "$1: ");
    const text = short.length > ROW_LABEL_MAX ? `${short.slice(0, ROW_LABEL_MAX - 1).trimEnd()}…` : short;
    const size = settings.labelSize - 1;
    ctx.save();
    ctx.translate(data.x, data.y);
    ctx.rotate(ROW_LABEL_ANGLE);
    ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    const w = ctx.measureText(text).width;
    const x = data.size + 4;
    ctx.fillStyle = theme.canvas;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(x - 3, -size / 2 - 3, w + 6, size + 6, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.label;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, 0.5);
    ctx.restore();
  };
}

// Sigma's stock hover label is a white box drawn with the label colour,
// which is invisible in dark mode. Same idea, theme-aware.
function hoverDrawer(theme: (typeof THEME)["light"]): NodeHoverDrawingFunction {
  return (ctx, data, settings) => {
    if (!data.label) return;
    const size = settings.labelSize;
    ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    const textWidth = ctx.measureText(data.label).width;
    const padX = 8;
    const h = size + 10;
    const x = data.x + data.size + 4;
    const y = data.y - h / 2;
    ctx.beginPath();
    ctx.fillStyle = theme.pill;
    ctx.strokeStyle = theme.pillBorder;
    ctx.lineWidth = 1;
    ctx.roundRect(x - 2, y, textWidth + padX * 2, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = data.color;
    ctx.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.label;
    ctx.fillText(data.label, x - 2 + padX, data.y + size / 3);
  };
}

export function NetworkGraph({
  nodes,
  links,
  rootId,
  selectedId,
  onSelect,
  onFocus,
  selectedEdgeId = null,
  onSelectEdge,
  rows = [],
}: {
  nodes: NetworkNode[];
  links: NetworkLink[];
  rootId: string | null;
  /** Layered layout rows; enables row labels, sideways scrolling and the fit-rows view. */
  rows?: GraphRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Re-centre the graph on a node (double-click). */
  onFocus: (id: string) => void;
  selectedEdgeId?: string | null;
  /** Click on an edge; opens the relationship inspector. */
  onSelectEdge?: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rowLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fitRowsRef = useRef<(() => void) | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  // Interaction state lives in a ref, not React state: the reducers read it
  // on every frame and a refresh is far cheaper than re-mounting sigma.
  const interaction = useRef<{
    hovered: string | null;
    selected: string | null;
    selectedEdge: string | null;
    /** Neighbours of hovered ?? selected — recomputed on change, read every frame. */
    neighbors: Set<string>;
  }>({ hovered: null, selected: selectedId, selectedEdge: selectedEdgeId, neighbors: new Set() });
  const graphRef = useRef<Graph | null>(null);
  const callbacks = useRef({ onSelect, onFocus, onSelectEdge });
  useEffect(() => {
    callbacks.current = { onSelect, onFocus, onSelectEdge };
  }, [onSelect, onFocus, onSelectEdge]);
  const dark = useIsDark();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let renderer: Sigma | null = null;
    const theme = dark ? THEME.dark : THEME.light;
    const familyHex = dark ? FAMILY_HEX.dark : FAMILY_HEX.light;

    const graph = new Graph({ type: "directed", multi: true, allowSelfLoops: false });
    for (const n of nodes) {
      graph.addNode(n.id, {
        x: n.x,
        y: n.y,
        size: n.size,
        label: n.name,
        color: familyHex[n.family] ?? familyHex.institution,
        zIndex: n.id === rootId ? 2 : 0,
      });
    }
    for (const l of links) {
      if (!graph.hasNode(l.source) || !graph.hasNode(l.target) || l.source === l.target) continue;
      const base = edgeColor(l.relType);
      const structural = relationshipCategoryOf(l.relType) === "institutional";
      const opacity = l.former ? 0.18 : structural ? theme.structuralOpacity : theme.edgeOpacity;
      graph.addDirectedEdgeWithKey(l.id, l.source, l.target, {
        color: fadeToward(base, theme.canvas, opacity),
        baseColor: base,
        former: l.former,
        size: 1,
        type: rootId ? "arrow" : "line",
        text: l.role ? `${l.label} · ${l.role}` : l.label,
        verb: l.label,
      });
    }

    graphRef.current = graph;
    // In a focused network the subject's own ties are the point: name every
    // neighbour and label every one of those edges without needing a hover.
    const rootNeighbors = rootId && graph.hasNode(rootId) ? new Set(graph.neighbors(rootId)) : new Set<string>();
    const refocus = () => {
      const focus = interaction.current.hovered ?? interaction.current.selected;
      interaction.current.neighbors =
        focus && graph.hasNode(focus) ? new Set(graph.neighbors(focus)) : new Set();
      renderer?.refresh({ skipIndexation: true });
    };

    const takenLabels: { x: number; y: number }[] = [];

    // The container can be 0px tall for a moment (mid-navigation, or while
    // a hot reload swaps the stylesheet). Sigma throws on that, and the
    // opening fit would be computed against the wrong size, so hold off
    // until it has real dimensions; after that, re-render on every resize.
    const hasSize = () => container.clientWidth > 0 && container.clientHeight > 0;
    let stopWaiting = () => {};
    const sized = hasSize()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const wait = new ResizeObserver(() => {
            if (!hasSize()) return;
            wait.disconnect();
            resolve();
          });
          wait.observe(container);
          stopWaiting = () => wait.disconnect();
        });
    const resizes = new ResizeObserver(() => {
      if (hasSize()) renderer?.refresh();
    });

    // Sigma touches `window`/WebGL at import time, so load it on the client
    // only, inside the effect.
    Promise.all([import("sigma"), sized]).then(([{ default: SigmaCtor }]) => {
      if (cancelled) return;
      renderer = new SigmaCtor(graph, container, {
        // Collapsing to 0px after mount (see above) shouldn't throw.
        allowInvalidContainer: true,
        renderEdgeLabels: true,
        defaultEdgeType: "line",
        labelColor: { color: theme.label },
        edgeLabelColor: { color: theme.label },
        labelFont: "ui-sans-serif, system-ui, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        edgeLabelSize: 11,
        // Fewer, sparser labels on big graphs; they fill in as you zoom.
        // Rows offer every label and let rowLabelDrawer thin them out.
        labelDensity: rows.length ? 1 : nodes.length > 300 ? 0.15 : 0.5,
        labelGridCellSize: rows.length ? 60 : nodes.length > 300 ? 160 : 90,
        // In rows, keep nodes the same size on screen at any zoom: zooming
        // in should open up the gaps between them, not inflate them.
        ...(rows.length ? { zoomToSizeRatioFunction: () => 1 } : {}),
        labelRenderedSizeThreshold: rows.length || rootId ? 0 : nodes.length > 300 ? 9 : 5,
        enableEdgeEvents: true,
        zIndex: true,
        // Low enough to zoom a very long row back up to full height.
        minCameraRatio: 0.0005,
        maxCameraRatio: 4,
        stagePadding: 40,
        defaultDrawNodeHover: hoverDrawer(theme),
        ...(rows.length ? { defaultDrawNodeLabel: rowLabelDrawer(theme, takenLabels) } : {}),
        nodeReducer: (node, data) => {
          const { hovered, selected } = interaction.current;
          const focus = hovered ?? selected;
          const isRoot = node === rootId;
          if (!focus) {
            if (isRoot) return { ...data, forceLabel: true, highlighted: true };
            return rootNeighbors.has(node) ? { ...data, forceLabel: true } : data;
          }
          if (node === focus) return { ...data, forceLabel: true, highlighted: true, zIndex: 3 };
          if (interaction.current.neighbors.has(node)) return { ...data, forceLabel: true, zIndex: 2 };
          return { ...data, color: theme.dimNode, label: "", zIndex: 0 };
        },
        edgeReducer: (edge, data) => {
          const { hovered, selected, selectedEdge } = interaction.current;
          const focus = hovered ?? selected;
          const [s, t] = graph.extremities(edge);
          if (edge === selectedEdge) {
            return { ...data, color: data.baseColor as string, size: 4, label: data.text as string, forceLabel: true, zIndex: 2 };
          }
          // Edge labels only for the focused node's edges (or, with nothing
          // focused, the subject's) — never the whole graph at once.
          if (!focus) {
            if (rootId && (s === rootId || t === rootId)) {
              // Just the verb at rest; the role comes in on hover/selection.
              return { ...data, color: data.baseColor as string, size: data.former ? 1 : 1.5, label: data.verb as string, forceLabel: true };
            }
            return { ...data, label: null };
          }
          if (s !== focus && t !== focus) return { ...data, hidden: true };
          return {
            ...data,
            color: data.former ? fadeToward(data.baseColor as string, theme.canvas, 0.4) : data.baseColor as string,
            size: data.former ? 1 : 2,
            // Full "verb · role" only while hovering; a resting selection
            // keeps the short verb so a busy subject stays readable.
            label: (hovered ? data.text : data.verb) as string,
            forceLabel: true,
            zIndex: 1,
          };
        },
      });
      sigmaRef.current = renderer;
      renderer.on("beforeRender", () => {
        takenLabels.length = 0;
      });
      refocus();

      // Row labels ride along with the camera vertically but stay pinned
      // to the left edge.
      const placeRowLabels = () => {
        if (!renderer) return;
        rows.forEach((row, i) => {
          const el = rowLabelRefs.current[i];
          if (el) el.style.transform = `translateY(${renderer!.graphToViewport({ x: 0, y: row.y }).y}px)`;
        });
      };
      renderer.on("afterRender", placeRowLabels);

      // Opening view for the rows: zoom until they fill the canvas height,
      // then start at the left end, so the long rows run off to the right
      // and are scrolled through.
      const fitRows = () => {
        if (!renderer || rows.length === 0 || nodes.length === 0) return;
        const r = renderer;
        const camera = r.getCamera();
        const whole = { x: 0.5, y: 0.5, angle: 0, ratio: 1 };
        const { height } = r.getDimensions();
        const ys = rows.map((row) => row.y);
        const [top, bottom] = [Math.max(...ys), Math.min(...ys)];
        const minX = Math.min(...nodes.map((n) => n.x));
        const at = (y: number, state = whole) => r.graphToViewport({ x: minX, y }, { cameraState: state });
        // Screen px per graph unit when everything is in view; the zoom
        // scales that up until the rows fill the canvas height.
        const scale = Math.abs(
          r.graphToViewport({ x: minX + ROW_GAP, y: top }, { cameraState: whole }).x - at(top).x,
        ) / ROW_GAP;
        const want = Math.min(
          (top - bottom) > 0
            ? Math.max(160, height - ROWS_TOP_MARGIN - ROWS_BOTTOM_MARGIN) / (top - bottom)
            : Infinity,
          MAX_ROW_SPACING / ROW_GAP,
        );
        const ratio = Math.max(0.0005, scale / want);
        if (ratio >= 1) {
          camera.setState(whole);
          return;
        }
        const zoomed = { ...whole, ratio };
        const leftEdge = at((top + bottom) / 2, zoomed);
        const from = r.viewportToFramedGraph({ x: 0, y: 0 }, { cameraState: zoomed });
        // Centre the rows in the space between the margins.
        const middle = (ROWS_TOP_MARGIN + height - ROWS_BOTTOM_MARGIN) / 2;
        const to = r.viewportToFramedGraph(
          { x: leftEdge.x - ROW_LABEL_GUTTER, y: leftEdge.y - middle },
          { cameraState: zoomed },
        );
        camera.setState({ ...zoomed, x: zoomed.x + to.x - from.x, y: zoomed.y + to.y - from.y });
      };
      fitRowsRef.current = fitRows;
      fitRows();
      placeRowLabels();

      renderer.on("enterNode", ({ node }) => {
        interaction.current.hovered = node;
        container.style.cursor = "pointer";
        refocus();
      });
      renderer.on("leaveNode", () => {
        interaction.current.hovered = null;
        container.style.cursor = "";
        refocus();
      });
      renderer.on("clickNode", ({ node }) => callbacks.current.onSelect(node));
      renderer.on("doubleClickNode", (e) => {
        e.preventSigmaDefault();
        callbacks.current.onFocus(e.node);
      });
      renderer.on("clickStage", () => {
        callbacks.current.onSelect(null);
        callbacks.current.onSelectEdge?.(null);
      });
      renderer.on("clickEdge", ({ edge }) => callbacks.current.onSelectEdge?.(edge));
      renderer.on("enterEdge", () => {
        container.style.cursor = "pointer";
      });
      renderer.on("leaveEdge", () => {
        container.style.cursor = "";
      });
      resizes.observe(container);
    });

    return () => {
      cancelled = true;
      stopWaiting();
      resizes.disconnect();
      renderer?.kill();
      sigmaRef.current = null;
      fitRowsRef.current = null;
    };
  }, [nodes, links, rootId, dark, rows]);

  // In the row layout a plain scroll (wheel or two-finger swipe) pans
  // sideways along the rows; pinch and ctrl/⌘-scroll still zoom. Listening
  // in the capture phase on the wrapper gets the event before sigma's own
  // wheel-to-zoom handler on the canvas container.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || rows.length === 0) return;
    const onWheel = (e: WheelEvent) => {
      const renderer = sigmaRef.current;
      if (!renderer || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const dy = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaY : 0;
      // Stop at either end of the rows instead of scrolling into nothing:
      // the first node can come no further right than the label gutter,
      // the last no further left than the middle of the canvas.
      const { width } = renderer.getDimensions();
      const xs = nodes.map((n) => n.x);
      const first = renderer.graphToViewport({ x: Math.min(...xs), y: 0 }).x;
      const last = renderer.graphToViewport({ x: Math.max(...xs), y: 0 }).x;
      const lo = Math.min(first - ROW_LABEL_GUTTER, last - width / 2);
      const hi = Math.max(first - ROW_LABEL_GUTTER, last - width / 2);
      const clampedDx = Math.min(hi, Math.max(lo, dx));
      const camera = renderer.getCamera();
      const from = renderer.viewportToFramedGraph({ x: 0, y: 0 });
      const to = renderer.viewportToFramedGraph({ x: clampedDx, y: dy });
      const state = camera.getState();
      camera.setState({ x: state.x + to.x - from.x, y: state.y + to.y - from.y });
    };
    wrapper.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel, { capture: true });
  }, [rows, nodes]);

  useEffect(() => {
    interaction.current.selected = selectedId;
    const graph = graphRef.current;
    const focus = interaction.current.hovered ?? selectedId;
    interaction.current.neighbors =
      graph && focus && graph.hasNode(focus) ? new Set(graph.neighbors(focus)) : new Set();
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selectedId]);

  useEffect(() => {
    interaction.current.selectedEdge = selectedEdgeId;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selectedEdgeId]);

  function moveCamera(action: "in" | "out" | "fit" | "rows") {
    const camera = sigmaRef.current?.getCamera();
    if (action === "in") camera?.animatedZoom({ duration: 200 });
    else if (action === "out") camera?.animatedUnzoom({ duration: 200 });
    else if (action === "rows") fitRowsRef.current?.();
    else camera?.animatedReset({ duration: 300 });
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {rows.map((row, i) => (
        <div
          key={row.key}
          ref={(el) => {
            rowLabelRefs.current[i] = el;
          }}
          className="pointer-events-none absolute top-0 left-0 w-full"
        >
          <div className="-translate-y-1/2 border-t border-dashed border-slate-200 dark:border-slate-800" />
          <span className="absolute -top-7 left-3 rounded-md bg-white/85 px-2 py-0.5 text-xs font-semibold text-slate-700 backdrop-blur dark:bg-slate-950/80 dark:text-slate-200">
            {row.label} <span className="font-normal text-slate-400 tabular-nums">{row.count.toLocaleString("en-US")}</span>
          </span>
        </div>
      ))}
      <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {[
          { label: "Zoom in", icon: Plus, action: "in" as const },
          { label: "Zoom out", icon: Minus, action: "out" as const },
          ...(rows.length > 1 ? [{ label: "Fit rows to height", icon: Rows3, action: "rows" as const }] : []),
          { label: "Show everything", icon: Maximize2, action: "fit" as const },
        ].map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => moveCamera(action)}
            className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
