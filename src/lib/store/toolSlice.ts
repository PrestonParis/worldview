import type { StateCreator } from "zustand";
import type { ToolId } from "@/lib/types";

export interface ToolOptions {
  color: string;
  thickness: number;
  dashed: boolean;
  [key: string]: unknown;
}

export interface ToolSlice {
  activeTool: ToolId;
  toolOptions: ToolOptions;
  setActiveTool: (tool: ToolId) => void;
  setToolOption: <K extends keyof ToolOptions>(
    key: K,
    value: ToolOptions[K]
  ) => void;
}

export const createToolSlice: StateCreator<ToolSlice> = (set) => ({
  activeTool: "select",
  toolOptions: {
    color: "#ef4444",
    thickness: 3,
    dashed: false,
    curved: false,
    startArrowhead: false,
    endArrowhead: true,
    fontFamily: "sans",
    fontSize: 28,
    bold: true,
    italic: false,
    outline: true,
    shadow: false,
    rotation: 0,
  },
  setActiveTool: (tool) => set({ activeTool: tool }),
  setToolOption: (key, value) =>
    set((s) => ({ toolOptions: { ...s.toolOptions, [key]: value } })),
});
