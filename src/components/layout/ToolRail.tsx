"use client";

import {
  MousePointer2,
  MoveUpRight,
  Minus,
  Square,
  Circle,
  Pentagon,
  Pencil,
  Type,
  Flag,
  PaintBucket,
} from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import type { ToolId } from "@/lib/types";

const TOOLS: { id: ToolId; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "arrow", label: "Arrow", icon: MoveUpRight },
  { id: "line", label: "Line", icon: Minus },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "polygon", label: "Polygon", icon: Pentagon },
  { id: "freehand", label: "Freehand", icon: Pencil },
  { id: "text", label: "Text", icon: Type },
  { id: "icon", label: "Icon", icon: Flag },
  { id: "highlight", label: "Highlight", icon: PaintBucket },
];

export function ToolRail() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <nav className="hidden w-14 flex-col items-center gap-1 border-r border-neutral-800 bg-neutral-950 py-3 lg:flex">
      {TOOLS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTool === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => setActiveTool(id)}
            className={`flex h-10 w-10 items-center justify-center rounded-md transition ${
              isActive
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
