import { PeopleSearch } from "./people-search";
import { PeopleBoard } from "@/components/people/people-board";
import type { AttributeResult } from "@/lib/db/attributes";
import { buildSpectrum } from "@/lib/people/spectrum";
import type { CongressAtlas as CongressAtlasData } from "@/lib/people/atlas";
import type { CourtComposition } from "@/lib/people/court";
import type { ExecutiveMapData } from "@/lib/people/executive";
import type { Entity } from "@/lib/validation/entity";

export function PeopleExplore({
  entities,
  atlas,
  executive,
  court,
  attributes,
}: {
  entities: Entity[];
  atlas: CongressAtlasData | null;
  executive: ExecutiveMapData | null;
  court: CourtComposition | null;
  attributes: AttributeResult;
}) {
  const rows = buildSpectrum(entities, atlas?.members ?? null);

  return (
    <div className="space-y-10 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">People &amp; Power</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {entities.length.toLocaleString("en-US")} people and organizations, left and right.
          </p>
        </div>
        <div className="w-full lg:w-md [&>div>div]:w-full">
          <PeopleSearch />
        </div>
      </header>

      <PeopleBoard
        rows={rows}
        atlas={atlas ? { congress: atlas.congress, members: atlas.members } : null}
        executive={executive}
        court={court}
        attributes={attributes}
      />
    </div>
  );
}
