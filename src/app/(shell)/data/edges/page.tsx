import { listEdges } from "@/lib/neo4j/edges";
import { listEntities } from "@/lib/neo4j/entities";
import { listSources } from "@/lib/db/sources";
import { EdgeForm } from "@/components/forms/edge-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteEdgeAction } from "@/lib/actions/edges";

export default async function EdgesPage({
  searchParams,
}: PageProps<"/data/edges">) {
  const [edges, entities, sources, params] = await Promise.all([
    listEdges(),
    listEntities(),
    listSources(),
    searchParams,
  ]);
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add relationship" defaultOpen={params.add === "1"}>
        <EdgeForm entities={entities} sources={sources} />
      </AddPanel>

      <p className="text-xs text-slate-400">
        To change a relationship, delete it and add the corrected version.
      </p>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {edges.map((edge) => (
          <li key={edge.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-slate-900 dark:text-slate-100">
                {nameOf(edge.sourceEntityId)}{" "}
                <span className="text-slate-400">→ {edge.label} →</span>{" "}
                {nameOf(edge.targetEntityId)}
              </p>
              {edge.validFrom || edge.validTo ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {edge.validFrom || "?"} – {edge.validTo || "present"}
                </p>
              ) : null}
            </div>
            <DeleteButton
              id={edge.id}
              label={`${nameOf(edge.sourceEntityId)} → ${edge.label}`}
              action={deleteEdgeAction}
            />
          </li>
        ))}
        {edges.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No relationships yet. Connect two entities above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
