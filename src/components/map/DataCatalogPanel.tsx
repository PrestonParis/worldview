"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Plus, X } from "lucide-react";
import { DATA_PROVIDERS, createDataLayer } from "@/lib/map/dataLayers";
import { useAppStore } from "@/lib/store/useAppStore";

interface CatalogDataset {
  slug: string;
  title: string;
  metrics: Array<{ metric: string; label: string; unit: string; geoLevel: string; firstPeriod: string; lastPeriod: string; rows: number }>;
}

interface AisHealth { state: "healthy" | "stale" | "empty"; activeVessels: number; ageSeconds: number | null }

export function DataCatalogPanel() {
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState<CatalogDataset[]>([]);
  const [datasetSlug, setDatasetSlug] = useState("");
  const [metric, setMetric] = useState("");
  const [geoLevel, setGeoLevel] = useState("state");
  const [error, setError] = useState<string | null>(null);
  const [aisHealth, setAisHealth] = useState<AisHealth | null>(null);
  const layers = useAppStore((s) => s.layers);
  const addLayer = useAppStore((s) => s.addLayer);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const provider = DATA_PROVIDERS.find((item) => item.id === "worldview")!;
  const selectedDataset = useMemo(() => datasets.find((item) => item.slug === datasetSlug), [datasets, datasetSlug]);

  useEffect(() => {
    if (!open || datasets.length) return;
    fetch("/api/geography/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Dataset catalog failed (${response.status}).`);
        return response.json() as Promise<{ datasets: CatalogDataset[] }>;
      })
      .then((body) => setDatasets(body.datasets))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load datasets."));
  }, [datasets.length, open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/geography/health")
      .then((response) => response.ok ? response.json() as Promise<{ ais: AisHealth }> : null)
      .then((body) => { if (body) setAisHealth(body.ais); })
      .catch(() => undefined);
  }, [open]);

  function selectDataset(slug: string) {
    const selected = datasets.find((item) => item.slug === slug);
    const first = selected?.metrics[0];
    setDatasetSlug(slug);
    setMetric(first?.metric ?? "");
    setGeoLevel(first?.geoLevel ?? "state");
  }

  function selectMetric(value: string) {
    const choice = selectedDataset?.metrics.find((item) => `${item.metric}:${item.geoLevel}` === value);
    setMetric(choice?.metric ?? "");
    setGeoLevel(choice?.geoLevel ?? "state");
  }

  function addProvider(providerId: Exclude<(typeof DATA_PROVIDERS)[number]["id"], "worldview">) {
    const definition = DATA_PROVIDERS.find((item) => item.id === providerId);
    if (!definition) return;
    const layer = createDataLayer(definition, Math.max(0, ...layers.map((item) => item.order)) + 1);
    addLayer(layer);
    setActiveLayer(layer.id);
  }

  function addWorldview() {
    if (!selectedDataset || !metric) return;
    const selection = selectedDataset.metrics.find((item) => item.metric === metric && item.geoLevel === geoLevel);
    const layer = createDataLayer(provider, Math.max(0, ...layers.map((item) => item.order)) + 1, {
      dataset: selectedDataset.slug,
      metric,
      geoLevel,
      ...(selection?.lastPeriod ? { period: selection.lastPeriod } : {}),
    });
    layer.name = `${selectedDataset.title}: ${metric}`;
    layer.data.source.datasetId = selectedDataset.slug;
    layer.data.legend.title = selectedDataset.title;
    addLayer(layer);
    setActiveLayer(layer.id);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="absolute left-60 top-3 z-10 flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950/90 px-3 py-2 text-sm text-neutral-200 shadow-lg backdrop-blur hover:bg-neutral-900">
        <Database size={14} /> Add data
      </button>
    );
  }

  const categories = ["Live events", "Boundaries"] as const;
  return (
    <div className="absolute left-60 top-3 z-20 flex max-h-[calc(100vh-8rem)] w-80 flex-col rounded-md border border-neutral-700 bg-neutral-950/95 text-sm text-neutral-200 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="flex items-center gap-2 font-medium"><Database size={14} /> Data catalog</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close data catalog" className="text-neutral-500 hover:text-neutral-100"><X size={15} /></button>
      </div>
      <div className="space-y-4 overflow-y-auto p-3">
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Worldview datasets</h3>
          <select value={datasetSlug} onChange={(event) => selectDataset(event.target.value)} className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs">
            <option value="">Choose a geographic dataset…</option>
            {datasets.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
          </select>
          {selectedDataset && (
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <select value={`${metric}:${geoLevel}`} onChange={(event) => selectMetric(event.target.value)} className="min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs">
                {selectedDataset.metrics.map((item) => <option key={`${item.metric}:${item.geoLevel}`} value={`${item.metric}:${item.geoLevel}`}>{item.label} · {item.geoLevel}</option>)}
              </select>
              <button type="button" onClick={addWorldview} aria-label="Add Worldview dataset" className="rounded bg-neutral-100 p-1.5 text-neutral-900"><Plus size={14} /></button>
            </div>
          )}
          {!datasets.length && !error ? <p className="text-xs text-neutral-500">Loading catalog…</p> : null}
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </section>
        {categories.map((category) => (
          <section key={category}>
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{category}</h3>
            <div className="space-y-1.5">
              {DATA_PROVIDERS.filter((item) => item.category === category).map((item) => (
                <button key={item.id} type="button" onClick={() => addProvider(item.id as Exclude<typeof item.id, "worldview">)} className="flex w-full items-start justify-between gap-3 rounded border border-neutral-800 bg-neutral-900 p-2 text-left hover:border-neutral-600">
                  <span><strong className="block text-xs font-medium text-neutral-100">{item.name}{item.id === "ais-ships" && aisHealth ? <span className={`ml-2 text-[10px] ${aisHealth.state === "healthy" ? "text-emerald-400" : aisHealth.state === "stale" ? "text-amber-400" : "text-neutral-500"}`}>· {aisHealth.state === "healthy" ? `${aisHealth.activeVessels.toLocaleString()} active` : aisHealth.state === "stale" ? "feed stale" : "awaiting worker"}</span> : null}</strong><span className="block text-[11px] leading-4 text-neutral-500">{item.description}</span></span>
                  <Plus size={14} className="mt-0.5 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
