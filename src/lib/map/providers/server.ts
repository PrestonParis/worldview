import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCrossSection, getDataset } from "@/lib/db/stats";
import { queryVesselPositions } from "@/lib/db/ais";
import type { DataProviderId } from "@/lib/types";

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export interface ProviderPayload {
  data: FeatureCollection;
  metadata: {
    providerId: DataProviderId;
    fetchedAt: string;
    observedAt: string | null;
    attribution: string;
    sourceUrl: string;
    freshnessLabel: string;
    count: number;
  };
}

export class ProviderQueryError extends Error {}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}.`);
  return response.json();
}

function payload(
  providerId: DataProviderId,
  data: FeatureCollection,
  details: Omit<ProviderPayload["metadata"], "providerId" | "fetchedAt" | "count">,
): ProviderPayload {
  return {
    data,
    metadata: {
      providerId,
      fetchedAt: new Date().toISOString(),
      count: data.features.length,
      ...details,
    },
  };
}

async function usgs(q: URLSearchParams): Promise<ProviderPayload> {
  const window = q.get("window") === "hour" ? "hour" : q.get("window") === "week" ? "week" : "day";
  const minimum = Math.max(0, Math.min(10, Number(q.get("minMagnitude")) || 0));
  const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_${window}.geojson`;
  const raw = await fetchJson(url) as FeatureCollection & { metadata?: { generated?: number } };
  const data: FeatureCollection = {
    type: "FeatureCollection",
    features: raw.features.filter((feature) => Number(feature.properties?.mag ?? 0) >= minimum),
  };
  return payload("usgs-earthquakes", data, {
    observedAt: raw.metadata?.generated ? new Date(raw.metadata.generated).toISOString() : null,
    attribution: "U.S. Geological Survey",
    sourceUrl: url,
    freshnessLabel: "Real-time feed; normally updated every minute",
  });
}

async function ais(q: URLSearchParams): Promise<ProviderPayload> {
  const rawBbox = (q.get("bbox") ?? "-180,-90,180,90").split(",").map(Number);
  if (rawBbox.length !== 4 || rawBbox.some((value) => !Number.isFinite(value))) {
    throw new ProviderQueryError("bbox must be west,south,east,north.");
  }
  const bbox = rawBbox as [number, number, number, number];
  const [west, south, east, north] = bbox;
  if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90 || south > north) {
    throw new ProviderQueryError("bbox coordinates are outside valid longitude/latitude bounds.");
  }
  const updatedWithinMinutes = Math.max(1, Math.min(1440, Number(q.get("updatedWithinMinutes")) || 30));
  const minimumSpeed = Math.max(0, Math.min(100, Number(q.get("minimumSpeed")) || 0));
  const shipTypeValue = q.get("shipType");
  const shipType = shipTypeValue === null ? undefined : Number(shipTypeValue);
  if (shipType !== undefined && (!Number.isInteger(shipType) || shipType < 0 || shipType > 100)) {
    throw new ProviderQueryError("shipType must be an integer from 0 to 100.");
  }
  const rows = await queryVesselPositions({
    bbox,
    updatedWithinMinutes,
    minimumSpeed,
    shipType,
    limit: Math.max(1, Math.min(25_000, Number(q.get("limit")) || 10_000)),
  });
  const data: FeatureCollection = {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.mmsi,
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: {
        mmsi: row.mmsi,
        name: row.shipName || `MMSI ${row.mmsi}`,
        callSign: row.callSign,
        shipType: row.shipType,
        destination: row.destination,
        navigationalStatus: row.navigationalStatus,
        speedKnots: row.speedKnots,
        course: row.course,
        heading: row.heading,
        observedAt: row.observedAt.toISOString(),
      },
    })),
  };
  return payload("ais-ships", data, {
    observedAt: rows[0]?.observedAt.toISOString() ?? null,
    attribution: "AIS data via the configured Worldview provider",
    sourceUrl: "https://www.aisstream.io/",
    freshnessLabel: "Live AIS positions; stale vessels are automatically excluded",
  });
}

