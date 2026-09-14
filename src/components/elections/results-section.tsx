"use client";

import { useMemo, useState } from "react";
import { partyColorFor } from "@/lib/party-colors";
import { ResultsMap, type AreaDatum } from "./results-map";
import { AreaResultsTable } from "./area-results-table";
import type { AreaBreakdown } from "@/lib/validation/electionResult";

// Margin (points) at which a county reaches full colour saturation.
const FULL_SATURATION_PTS = 40;

function opacityForMargin(marginPct: number): number {
  return 0.12 + 0.88 * Math.min(marginPct / FULL_SATURATION_PTS, 1);
}

export function ResultsSection({ breakdowns }: { breakdowns: AreaBreakdown[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const areas = useMemo(() => {
    const out: Record<string, AreaDatum> = {};
    for (const b of breakdowns) {
      const color = partyColorFor(b.leaderParty);
      out[b.areaId] = {
        color: color.border,
        opacity: opacityForMargin(b.marginPct),
        label: `${b.areaName || b.areaId}: ${b.leaderParty || "N/A"} +${b.marginPct.toFixed(1)} pts`,
      };
    }
    return out;
  }, [breakdowns]);

  // Parties present, for the legend.
  const parties = useMemo(() => {
    const seen = new Set<string>();
    for (const b of breakdowns) if (b.leaderParty) seen.add(b.leaderParty);
    return [...seen].sort();
  }, [breakdowns]);

  return (
    <div className="mt-3 flex flex-col gap-4">
      <ResultsMap areas={areas} onSelectArea={setSelected} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {parties.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: partyColorFor(p).border }}
              aria-hidden
            />
            {p}
          </span>
        ))}
        <span>· deeper colour = wider margin</span>
      </div>

      <AreaResultsTable
        areas={breakdowns}
        onSelectArea={setSelected}
        selectedAreaId={selected}
      />
    </div>
  );
}
