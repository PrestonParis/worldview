// Georgia's counties alone, so a results map doesn't load all of the US:
// public/data/ga-counties.geojson (feature id = FIPS) plus the slug → FIPS
// lookup in data/elections/ga/county-fips.json. Derived from
// public/data/us-counties.geojson; rerun only if that changes.

import fs from "node:fs";

const us = JSON.parse(fs.readFileSync("public/data/us-counties.geojson", "utf8"));
const round = (coords) => (typeof coords[0] === "number" ? coords.map((n) => Math.round(n * 1e4) / 1e4) : coords.map(round));
const slug = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, "-")}-county-ga`;

const features = us.features
  .filter((f) => f.properties.STATE === "13")
  .sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME))
  .map((f) => ({
    type: "Feature",
    id: f.id,
    properties: { name: f.properties.NAME },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  }));
if (features.length !== 159) throw new Error(`expected 159 Georgia counties, found ${features.length}`);

fs.writeFileSync("public/data/ga-counties.geojson", JSON.stringify({ type: "FeatureCollection", features }));
fs.writeFileSync("data/elections/ga/county-fips.json", `${JSON.stringify(Object.fromEntries(features.map((f) => [slug(f.properties.name), f.id])), null, 2)}\n`);
console.log(`wrote ${features.length} counties`);
