# Geography tool — from map editor to broadcast graphics tool

## Context

Worldview's Geography page (`src/app/geography/page.tsx`) is a genuinely well-built
MapLibre-based map with a Konva annotation layer on top (6 real basemap styles, real
country selection/highlighting, 6 of 8 feature-layer toggles, 8 drawing tools, full
layer state). An evaluation pass found it to be, functionally, a standalone
map-annotation editor — not yet the tool it's supposed to be.

The actual purpose: **this tool exists to produce graphics for a political show.**
The immediate, concrete gap is that there is no way to get a finished graphic out of
the browser — no image export, no download. That's the priority. Persistence
(nothing survives a refresh today) and a few smaller editor gaps (undo/redo, layer
reordering) are called out too, because export is close to worthless if 20 minutes
of positioning arrows and labels can vanish before you use it. Real-time-updating
graphics (a map that reflects live data on-air) is an explicit "down the line" ask —
named here so today's architecture doesn't paint us into a corner, but not built now.

Scope: **Geography only** — not a reframing of the rest of Worldview. "Political
Visual Generator" (the cut auto-generate-any-chart tool) stays cut; this is about
finishing the map/graphics editor itself, not building a second, more general
visualization engine.

## Phase 1 — Export

The actual ask. Two real technical facts, verified against the installed packages
rather than assumed:

- **MapLibre** (`node_modules/maplibre-gl`) defaults to `preserveDrawingBuffer: false`
  on its WebGL context, which means `map.getCanvas()` isn't reliably readable after
  the fact — the buffer can already be cleared. Fix: pass
  `preserveDrawingBuffer: true` when constructing the `Map` in
  `src/components/map/MapCanvas.tsx`. Small memory/perf cost, standard and necessary
  for exactly this screenshot use case.
- **Konva**'s `Stage` (which `AnnotationCanvas.tsx` renders into) already has
  `toCanvas()` / `toDataURL()` / `toBlob()` built in (`node_modules/konva/lib/Node.d.ts`)
  — it was designed for exactly this. No extra library needed for the annotation
  half.

**`src/lib/map/exportImage.ts`** composes the two:
1. Read the MapLibre canvas via `map.getCanvas()`.
2. Read the Konva stage's flattened output via `stage.toCanvas({ pixelRatio })`.
3. Draw both onto an offscreen `<canvas>` at the target export size — map first
   (it's the base layer), annotations on top — matching the stacking order
   `MapWorkspace.tsx` already establishes.
4. Produce a PNG via `.toBlob()`, trigger a real download (temporary
   `<a download>` + `URL.createObjectURL`).

**Target size handling**: the on-screen map is whatever size the browser window
happens to be, but a broadcast graphic needs a specific resolution. Approach — no
second hidden map instance, no offscreen-render pipeline: temporarily resize the
map's container to the target export dimensions (MapLibre's own resize handling +
Konva's stage resize both already respond to container size changes), wait for
`map.once('idle', ...)` so the resized frame has actually painted, capture, then
resize back. Shows a brief "Exporting…" state during the round trip rather than
trying to hide the resize.

**`src/components/map/ExportPanel.tsx`** — a small floating panel (top-right,
mirroring where `MapControlPanel` sits top-left), with:
- Size presets: **1920×1080** (16:9 — full-screen broadcast graphic) and
  **1080×1920** (9:16 — vertical, for clipping the show for social), plus a custom
  width/height input.
- An Export button that runs the capture-and-download flow above.

Wired into `MapWorkspace.tsx` alongside the existing `MapControlPanel`.

## Phase 2 — Persistence (recommended, not yet built)

Nothing survives a refresh today (`idb-keyval` is installed and never actually
called anywhere). Export is a lot less useful if finishing a graphic risks losing
it. Given Worldview already has real auth and a Postgres database, this should be a
real backend table, not browser-local storage:

- New Drizzle table (`src/lib/db/schema.ts`, following the `sources`/`claims`
  pattern): `mapProjects` — id, owner user id, name, map view state (JSON), layers
  (JSON — the existing `Layer[]` shape from `src/lib/types.ts`), timestamps.
- CRUD in `src/lib/db/mapProjects.ts` + server actions in
  `src/lib/actions/mapProjects.ts`, mirroring `db/claims.ts` / `actions/claims.ts`.
- A lightweight "My Graphics" list in the Geography page chrome (open / rename /
  delete), autosave-on-change.

## Phase 3 — Editor gaps (not yet built)

- **Undo/redo**: wire `zundo` (already installed, already anticipated in a comment
  in `src/lib/store/useAppStore.ts`) around the layers slice.
- **Layer reorder/rename**: `LayersPanel.tsx` can already select/show-hide/lock;
  the store's `reorderLayers` action exists but nothing calls it. Add up/down move
  buttons and inline rename on double-click — no new drag-and-drop dependency.
- **"Icon" and "highlight" tools**: currently visible in the toolbar as literal
  no-ops. Both are on-theme for broadcast graphics (a highlight circle around a
  country, a marker at a capital/event location) — implement minimally rather than
  leave fake affordances in the UI.

## Phase 4 — Real-time updating graphics (down the line, not yet planned in detail)

Two distinct sub-capabilities worth keeping separate when this is actually planned:

- **Data-bound layers**: a layer's appearance driven by live Worldview data instead
  of manual styling — the first real connection between Geography and the rest of
  the app's data model, which currently doesn't exist at all.
- **Live broadcast output**: the graphic updating on-air without a human
  re-exporting. Likely shape: a stripped "presentation" route (no editor chrome)
  captured as a browser source by broadcast software, subscribed to data changes
  (polling, or Supabase Realtime since that's already the stack). Needs its own
  planning pass when it's actually time — depends on details not worth guessing now
  (which broadcast software, what "live" actually needs to mean).

## Status

- [x] Phase 1 — Export
- [x] Phase 2 — Persistence. Built as designed: `map_projects` table
      (`src/lib/db/schema.ts`), CRUD in `src/lib/db/mapProjects.ts`, auth-scoped
      server actions in `src/lib/actions/mapProjects.ts` (every action re-derives
      the owner from the session server-side, never trusts a client-supplied id),
      a `projectSlice` for the current graphic's id/name, `setMapView`/`setLayers`
      wholesale-replace actions for loading a saved one, and `GraphicsBar.tsx`
      (name, save status, autosave ~1.5s after the last edit, My Graphics
      open/rename/delete). "New graphic" resets to defaults via
      `createDefaultMapView`/`createDefaultLayers`, exported from the two slices
      so the reset uses the exact same values the store initializes with.
- [ ] Phase 3 — Editor gaps (undo/redo, layer reorder/rename, icon/highlight tools)
- [ ] Phase 4 — Real-time updating graphics
