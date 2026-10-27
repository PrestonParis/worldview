"use client";

import { PeopleAttributes, useAttributes } from "@/components/people/people-attributes";
import { PeopleSpectrum, type Browse } from "@/components/people/people-spectrum";
import type { AttributeResult } from "@/lib/db/attributes";
import type { AtlasMember } from "@/lib/people/atlas";
import type { CourtComposition } from "@/lib/people/court";
import type { ExecutiveMapData } from "@/lib/people/executive";
import type { SpectrumRow } from "@/lib/people/spectrum";

// The spectrum and the attribute explorer share one set of filters: a
// spectrum row's "All" links open the explorer filtered to that row.
export function PeopleBoard({
  rows,
  atlas,
  executive,
  court,
  attributes,
}: {
  rows: SpectrumRow[];
  atlas: { congress: number; members: AtlasMember[] } | null;
  executive: ExecutiveMapData | null;
  court: CourtComposition | null;
  attributes: AttributeResult;
}) {
  const { params, setParams, set, result, loading } = useAttributes(attributes);

  const browse: Browse = (filter) => {
    setParams(filter);
    document.getElementById("attributes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PeopleSpectrum rows={rows} atlas={atlas} executive={executive} court={court} onBrowse={browse} />
      <PeopleAttributes params={params} set={set} clear={() => setParams({})} result={result} loading={loading} />
    </>
  );
}
