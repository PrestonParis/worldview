import Link from "next/link";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

export function RecentActivity({
  entities,
  edges,
}: {
  entities: Entity[];
  edges: Edge[];
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Recently added
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {entities.map((e) => {
          const connections = edges.filter(
            (edge) => edge.sourceEntityId === e.id || edge.targetEntityId === e.id,
          ).length;
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 border-b border-slate-200 py-3 dark:border-slate-800"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                style={{
                  background: entityColorFor(e.type).bg,
                  borderColor: entityColorFor(e.type).border,
                }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/data/entities/${e.id}`}
                  className="truncate text-sm font-medium text-slate-800 hover:underline dark:text-slate-200"
                >
                  {e.name}
                </Link>
                <p className="text-xs text-slate-400 capitalize">{e.type.replace("_", " ")}</p>
              </div>
              {connections > 0 ? (
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                  {connections} connection{connections === 1 ? "" : "s"}
                </span>
              ) : null}
            </li>
          );
        })}
        {entities.length === 0 ? <p className="py-2.5 text-sm text-slate-400">Nothing yet.</p> : null}
      </ul>
    </section>
  );
}
