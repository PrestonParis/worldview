import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// MapLibre's own worker-URL auto-detection checks that its bundled
// import.meta.url matches /^https?:/ — that's never true once Next.js
// (webpack or Turbopack) rewrites it, so it silently falls back to an
// empty URL and the map never loads any tiles. Serving the worker (and
// the sibling module it imports) as plain static files and pointing
// maplibregl.setWorkerUrl() at them sidesteps the detection entirely.
const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "node_modules", "maplibre-gl", "dist");
const destDir = join(__dirname, "..", "public", "maplibre");

mkdirSync(destDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
}
console.log("Copied maplibre-gl worker files to public/maplibre/");