async function gdacs(q: URLSearchParams): Promise<ProviderPayload> {
  const days = Math.max(1, Math.min(31, Number(q.get("days")) || 7));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const params = new URLSearchParams({
    eventlist: String(q.get("events") || "EQ,TC,FL,VO,DR,WF"),
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  });
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params}`;
  const raw = await fetchJson(url) as FeatureCollection;
  const data = raw?.type === "FeatureCollection" ? raw : EMPTY;
  return payload("gdacs", data, {
    observedAt: null,
    attribution: "Global Disaster Alert and Coordination System",
    sourceUrl: url,
    freshnessLabel: "GDACS feed; normally updated every 6 minutes",
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

async function firms(q: URLSearchParams): Promise<ProviderPayload> {
  const key = process.env.NASA_FIRMS_MAP_KEY;
  if (!key) throw new Error("NASA_FIRMS_MAP_KEY is not configured.");
  const days = Math.max(1, Math.min(5, Number(q.get("days")) || 1));
  const area = q.get("bbox") || "world";
  if (area !== "world" && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(area)) {
    throw new ProviderQueryError("bbox must be west,south,east,north.");
  }
  const source = q.get("source") || "VIIRS_NOAA20_NRT";
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${encodeURIComponent(source)}/${area}/${days}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`NASA FIRMS returned ${response.status}.`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  const features: FeatureCollection["features"] = [];
  for (const line of lines) {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties: {
        ...row,
        frp: Number(row.frp) || 0,
        brightness: Number(row.bright_ti4 ?? row.brightness) || 0,
        observedAt: `${row.acq_date ?? ""}T${String(row.acq_time ?? "").padStart(4, "0").replace(/(..)(..)/, "$1:$2")}:00Z`,
      },
    });
  }
  const data: FeatureCollection = { type: "FeatureCollection", features };
  return payload("nasa-firms", data, {
    observedAt: null,
    attribution: "NASA FIRMS / EOSDIS",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
    freshnessLabel: "Near-real-time satellite detections",
  });
}

async function externalGeoJson(
  providerId: "natural-earth-disputes" | "marine-regions-eez",
): Promise<ProviderPayload> {
  const naturalEarth = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_disputed_areas.geojson";
  // The polygon `eez` collection is very large and routinely exceeds a
  // request-time budget. The dedicated boundary collection is the visual
  // this layer needs and is small enough to serve reliably.
  const marineRegions = "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=MarineRegions:eez_boundaries&outputFormat=application/json&srsName=EPSG:4326";
  const url = providerId === "natural-earth-disputes" ? naturalEarth : marineRegions;
  const raw = await fetchJson(url) as FeatureCollection;
  const data = raw?.type === "FeatureCollection" ? raw : EMPTY;
  return payload(providerId, data, {
    observedAt: null,
    attribution: providerId === "natural-earth-disputes" ? "Natural Earth" : "Flanders Marine Institute (Marine Regions)",
    sourceUrl: url,
    freshnessLabel: "Reference boundary data",
  });
}

async function worldview(q: URLSearchParams): Promise<ProviderPayload> {
  const datasetSlug = q.get("dataset");
  const metric = q.get("metric");
  const geoLevel = q.get("geoLevel") || "state";
  if (!datasetSlug || !metric) throw new ProviderQueryError("dataset and metric are required.");
  const dataset = await getDataset(datasetSlug);
  if (!dataset) throw new Error(`Published dataset ${datasetSlug} was not found.`);
  if (!(metric in dataset.metrics)) throw new Error(`Metric ${metric} is not defined by ${datasetSlug}.`);
  const crossSection = await getCrossSection(datasetSlug, metric, geoLevel, { period: q.get("period") ?? undefined });
  const file = geoLevel === "county" ? "us-counties.geojson" : geoLevel === "country" ? "countries.geojson" : "us-states.geojson";
  const raw = JSON.parse(await readFile(path.join(process.cwd(), "public", "data", file), "utf8")) as FeatureCollection;
  const values = new Map(crossSection.values.map((row) => [row.geoid, row]));
  const features = raw.features.map((feature) => {
    const props = feature.properties ?? {};
    const geoid = geoLevel === "country"
      ? String(props["ISO3166-1-Alpha-3"] ?? "")
      : geoLevel === "county"
        ? String(feature.id ?? `${props.STATE ?? ""}${props.COUNTY ?? ""}`)
        : String(feature.id ?? props.GEOID ?? "");
    const row = values.get(geoid);
    return { ...feature, id: geoid, properties: { ...props, geoid, value: row?.value ?? null, geoName: row?.geoName ?? props.NAME ?? props.name ?? geoid } };
  });
  return payload("worldview", { type: "FeatureCollection", features }, {
    observedAt: crossSection.period,
    attribution: `${dataset.publisher} via Worldview`,
    sourceUrl: dataset.sourceUrl ?? `/datasets/${dataset.slug}`,
    freshnessLabel: dataset.cadence ?? "Published dataset",
  });
}

export async function loadProviderData(providerId: DataProviderId, q: URLSearchParams): Promise<ProviderPayload> {
  switch (providerId) {
    case "worldview": return worldview(q);
    case "ais-ships": return ais(q);
    case "usgs-earthquakes": return usgs(q);
    case "gdacs": return gdacs(q);
    case "nasa-firms": return firms(q);
    case "natural-earth-disputes": return externalGeoJson(providerId);
    case "marine-regions-eez": return externalGeoJson(providerId);
  }
}
