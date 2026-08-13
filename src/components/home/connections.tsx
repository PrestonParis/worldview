import type { Edge } from "@/lib/validation/edge";
import type { Entity } from "@/lib/validation/entity";
import { entityColorFor } from "@/lib/entity-colors";

export function Connections({
  edges,
  entityById,
}: {
  edges: Edge[];
  entityById: Map<string, Entity>;
}) {
  if (edges.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Connections discovered
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {edges.map((edge) => {
          const source = entityById.get(edge.sourceEntityId);
          const target = entityById.get(edge.targetEntityId);
          if (!source || !target) return null;
          return (
            <li
              key={edge.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-800"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full border-2"
                style={{ background: entityColorFor(source.type).bg, borderColor: entityColorFor(source.type).border }}
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">{source.name}</span>
              <span className="text-slate-400">{edge.label}</span>
              <span
                className="h-2 w-2 shrink-0 rounded-full border-2"
                style={{ background: entityColorFor(target.type).bg, borderColor: entityColorFor(target.type).border }}
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">{target.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
