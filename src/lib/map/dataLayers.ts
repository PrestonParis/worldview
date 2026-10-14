import type { DataLayerConfig, DataProviderId, Layer } from "@/lib/types";

export interface DataProviderDefinition {
  id: DataProviderId;
  name: string;
  category: "Worldview" | "Live events" | "Boundaries";
  description: string;
  attribution: string;
  sourceUrl: string;
  freshnessLabel: string;
  defaultVisualization: DataLayerConfig["visualization"];
  defaultRefreshMode: DataLayerConfig["refreshMode"];
  defaultRefreshSeconds: number;
  available: boolean;
  unavailableReason?: string;
}

export const DATA_PROVIDERS: readonly DataProviderDefinition[] = [
  {
    id: "worldview",
    name: "Worldview dataset",
    category: "Worldview",
    description: "Turn any published geographic Worldview metric into a choropleth.",
    attribution: "Worldview data catalog",
    sourceUrl: "/datasets",
    freshnessLabel: "Dataset cadence",
    defaultVisualization: "choropleth",
    defaultRefreshMode: "manual",
    defaultRefreshSeconds: 0,
    available: true,
  },
  {
    id: "ais-ships",
    name: "Live ship locations",
    category: "Live events",
    description: "Latest AIS vessel positions collected by the Worldview ingest worker.",
    attribution: "Terrestrial and satellite AIS via configured provider",
    sourceUrl: "https://www.aisstream.io/",
    freshnessLabel: "Live AIS positions; typically seconds behind",
    defaultVisualization: "circle",
    defaultRefreshMode: "interval",
    defaultRefreshSeconds: 5,
    available: true,
  },
  {
    id: "usgs-earthquakes",
    name: "Earthquakes",
    category: "Live events",
    description: "Recent earthquakes from the USGS real-time GeoJSON feed.",
    attribution: "U.S. Geological Survey",
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    freshnessLabel: "Updated about every minute",
    defaultVisualization: "circle",
    defaultRefreshMode: "interval",
    defaultRefreshSeconds: 60,
    available: true,
  },
  {
    id: "gdacs",
    name: "Global disaster alerts",
    category: "Live events",
    description: "Earthquakes, cyclones, floods, volcanoes, droughts, and wildfires from GDACS.",
    attribution: "Global Disaster Alert and Coordination System",
    sourceUrl: "https://www.gdacs.org/",
    freshnessLabel: "Updated about every 6 minutes",
    defaultVisualization: "circle",
    defaultRefreshMode: "interval",
    defaultRefreshSeconds: 360,
    available: true,
  },
  {
    id: "nasa-firms",
    name: "Active fires",
    category: "Live events",
    description: "Near-real-time VIIRS fire detections from NASA FIRMS.",
    attribution: "NASA FIRMS / EOSDIS",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
    freshnessLabel: "Near real-time; usually within 60 minutes",
    defaultVisualization: "heatmap",
    defaultRefreshMode: "interval",
    defaultRefreshSeconds: 900,
    available: true,
  },
  {
    id: "natural-earth-disputes",
    name: "Disputed boundaries",
    category: "Boundaries",
    description: "Breakaway and disputed boundary lines from Natural Earth.",
    attribution: "Natural Earth",
    sourceUrl: "https://www.naturalearthdata.com/",
    freshnessLabel: "Static reference data",
    defaultVisualization: "line",
    defaultRefreshMode: "manual",
    defaultRefreshSeconds: 0,
    available: true,
  },
  {
    id: "marine-regions-eez",
    name: "Exclusive economic zones",
    category: "Boundaries",
    description: "Maritime EEZ boundaries from Marine Regions.",
    attribution: "Flanders Marine Institute (Marine Regions)",
    sourceUrl: "https://www.marineregions.org/",
    freshnessLabel: "Reference data",
    defaultVisualization: "line",
    defaultRefreshMode: "manual",
    defaultRefreshSeconds: 0,
    available: true,
  },
] as const;

const DEFAULT_COLORS: Record<DataProviderId, string> = {
  worldview: "#3b82f6",
  "ais-ships": "#22d3ee",
  "usgs-earthquakes": "#f97316",
  gdacs: "#ef4444",
  "nasa-firms": "#fb2c36",
  "natural-earth-disputes": "#facc15",
  "marine-regions-eez": "#38bdf8",
};

export function createDataLayer(
  provider: DataProviderDefinition,
  order: number,
  query: DataLayerConfig["source"]["query"] = {},
): Extract<Layer, { type: "data" }> {
  return {
    id: crypto.randomUUID(),
    name: provider.name,
    type: "data",
    visible: true,
    locked: false,
    opacity: 1,
    order,
    parentGroupId: null,
    data: {
      source: { providerId: provider.id, datasetId: provider.id, query },
      visualization: provider.defaultVisualization,
      refreshMode: provider.defaultRefreshMode,
      refreshSeconds: provider.defaultRefreshSeconds,
      timeRange: { from: null, to: null },
      filters: {},
      style: {
        color: DEFAULT_COLORS[provider.id],
        opacity: 0.8,
        radius: provider.id === "usgs-earthquakes" ? 7 : 5,
        strokeColor: "#ffffff",
        strokeWidth: 1,
      },
      labels: { visible: false, field: null, minZoom: 4 },
      legend: { visible: true, title: provider.name },
      metadata: {
        attribution: provider.attribution,
        sourceUrl: provider.sourceUrl,
        freshnessLabel: provider.freshnessLabel,
      },
    },
  };
}

export function dataLayerEndpoint(layer: Extract<Layer, { type: "data" }>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(layer.data.source.query)) {
    params.set(key, String(value));
  }
  if (layer.data.timeRange.from) params.set("from", layer.data.timeRange.from);
  if (layer.data.timeRange.to) params.set("to", layer.data.timeRange.to);
  const query = params.toString();
  return `/api/geography/providers/${layer.data.source.providerId}${query ? `?${query}` : ""}`;
}
