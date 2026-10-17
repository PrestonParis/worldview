"use client";

import { useState, type ReactNode } from "react";
import { NetworkPreview } from "@/components/people/network-preview";
import type { EgoPreview } from "@/lib/people/ego-preview";

export interface FeaturedNetwork {
  id: string;
  name: string;
  fill: string;
  preview: EgoPreview;
}

// The /people networks section. Every network is built on the server and
// switched here, so the page stays one cached render.
export function FeaturedNetworks({ intro, networks }: { intro: ReactNode; networks: FeaturedNetwork[] }) {
  const [selectedId, setSelectedId] = useState(networks[0]?.id);

  const selected = networks.find((n) => n.id === selectedId) ?? networks[0];
  if (!selected) return null;
  const others = networks.filter((n) => n.id !== selected.id);

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        {intro}
        {others.length ? (
          <div className="mt-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">More networks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {others.map((network) => (
                <button
                  key={network.id}
                  type="button"
                  onClick={() => setSelectedId(network.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: network.fill }} />
                  {network.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div id="networks" className="scroll-mt-24">
        <NetworkPreview preview={selected.preview} moreHref={`${selected.preview.root.href}#relationships`} />
      </div>
    </section>
  );
}
