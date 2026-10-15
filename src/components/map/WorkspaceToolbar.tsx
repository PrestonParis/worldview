"use client";

import { useEffect, useRef, useState } from "react";
import {
  Database,
  Download,
  LayoutTemplate,
  Map as MapIcon,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { CompositionPanel } from "@/components/map/CompositionPanel";
import { CountrySearch } from "@/components/map/CountrySearch";
import { DataCatalogPanel } from "@/components/map/DataCatalogPanel";
import { ExportPanel } from "@/components/map/ExportPanel";
import { MapControlPanel } from "@/components/map/MapControlPanel";

type WorkspacePanel = "search" | "map" | "data" | "compose" | "export";

const PANELS: Array<{ id: WorkspacePanel; label: string; icon: LucideIcon }> = [
  { id: "search", label: "Find", icon: Search },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "data", label: "Data", icon: Database },
  { id: "compose", label: "Compose", icon: LayoutTemplate },
  { id: "export", label: "Export", icon: Download },
];

export function WorkspaceToolbar() {
  const [activePanel, setActivePanel] = useState<WorkspacePanel | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setActivePanel(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePanel(null);
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const title = PANELS.find((panel) => panel.id === activePanel)?.label;

  return (
    <div ref={toolbarRef} className="absolute left-3 top-3 z-30 max-w-[calc(100%-1.5rem)]">
      <nav
        aria-label="Map workspace controls"
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-neutral-700 bg-neutral-950/90 p-1 text-neutral-300 shadow-lg backdrop-blur"
      >
        {PANELS.map((panel) => {
          const Icon = panel.icon;
          const selected = activePanel === panel.id;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => setActivePanel(selected ? null : panel.id)}
              aria-expanded={selected}
              aria-controls="workspace-toolbar-panel"
              title={panel.label}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                selected
                  ? "bg-neutral-100 text-neutral-950"
                  : "hover:bg-neutral-800 hover:text-neutral-100"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{panel.label}</span>
            </button>
          );
        })}
      </nav>

      {activePanel ? (
        <section
          id="workspace-toolbar-panel"
          aria-label={`${title} controls`}
          className="mt-2 flex max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950/95 text-neutral-200 shadow-2xl backdrop-blur"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
            <h2 className="text-sm font-medium text-neutral-100">{title}</h2>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label={`Close ${title} controls`}
              className="rounded p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-100"
            >
              <X size={15} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-3">
            {activePanel === "search" ? <CountrySearch /> : null}
            {activePanel === "map" ? <MapControlPanel /> : null}
            {activePanel === "data" ? <DataCatalogPanel /> : null}
            {activePanel === "compose" ? <CompositionPanel /> : null}
            {activePanel === "export" ? <ExportPanel /> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
