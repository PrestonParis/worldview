# Geography studio

`/geography` is the owner-only map and annotation studio for broadcast
graphics: a MapLibre map with a Konva annotation layer, saved projects,
data layers and a live presentation output. It sits outside the site shell
(`src/app/geography/`), with its components in `src/components/{map,annotate,layout}/`.

## Editor: export, saving and undo

- **Export:** the map is created with `preserveDrawingBuffer: true`
  (`src/components/map/MapCanvas.tsx`) so its WebGL canvas stays readable,
  and the Konva stage's own `toCanvas()` supplies the annotation half of the
  PNG.
- **Saving:** projects are rows in `map_projects` (`src/lib/db/mapProjects.ts`),
  written through owner-scoped server actions (`src/lib/actions/mapProjects.ts`)
  that take the owner from the session, never the client. `GraphicsBar.tsx`
  autosaves about 1.5s after the last edit and opens, renames and deletes
  saved graphics.
- **Undo:** `zundo` wraps the store and tracks only the `layers` slice, so
  pan/zoom, the active tool and project bookkeeping stay out of history.
  Continuous slider edits are grouped into one step.

## Data layers

The studio treats external and Worldview data as saved, editable
layers. Every data layer uses the same project-document shape, MapLibre
renderer, visibility control, style controls, legend, source attribution,
refresh policy, and frozen-snapshot workflow.

## Project documents

`map_projects.document_version` identifies the persisted document format.
Version 3 replaces the former shallow object checks with discriminated Zod
schemas for the map view, every annotation type, and data-layer configuration.
Unversioned/version-1 rows are migrated and validated when read; writes save
the current version. Version 3 adds bounded project live values and optional
text/color bindings while keeping version-2 layers backward compatible. A
document from a newer unsupported version is rejected
instead of being silently damaged.

## Provider gateway

Clients call `/api/geography/providers/{provider}`. Provider credentials and
upstream details remain server-side, and every response has the same shape:

```json
{
  "data": { "type": "FeatureCollection", "features": [] },
  "metadata": {
    "providerId": "usgs-earthquakes",
    "fetchedAt": "ISO timestamp",
    "observedAt": "ISO timestamp or source period",
    "attribution": "Source name",
    "sourceUrl": "https://…",
    "freshnessLabel": "Human-readable cadence",
    "count": 0
  }
}
```

Implemented providers:

- `worldview`: published state, county, and country metrics, joined to the
  matching project GeoJSON by GEOID.
- `usgs-earthquakes`: USGS hour/day/week feeds with minimum-magnitude filtering.
- `gdacs`: recent global disaster events.
- `nasa-firms`: VIIRS near-real-time fire detections. Requires
  `NASA_FIRMS_MAP_KEY`.
- `natural-earth-disputes`: disputed boundary lines.
- `marine-regions-eez`: the Marine Regions EEZ boundary collection.
- `ais-ships`: fresh vessel positions read from Worldview's centralized AIS
  snapshot table. The browser never connects to the upstream stream directly.

## Live AIS architecture

Run `npm run ingest:ais` as one persistent worker with `AISSTREAM_API_KEY` and
`DATABASE_URL` configured. The worker owns the single compressed upstream
WebSocket, reconnects with exponential backoff, normalizes position and static
vessel messages, and batch-upserts the newest observation per MMSI into
`ais_vessel_positions`. `AIS_BOUNDING_BOX=south,west,north,east` can constrain
the subscription when global coverage is unnecessary.

The `ais-ships` provider route reads bounded, recent snapshots from Postgres.
Map clients poll that route every five seconds and can filter by viewport,
freshness, minimum speed, and ship type. Stale vessels are excluded at query
time. Deploy the ingest command as exactly one long-running process; it is not a
Vercel request handler or browser task.

`/api/geography/health` exposes a credential-free operational summary: current
worker state, active-vessel count, age of the last write, and check time. The
catalog shows this status beside the AIS source. The worker pings idle sockets,
terminates dead connections, reconnects with capped exponential backoff,
retains observations when a database flush fails, and removes vessel records
that have not been received for 24 hours.

`/api/geography/catalog` lists only metric/geography combinations that really
exist. This prevents the editor from offering, for example, a national-only
metric as a state choropleth.

## Rendering and persistence

Data layers render inside MapLibre, below the earth-anchored Konva annotation
plane. They are recreated after basemap style changes and are therefore also
captured by the existing PNG export. Interval layers refresh in place; a user
can freeze the current GeoJSON into the project document for a reproducible
graphic, then resume the feed later.

The runtime status (loading, ready, error, feature count, last refresh) is
ephemeral and intentionally excluded from saves and undo history. Source
configuration, style, labels, legend, time/filter query, refresh policy, and a
frozen snapshot are persisted.

## Adding a provider

1. Add its id and metadata to `src/lib/map/dataLayers.ts`.
2. Normalize the upstream response in `src/lib/map/providers/server.ts`.
3. Route it from `loadProviderData`.
4. Add provider-specific catalog/property controls only when the generic
   visualization controls are insufficient.
5. Add fixture-backed adapter tests and document credentials, attribution,
   freshness, licensing, and failure behavior.

Long-lived streaming sources follow the AIS pattern: one central worker writes
normalized state, while Route Handlers expose credential-free snapshots to all
clients. Do not create one upstream subscription per browser.

## Broadcast composition

The Compose panel adds screen-anchored title, subtitle, caption, source, and
timestamp layers, embedded image/logo layers, and toggleable 5%/10% safe-area
guides. These are ordinary persisted layers, so they can be reordered, hidden,
locked, duplicated, styled, exported, and undone like annotations. Included
starter templates cover a breaking-news locator, live shipping, and a global
disaster monitor. Template application resets the current canvas after an
explicit confirmation when it already contains work.

Images are embedded as data URLs to keep projects portable and are limited to
4 MB on import (the document validator permits a small serialization margin).
Editor rails hide below the desktop breakpoint, leaving a clean responsive
view/export surface. Map feature popovers use DOM text nodes rather than raw
HTML so provider data cannot inject markup.

## Live presentation output

Saving a graphic enables the editor's **Enable live link** action. Publishing
is explicit: unpublished projects are never returned by the public endpoint.
The copied `/geography/present/{token}` URL renders the same map, data, and
annotation stack without editing controls and can be used as an OBS browser
source or a clean display URL. The UUID capability token is distinct from the
project and owner ids. Public responses omit account information. Revoking the
link disables access and rotates the token, permanently invalidating every old
URL.

The presentation checks for changes about once per second using ETags, slows
while its tab is hidden, and reconnects with capped exponential backoff. This
keeps the output compatible with the primary Postgres deployment and avoids
granting anonymous direct database access. Map documents are only re-applied
when their `updatedAt` version changes.

The **Live values** editor stores at most 100 named string values per project.
Text/composition layers may bind their text, and styled annotation layers may
bind their color. A missing key falls back to the layer's authored static value.
Values travel through the same owner-scoped autosave and read-only presentation
document; an external election/news feed can update them later without changing
the rendering model.
