import Link from "next/link";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { Claim } from "@/lib/validation/claim";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentActivity({
  entities,
  edges,
  claims,
  entityById,
}: {
  entities: Entity[];
  edges: Edge[];
  claims: Claim[];
  entityById: Map<string, Entity>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section>
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Recently added
        </h2>
        <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {entities.map((e) => {
            const connections = edges.filter(
              (edge) => edge.sourceEntityId === e.id || edge.targetEntityId === e.id,
            ).length;
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
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

      <section>
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Claim watch
        </h2>
        <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {claims.map((c) => {
            const speaker = entityById.get(c.speakerEntityId);
            return (
              <li key={c.id} className="py-3">
                <Link href={`/data/claims/${c.id}/edit`} className="block group">
                  <p className="truncate text-sm text-slate-800 group-hover:underline dark:text-slate-200">
                    &ldquo;{c.quote}&rdquo;
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                    {speaker ? <span className="font-medium text-slate-500 dark:text-slate-400">{speaker.name}</span> : null}
                    {c.topic ? <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{c.topic}</span> : null}
                    <span className="tabular-nums">{formatDate(c.date)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
          {claims.length === 0 ? <p className="py-2.5 text-sm text-slate-400">Nothing yet.</p> : null}
        </ul>
      </section>
    </div>
  );
}
