"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FilePlus, Loader2, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useMapInstance } from "@/lib/map/MapContext";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import {
  listMapProjectsAction,
  createMapProjectAction,
  updateMapProjectAction,
  deleteMapProjectAction,
} from "@/lib/actions/mapProjects";
import type { MapProject } from "@/lib/validation/mapProject";

const AUTOSAVE_DELAY_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

export function GraphicsBar() {
  const { map } = useMapInstance();
  const mapView = useAppStore((s) => s.mapView);
  const layers = useAppStore((s) => s.layers);
  const projectId = useAppStore((s) => s.projectId);
  const projectName = useAppStore((s) => s.projectName);
  const setProject = useAppStore((s) => s.setProject);
  const renameProject = useAppStore((s) => s.renameProject);
  const setMapView = useAppStore((s) => s.setMapView);
  const setLayers = useAppStore((s) => s.setLayers);

  const [projects, setProjects] = useState<MapProject[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refreshList() {
    const result = await listMapProjectsAction();
    if (result.ok) setProjects(result.data);
  }

  useEffect(() => {
    // Inlined rather than calling refreshList() — the linter's
    // set-state-in-effect rule flags a named async function invoked from an
    // effect body the same as a direct synchronous call, even though the
    // actual setState only happens after an await. An inline .then() reads
    // as the "external system" callback pattern it wants instead.
    listMapProjectsAction().then((result) => {
      if (result.ok) setProjects(result.data);
    });
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Autosave: debounced, and only once a graphic has actually been saved
  // once (projectId set) — an unsaved graphic has nothing to autosave
  // against yet, see the manual Save button below instead.
  useEffect(() => {
    if (!projectId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveState("saving");
      const result = await updateMapProjectAction(projectId, { mapView, layers });
      if (result.ok) {
        setSaveState("saved");
      } else {
        setSaveState("error");
        setError(result.error);
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapView, layers, projectId]);

  async function handleSaveNew() {
    setSaveState("saving");
    setError(null);
    const result = await createMapProjectAction({ name: projectName, mapView, layers });
    if (result.ok) {
      setProject(result.data.id, result.data.name);
      setSaveState("saved");
      refreshList();
    } else {
      setSaveState("error");
      setError(result.error);
    }
  }

  async function handleRenameCommit(name: string) {
    renameProject(name);
    if (projectId) {
      const result = await updateMapProjectAction(projectId, { name });
      if (result.ok) refreshList();
    }
  }

  function jumpMapTo(view: ReturnType<typeof createDefaultMapView>) {
    map?.jumpTo({ center: view.center, zoom: view.zoom, bearing: view.bearing, pitch: view.pitch });
  }

  function handleOpen(project: MapProject) {
    setMapView(project.mapView);
    setLayers(project.layers);
    setProject(project.id, project.name);
    setSaveState("saved");
    setMenuOpen(false);
    jumpMapTo(project.mapView);
  }

  function handleNew() {
    const view = createDefaultMapView();
    setMapView(view);
    setLayers(createDefaultLayers());
    setProject(null, "Untitled graphic");
    setSaveState("idle");
    setMenuOpen(false);
    jumpMapTo(view);
  }

  async function handleDelete(project: MapProject) {
    if (!confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    const result = await deleteMapProjectAction(project.id);
    if (result.ok) {
      if (project.id === projectId) handleNew();
      refreshList();
    }
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950/90 px-2 py-1.5 text-sm text-neutral-200 shadow-lg backdrop-blur">
      <input
        type="text"
        value={projectName}
        onChange={(e) => renameProject(e.target.value)}
        onBlur={(e) => handleRenameCommit(e.target.value)}
        aria-label="Graphic name"
        className="w-40 rounded bg-transparent px-1.5 py-1 text-neutral-100 focus:bg-neutral-900 focus:outline-none"
      />

      <span className="flex w-16 items-center gap-1 text-xs text-neutral-500">
        {saveState === "saving" && (
          <>
            <Loader2 size={12} className="animate-spin" /> Saving
          </>
        )}
        {saveState === "saved" && (
          <>
            <Check size={12} /> Saved
          </>
        )}
        {saveState === "error" && <span className="text-red-400">Error</span>}
      </span>

      {!projectId && (
        <button
          type="button"
          onClick={handleSaveNew}
          disabled={saveState === "saving"}
          className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
        >
          Save
        </button>
      )}

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800"
        >
          My Graphics <ChevronDown size={12} />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-md border border-neutral-700 bg-neutral-950 shadow-lg">
            <button
              type="button"
              onClick={handleNew}
              className="flex w-full items-center gap-2 border-b border-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-900"
            >
              <FilePlus size={13} /> New graphic
            </button>
            <ul className="max-h-64 overflow-y-auto">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-neutral-900 ${
                    p.id === projectId ? "bg-neutral-900" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpen(p)}
                    className="min-w-0 flex-1 truncate text-left text-neutral-200"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    aria-label={`Delete ${p.name}`}
                    className="shrink-0 text-neutral-500 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="px-3 py-2 text-xs text-neutral-500">No saved graphics yet.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
