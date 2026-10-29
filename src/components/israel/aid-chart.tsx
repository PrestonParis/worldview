"use client";

import { useState } from "react";
import { ChartCard, type ChartSource } from "@/components/charts/chart-card";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart, type Marker, type Series } from "@/components/charts/time-series-chart";
import { Segmented } from "./segmented";

const MARKERS: Marker[] = [
  { x: 1974, label: "Yom Kippur War aid" },
  { x: 1979, label: "Camp David" },
  { x: 1999, to: 2008, label: "MOU 1" },
  { x: 2009, to: 2018, label: "MOU 2" },
  { x: 2019, to: 2025, label: "MOU 3" },
  { x: 2024, label: "Gaza war supplemental" },
];

export function AidChart({ nominal, real, baseFy, source }: { nominal: Series[]; real: Series[]; baseFy: number; source: ChartSource }) {
  const [mode, setMode] = useState<"nominal" | "real">("real");
  const series = mode === "real" ? real : nominal;
  return (
    <ChartCard
      title="U.S. aid to Israel, every year since 1949"
      subtitle={mode === "real" ? `FY${baseFy} dollars, adjusted with CPI-U` : "Current dollars, as appropriated or obligated"}
      source={source}
      table={seriesTable(series, "usd")}
      controls={
        <Segmented
          label="Dollars"
          value={mode}
          onChange={setMode}
          options={[
            ["real", "Inflation-adjusted"],
            ["nominal", "Current $"],
          ]}
        />
      }
    >
      <TimeSeriesChart series={series} type="column" unit="usd" height={340} markers={MARKERS} />
    </ChartCard>
  );
}
