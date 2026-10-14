import type { Layer, TextStyle } from "@/lib/types";

const ROLE_NAMES = {
  title: "Title",
  subtitle: "Subtitle",
  caption: "Caption",
  source: "Source note",
  timestamp: "Timestamp",
} as const;

export type CompositionRole = keyof typeof ROLE_NAMES;

function roleStyle(role: CompositionRole): TextStyle {
  return {
    color: "#ffffff",
    fontFamily: "sans",
    fontSize: role === "title" ? 52 : role === "subtitle" ? 30 : role === "caption" ? 24 : 16,
    bold: role === "title" || role === "subtitle",
    italic: false,
    outline: false,
    shadow: true,
    rotation: 0,
    opacity: 1,
  };
}

export function createCompositionLayer(role: CompositionRole, order: number): Extract<Layer, { type: "composition" }> {
  const bottom = role === "caption" || role === "source" || role === "timestamp";
  const text = role === "timestamp"
    ? new Date().toLocaleString()
    : role === "source"
      ? "Source: add attribution"
      : role === "title"
        ? "Map title"
        : role === "subtitle"
          ? "Add context or a key takeaway"
          : "Add a caption";
  return {
    id: crypto.randomUUID(), name: ROLE_NAMES[role], type: "composition", role,
    visible: true, locked: false, opacity: 1, order, parentGroupId: null,
    position: [0.05, bottom ? 0.86 : role === "subtitle" ? 0.15 : 0.06],
    width: role === "source" || role === "timestamp" ? 0.45 : 0.9,
    text,
    backgroundColor: "#000000",
    backgroundOpacity: role === "title" ? 0.72 : bottom ? 0.58 : 0,
    padding: role === "title" ? 18 : 10,
    style: roleStyle(role),
  };
}

export function createImageLayer(dataUrl: string, dimensions: { width: number; height: number }, order: number): Extract<Layer, { type: "image" }> {
  const aspect = dimensions.height / Math.max(1, dimensions.width);
  return {
    id: crypto.randomUUID(), name: "Image", type: "image", visible: true, locked: false,
    opacity: 1, order, parentGroupId: null, position: [0.76, 0.06], width: 0.18,
    height: Math.min(0.5, 0.18 * aspect), dataUrl,
  };
}
