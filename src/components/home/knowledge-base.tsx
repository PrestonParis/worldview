import Link from "next/link";
import { EntityGraph } from "@/components/graph/entity-graph";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

interface Stat {
  label: string;
  value: number;
  delta: number;
  href: string;
}

export function KnowledgeBase({
  stats,
  graphEntities,
  graphEdges,
  graphPositions,
}: {
  stats: Stat[];
  graphEntities: Entity[];
  graphEdges: Edge[];
  graphPositions: PositionedNode[];
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Knowledge base
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <Link
              key={stat.href}
              href={stat.href}
              className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
            >
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
              {stat.delta > 0 ? (
                <p className="mt-1.5 text-xs font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                  +{stat.delta} this week
                </p>
              ) : null}
            </Link>
          ))}
        </div>

        <div className="flex flex-col rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="h-56 overflow-hidden rounded-md">
            {graphEntities.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                The graph is empty.
              </div>
            ) : (
              <EntityGraph
                entities={graphEntities}
                edges={graphEdges}
                positions={graphPositions}
                interactive={false}
              />
            )}
          </div>
          <Link
            href="/people"
            className="mt-2 self-end text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Open full graph →
          </Link>
        </div>
      </div>
    </section>
  );
}
