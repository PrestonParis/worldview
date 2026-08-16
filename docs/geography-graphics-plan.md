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

## Phase 4 — Real-time updating graphics (planned in detail, not yet built)

Two distinct sub-capabilities, confirmed still worth keeping separate: which
broadcast tool captures the output and what "live" should actually drive were
both explicitly open questions in this doc, and the answer for both, on
revisiting, was "design the general capability, don't commit to a specific
vendor or dataset yet." So this phase is split into 4a (buildable now, with
data that already exists) and 4b (the generic hook for later data sources).

### 4a — Live broadcast output (make an open graphic sync itself)

Today, `map_projects` (Phase 2) already holds everything a rendered graphic
needs — `mapView` + `layers` — updated by autosave while editing. What's
missing is a second surface that displays a project read-only and stays in
sync as the editor changes it, so a producer can adjust a graphic mid-show
and have the broadcast output update without re-exporting a PNG.

- **New route `src/app/geography/present/[id]/page.tsx`** — same
  `<MapWorkspace />` the editor uses, but the page around it omits
  `ToolRail`/`LayersPanel` (editing chrome) and `MapWorkspace` itself skips
  `GraphicsBar`/`ExportPanel` in this mode (a `readOnly` prop, or a
  parallel `PresentationWorkspace` composing the same `MapCanvas` +
  `AnnotationCanvas`) — no `Header`, no page description, no draw
  interactivity needed (OBS's browser source is visual-only unless
  "Interact" mode is explicitly invoked). No new rendering code: the same
  `ShapeLayerView`/`MapCanvas` pipeline the editor already uses.
- **Loading + sync**: on mount, fetch the project by id and populate the
  store (`setMapView`/`setLayers`, same actions `GraphicsBar` already uses
  to open a saved graphic), then open a Supabase Realtime channel
  (`supabase.channel(...).on('postgres_changes', { event: 'UPDATE', schema:
  'public', table: 'map_projects', filter: \`id=eq.${id}\` }, ...)`) and
  call the same setters on every push. `@supabase/supabase-js` (already a
  dependency) supports this directly from the browser client
  (`src/lib/supabase/client.ts`) — no new package.
- **Access model — the open question this doc flagged**: OBS can't sign in,
  so the presentation route has to be reachable without auth. Recommended:
  treat the project's UUID as an unlisted-link capability, the same trust
  model as a Google Doc/Figma "anyone with the link can view" — the id is
  unguessable, and the public read path selects only `name`, `mapView`,
  `layers` (never `ownerId`, so a presentation link can't be used to learn
  which account owns a graphic). Concretely: a new `getPublicMapProject`
  DB function + Realtime enabled for `map_projects` (today it's in neither
  the `supabase_realtime` publication nor has RLS policies — both need
  adding; all *writes* stay exactly as they are, through the existing
  owner-scoped server actions, so this only ever opens up reads). Worth
  re-confirming this trust model with you specifically before building it,
  since it's a real access-control decision, not just an implementation
  detail.
- **Editor affordance**: once a graphic is saved, `GraphicsBar` gets a
  "Copy presentation link" action (`/geography/present/{id}`) — the thing
  you'd paste into an OBS browser source.
- Explicitly not addressed yet, to decide when this gets built rather than
  guessed now: whether the presentation route needs a transparent
  background (for compositing over other video) versus solid, and
  reconnect behavior if a laptop sleeps mid-show (Realtime should resync
  to current state on reconnect, not stay stale — worth an explicit test,
  not just an assumption).

### 4b — Data-bound layer values (the generic hook, no data source chosen yet)

Deliberately stops short of wiring up any specific Worldview dataset
(elections, news, money) — per the decision to design the capability
first. The minimal generic primitive:

- **`liveValues`**: a small named key→value map scoped to one graphic,
  stored as a new `jsonb` column directly on `map_projects` (not a
  separate table) — piggybacking on the exact same row and Realtime
  channel 4a already subscribes to, rather than standing up a second
  subscription.
- **Binding, not a new field type**: a bindable field (starting with just
  two — a text layer's `text`, and a shape/highlight's `style.color`, the
  two most broadcast-relevant) gains a second mode alongside its current
  static value: `{ mode: "static", value } | { mode: "bound", key }`. A
  bound field resolves its live value from `liveValues[key]` at render
  time instead of reading the static value. Everything else about the
  layer (geometry, other style fields) stays exactly as static/manual as
  it is today.
- **Editing surface**: a small "Live values" list (new panel, or folded
  into `GraphicsBar`) where the producer types a key's current value and
  it saves through the same `updateMapProjectAction` autosave already
  uses — so it inherits owner-scoping (only the signed-in owner can push
  live-value updates, which matches "the producer controls the graphic,"
  not a multi-editor model).
- Wiring an actual external feed (live election results, a news ticker,
  whatever the show actually wants) is its own future phase once a
  specific source is chosen — this just makes the layers capable of being
  driven by *something*, manually or otherwise, without hardcoding which.

### Verification, once either half is actually built

- Two browser tabs (or a real OBS browser source + the editor): edit the
  graphic, confirm the presentation view updates within ~1s with no
  manual refresh.
- Kill and restore the network connection mid-session; confirm Realtime
  reconnects and resyncs to current state rather than freezing on stale
  data.
- Confirm the public read path's response never includes `ownerId` or
  any other account-identifying field, from the network tab, not just
  the code.

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
- [x] Phase 3 — Editor gaps. Undo/redo via `zundo` (`temporal(...)` wrapping
      `useAppStore`, tracking only the `layers` slice — map pan/zoom, active
      tool, and project bookkeeping stay outside history on purpose),
      Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z shortcuts plus Undo/Redo buttons in
      `LayersPanel`. Layer list gets `moveLayer` (bring forward/send
      backward, pinned so the locked base "Map" layer always stays furthest
      back) and inline double-click rename. "Icon" (flag/pin/star, hand-
      drawn with Konva primitives — no path-data dependency) and
      "Highlight" (a soft radial-glow circle, sharing circle's exact
      center+radius geometry/handles/drag-to-draw gesture) are real tools
      now instead of no-ops, each with its own `ToolOptionsPanel` style
      controls. Known limitation: undo history isn't debounced, so
      dragging a style slider (thickness, size, intensity, rotation)
      records one step per intermediate value rather than one step for the
      whole drag — still correct, just more granular than ideal.
- [ ] Phase 4 — Real-time updating graphics. Planned in detail above (4a:
      live broadcast sync via a public read-only presentation route +
      Supabase Realtime on `map_projects`; 4b: a generic bindable-value
      hook, no specific data source chosen yet). Not built — next step is
      building 4a, and confirming the unlisted-link access model for the
      presentation route before it ships.
