"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FilePlus, Link2, Loader2, Plus, Radio, Trash2, X } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useMapInstance } from "@/lib/map/MapContext";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import {
  listMapProjectsAction,
  createMapProjectAction,
  updateMapProjectAction,
  deleteMapProjectAction,
  setMapProjectPublishedAction,
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
  const liveValues = useAppStore((s) => s.liveValues);
  const setLiveValues = useAppStore((s) => s.setLiveValues);
  const setLiveValue = useAppStore((s) => s.setLiveValue);
  const removeLiveValue = useAppStore((s) => s.removeLiveValue);

  const [projects, setProjects] = useState<MapProject[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
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
      const result = await updateMapProjectAction(projectId, { mapView, layers, liveValues });
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
  }, [mapView, layers, liveValues, projectId]);

  async function handleSaveNew() {
    setSaveState("saving");
    setError(null);
    const result = await createMapProjectAction({ name: projectName, mapView, layers, liveValues });
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
    setLiveValues(project.liveValues);
    setProject(project.id, project.name);
    setSaveState("saved");
    setMenuOpen(false);
    jumpMapTo(project.mapView);
  }

  function handleNew() {
    const view = createDefaultMapView();
    setMapView(view);
    setLayers(createDefaultLayers());
    setLiveValues({});
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

  const currentProject = projects.find((project) => project.id === projectId) ?? null;

  async function copyPresentationLink() {
    if (!projectId) return;
    setError(null);
    let project = currentProject;
    if (!project?.isPublished) {
      const result = await setMapProjectPublishedAction(projectId, true);
      if (!result.ok) { setError(result.error); return; }
      project = result.data;
      setProjects((items) => items.map((item) => item.id === projectId ? project! : item));
    }
    const url = `${window.location.origin}/geography/present/${project.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setSaveState("saved");
    } catch {
      window.prompt("Copy the live presentation link", url);
    }
  }

  async function disablePresentation() {
    if (!projectId || !currentProject?.isPublished) return;
    const result = await setMapProjectPublishedAction(projectId, false);
    if (!result.ok) { setError(result.error); return; }
    setProjects((items) => items.map((item) => item.id === projectId ? result.data : item));
  }

  function addLiveValue() {
    const key = newKey.trim().replace(/\s+/g, "_").slice(0, 100);
    if (!key) return;
    setLiveValue(key, liveValues[key] ?? "");
    setNewKey("");
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

      {projectId && (
        <button type="button" onClick={copyPresentationLink} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800" title="Copy a read-only link for OBS or another display">
          {currentProject?.isPublished ? <Radio size={12} className="text-emerald-400" /> : <Link2 size={12} />} {currentProject?.isPublished ? "Copy live link" : "Enable live link"}
        </button>
      )}

      <div className="relative">
        <button type="button" onClick={() => setLiveOpen((value) => !value)} className="rounded px-2 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800">Live values</button>
        {liveOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-md border border-neutral-700 bg-neutral-950 p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between"><span className="font-medium">Live values</span>{currentProject?.isPublished ? <button type="button" onClick={disablePresentation} className="text-[11px] text-red-400 hover:underline">Revoke public link</button> : null}</div>
            <p className="mb-3 text-[11px] leading-4 text-neutral-500">Bound text and colors update in the presentation within about one second.</p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {Object.entries(liveValues).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                <label key={key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-1">
                  <span className="truncate text-[11px] text-neutral-400" title={key}>{key}</span>
                  <input value={value} onChange={(event) => setLiveValue(key, event.target.value)} aria-label={`Value for ${key}`} className="min-w-0 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-xs" />
                  <button type="button" onClick={() => removeLiveValue(key)} aria-label={`Remove ${key}`} className="text-neutral-500 hover:text-red-400"><X size={12} /></button>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-1"><input value={newKey} onChange={(event) => setNewKey(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addLiveValue(); }} placeholder="new_key" aria-label="New live value key" className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs" /><button type="button" onClick={addLiveValue} aria-label="Add live value" className="rounded border border-neutral-700 p-1 hover:bg-neutral-800"><Plus size={13} /></button></div>
          </div>
        )}
      </div>

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
