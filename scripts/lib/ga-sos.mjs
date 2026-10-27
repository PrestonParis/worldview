// Client for the Georgia SOS results site (results.sos.ga.gov, Enhanced
// Voting). The JSON API is public, keyless and undocumented, so every call
// is bounded: a fixed concurrency, retries with backoff (fetchRetry), and a
// hard request ceiling per process. `base` can point at a replay server
// (scripts/ga-results-replay.mjs) for rehearsals.

import { createHash } from "node:crypto";
import { fetchRetry } from "./bulk.mjs";

export const SOS_BASE = "https://results.sos.ga.gov";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function sosClient({ base = SOS_BASE, concurrency = 4, maxRequests = 20_000, attempts = 3, timeoutMs = 60_000 } = {}) {
  let requests = 0;
  const api = (p) => `${base}/results/public/api${p}`;

  async function get(url) {
    if (++requests > maxRequests) throw new Error(`request ceiling (${maxRequests}) reached; refusing ${url}`);
    const started = Date.now();
    const res = await fetchRetry(url, { timeoutMs, headers: { Accept: "application/json" } }, { attempts, label: url });
    const body = Buffer.from(await res.arrayBuffer());
    const text = body.toString("utf8").replace(/^﻿/, "");
    return {
      url,
      body,
      hash: sha256(body),
      json: JSON.parse(text),
      ms: Date.now() - started,
      fetchedAt: new Date(),
      lastModified: res.headers.get("last-modified"),
    };
  }

  // Runs fn over items with at most `concurrency` in flight; never rejects —
  // each result is { item, ok, value | error }.
  async function pool(items, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { item: items[i], ok: true, value: await fn(items[i]) };
        } catch (error) {
          results[i] = { item: items[i], ok: false, error };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
  }

  return {
    base,
    get requests() {
      return requests;
    },
    list: () => get(api("/jurisdictions/Georgia")),
    header: (id) => get(api(`/elections/Georgia/${encodeURIComponent(id)}`)),
    state: (id) => get(api(`/elections/Georgia/${encodeURIComponent(id)}/data`)),
    county: (slug, id) => get(api(`/elections/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/data`)),
    mediaExport: (id) => get(`${base}/cdn/results/Georgia/export-${encodeURIComponent(id)}.json`),
    pool,
  };
}
