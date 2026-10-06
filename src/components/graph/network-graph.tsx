"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Graph from "graphology";
import type Sigma from "sigma";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
import { Maximize2, Minus, Plus } from "lucide-react";
import { entityColorFor } from "@/lib/entity-colors";
import { relationshipCategoryColors, relationshipCategoryOf } from "@/lib/relationships";
import type { NetworkLink, NetworkNode } from "@/lib/graph/network";

// Canvas (WebGL) renderer for the People network. React Flow keeps every
// node as a DOM element, which is fine for a dozen boxes and falls over at
// several hundred; sigma draws nodes as dots on a GPU canvas, decides
// which labels fit at the current zoom, and handles hover/zoom natively.

function subscribeTheme(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

const THEME = {
  light: { label: "#0F172A", dimNode: "#E2E8F0", edgeAlpha: "55", pill: "#FFFFFF", pillBorder: "#CBD5E1" },
  dark: { label: "#E2E8F0", dimNode: "#1E293B", edgeAlpha: "66", pill: "#0F172A", pillBorder: "#334155" },
};

const DEFAULT_EDGE = "#94A3B8";

function edgeColor(relType: string): string {
  const cat = relationshipCategoryOf(relType);
  return cat ? relationshipCategoryColors[cat] : DEFAULT_EDGE;
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
}: {
  nodes: NetworkNode[];
  links: NetworkLink[];
  rootId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Re-centre the graph on a node (double-click). */
  onFocus: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  // Interaction state lives in a ref, not React state: the reducers read it
  // on every frame and a refresh is far cheaper than re-mounting sigma.
  const interaction = useRef<{
    hovered: string | null;
    selected: string | null;
    /** Neighbours of hovered ?? selected — recomputed on change, read every frame. */
    neighbors: Set<string>;
  }>({ hovered: null, selected: selectedId, neighbors: new Set() });
  const graphRef = useRef<Graph | null>(null);
  const callbacks = useRef({ onSelect, onFocus });
  useEffect(() => {
    callbacks.current = { onSelect, onFocus };
  }, [onSelect, onFocus]);
  const dark = useDarkMode();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let renderer: Sigma | null = null;
    const theme = dark ? THEME.dark : THEME.light;

    const graph = new Graph({ type: "directed", multi: true, allowSelfLoops: false });
    for (const n of nodes) {
      graph.addNode(n.id, {
        x: n.x,
        y: n.y,
        size: n.size,
        label: n.name,
        color: entityColorFor(n.type).border,
        zIndex: n.id === rootId ? 2 : 0,
      });
    }
    for (const l of links) {
      if (!graph.hasNode(l.source) || !graph.hasNode(l.target) || l.source === l.target) continue;
      graph.addDirectedEdgeWithKey(l.id, l.source, l.target, {
        color: edgeColor(l.relType) + theme.edgeAlpha,
        baseColor: edgeColor(l.relType),
        size: 1,
        type: rootId ? "arrow" : "line",
        text: l.role ? `${l.label} · ${l.role}` : l.label,
      });
    }

    graphRef.current = graph;
    const refocus = () => {
      const focus = interaction.current.hovered ?? interaction.current.selected;
      interaction.current.neighbors =
        focus && graph.hasNode(focus) ? new Set(graph.neighbors(focus)) : new Set();
      renderer?.refresh({ skipIndexation: true });
    };

    // Sigma touches `window`/WebGL at import time, so load it on the client
    // only, inside the effect.
    import("sigma").then(({ default: SigmaCtor }) => {
      if (cancelled) return;
      renderer = new SigmaCtor(graph, container, {
        renderEdgeLabels: true,
        defaultEdgeType: "line",
        labelColor: { color: theme.label },
        edgeLabelColor: { color: theme.label },
        labelFont: "ui-sans-serif, system-ui, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        edgeLabelSize: 11,
        // Fewer, sparser labels on big graphs; they fill in as you zoom.
        labelDensity: nodes.length > 300 ? 0.15 : 0.5,
        labelGridCellSize: nodes.length > 300 ? 160 : 90,
        labelRenderedSizeThreshold: nodes.length > 300 ? 9 : 5,
        zIndex: true,
        minCameraRatio: 0.05,
        maxCameraRatio: 4,
        stagePadding: 40,
        defaultDrawNodeHover: hoverDrawer(theme),
        nodeReducer: (node, data) => {
          const { hovered, selected } = interaction.current;
          const focus = hovered ?? selected;
          const isRoot = node === rootId;
          if (!focus) {
            return isRoot ? { ...data, forceLabel: true, highlighted: true } : data;
          }
          if (node === focus) return { ...data, forceLabel: true, highlighted: true, zIndex: 3 };
          if (interaction.current.neighbors.has(node)) return { ...data, forceLabel: true, zIndex: 2 };
          return { ...data, color: theme.dimNode, label: "", zIndex: 0 };
        },
        edgeReducer: (edge, data) => {
          const { hovered, selected } = interaction.current;
          const focus = hovered ?? selected;
          // Edge labels only for the focused node's edges — never the
          // whole graph at once.
          if (!focus) return { ...data, label: null };
          const [s, t] = graph.extremities(edge);
          if (s !== focus && t !== focus) return { ...data, hidden: true };
          return {
            ...data,
            color: data.baseColor as string,
            size: 2,
            label: data.text as string,
            forceLabel: true,
            zIndex: 1,
          };
        },
      });
      sigmaRef.current = renderer;
      refocus();

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
      renderer.on("clickStage", () => callbacks.current.onSelect(null));
    });

    return () => {
      cancelled = true;
      renderer?.kill();
      sigmaRef.current = null;
    };
  }, [nodes, links, rootId, dark]);

  useEffect(() => {
    interaction.current.selected = selectedId;
    const graph = graphRef.current;
    const focus = interaction.current.hovered ?? selectedId;
    interaction.current.neighbors =
      graph && focus && graph.hasNode(focus) ? new Set(graph.neighbors(focus)) : new Set();
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selectedId]);

  function moveCamera(action: "in" | "out" | "fit") {
    const camera = sigmaRef.current?.getCamera();
    if (action === "in") camera?.animatedZoom({ duration: 200 });
    else if (action === "out") camera?.animatedUnzoom({ duration: 200 });
    else camera?.animatedReset({ duration: 300 });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {[
          { label: "Zoom in", icon: Plus, action: "in" as const },
          { label: "Zoom out", icon: Minus, action: "out" as const },
          { label: "Fit graph", icon: Maximize2, action: "fit" as const },
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
